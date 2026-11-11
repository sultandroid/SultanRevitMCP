using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    internal static partial class Handlers
    {
        /// <summary>
        /// read_view_dimensions: every linear dimension in a view, as data another model can rebuild: type name,
        /// line (origin and direction, mm), and each reference as a portable record (grid name, or element unique id +
        /// stable reference, with the model it lives in). Pair with create_dimensions.
        /// </summary>
        private static JsonNode ReadViewDimensions(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var arr = new JsonArray();
            foreach (var d in new FilteredElementCollector(doc, view.Id).OfClass(typeof(Dimension)).Cast<Dimension>()
                         .Where(x => x.OwnerViewId == view.Id && x.DimensionShape == DimensionShape.Linear && x.Curve is Line))
            {
                var line = (Line)d.Curve;
                var dir = line.Direction.Normalize();
                var refs = new JsonArray();
                foreach (Reference r in d.References) refs.Add(PortableRef(doc, r));
                // a multi-segment string has no single origin or value: use the first segment's (it lies on the line)
                var origin = d.NumberOfSegments > 0 ? d.Segments.get_Item(0).Origin : d.Origin;
                var segs = new JsonArray();
                if (d.NumberOfSegments > 0) foreach (DimensionSegment sg in d.Segments) segs.Add(sg.Value.HasValue ? ToMm(sg.Value.Value) : null);
                var row = new JsonObject
                {
                    ["id"] = d.Id.Value,
                    ["type"] = doc.GetElement(d.GetTypeId())?.Name,
                    ["origin_mm"] = Pt(origin),
                    ["direction"] = new JsonObject { ["x"] = dir.X, ["y"] = dir.Y, ["z"] = dir.Z },
                    ["value_mm"] = d.NumberOfSegments == 0 && d.Value.HasValue ? ToMm(d.Value.Value) : null,
                    ["segments"] = d.NumberOfSegments,
                    ["segment_values_mm"] = segs,
                    ["references"] = refs,
                };
                arr.Add(row);
            }
            return new JsonObject { ["document"] = doc.Title, ["view_id"] = view.Id.Value, ["count"] = arr.Count, ["dimensions"] = arr };
        }

        private static JsonObject Pt(XYZ q) => new JsonObject { ["x"] = ToMm(q.X), ["y"] = ToMm(q.Y), ["z"] = ToMm(q.Z) };

        private static JsonObject PortableRef(Document doc, Reference r)
        {
            var o = new JsonObject();
            if (r.LinkedElementId != ElementId.InvalidElementId && doc.GetElement(r.ElementId) is RevitLinkInstance li)
            {
                var ldoc = li.GetLinkDocument();
                var le = ldoc?.GetElement(r.LinkedElementId);
                o["model"] = ldoc?.Title;
                o["unique_id"] = le?.UniqueId;
                if (le is Grid lg) o["grid"] = lg.Name;
                if (le is Level ll) o["level"] = ll.Name;
                try
                {
                    var s = r.ConvertToStableRepresentation(doc);
                    var cut = s.IndexOf(":RVTLINK/", StringComparison.Ordinal);
                    o["stable"] = cut >= 0 ? s.Substring(cut + ":RVTLINK/".Length) : s;
                }
                catch { }
                return o;
            }
            var e = doc.GetElement(r.ElementId);
            o["model"] = doc.Title;
            o["unique_id"] = e?.UniqueId;
            if (e is Grid g) o["grid"] = g.Name;
            if (e is Level lv) o["level"] = lv.Name;
            if (e is CurveElement ce && ce.OwnerViewId != ElementId.InvalidElementId && ce.GeometryCurve is Curve gc && gc.IsBound)
            {
                // a view's own line: found again in the target view by its end points (copied with copy_view_contents)
                o["detail_line"] = new JsonObject { ["start"] = Pt(gc.GetEndPoint(0)), ["end"] = Pt(gc.GetEndPoint(1)) };
            }
            try { o["stable"] = r.ConvertToStableRepresentation(doc); } catch { }
            return o;
        }

        /// <summary>
        /// create_dimensions: rebuild dimensions read by read_view_dimensions in a view of this model. Each reference
        /// resolves to: a grid or level of this model by name; an element of this model by unique id (stable reference);
        /// or an element in a loaded link to the model it came from. Unresolved references are reported; that dimension
        /// is skipped. Params: view_id, dimensions (array from read_view_dimensions), type_name (optional override).
        /// </summary>
        private static JsonNode CreateDimensions(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var list = p["dimensions"] as JsonArray ?? throw new ArgumentException("dimensions is required.");
            var typeOverride = Str(p, "type_name");
            var types = new FilteredElementCollector(doc).OfClass(typeof(DimensionType)).Cast<DimensionType>().ToList();
            var links = new FilteredElementCollector(doc).OfClass(typeof(RevitLinkInstance)).Cast<RevitLinkInstance>()
                .Where(l => l.GetLinkDocument() != null).ToList();
            var grids = new FilteredElementCollector(doc).OfClass(typeof(Grid)).Cast<Grid>().ToList();
            var levels = new FilteredElementCollector(doc).OfClass(typeof(Level)).Cast<Level>().ToList();
            var made = new JsonArray(); var failed = new JsonArray();

            var viewCurves = new FilteredElementCollector(doc, view.Id).OfClass(typeof(CurveElement)).Cast<CurveElement>()
                .Where(c => c.OwnerViewId == view.Id && c.GeometryCurve is Curve cc && cc.IsBound).ToList();
            var tol = FromMm(0.5);
            Reference Resolve(JsonObject r)
            {
                if (r["detail_line"] is JsonObject dl)
                {
                    var a = ToPoint(dl["start"]!); var b = ToPoint(dl["end"]!);
                    // compare within the view plane: a section made again can sit at another depth along its direction
                    var vd = view.ViewDirection.Normalize();
                    double Flat(XYZ u, XYZ w) { var d = u - w; return (d - vd * d.DotProduct(vd)).GetLength(); }
                    var hit = viewCurves.FirstOrDefault(c =>
                    {
                        var p0 = c.GeometryCurve.GetEndPoint(0); var p1 = c.GeometryCurve.GetEndPoint(1);
                        return (Flat(p0, a) < tol && Flat(p1, b) < tol) || (Flat(p0, b) < tol && Flat(p1, a) < tol);
                    });
                    if (hit != null) return hit.GeometryCurve.Reference;
                    throw new InvalidOperationException("the detail line this dimension measured is not in the target view (copy the view contents first)");
                }
                var model = r["model"]?.GetValue<string>();
                var stable = r["stable"]?.GetValue<string>();
                if (r["grid"] is JsonValue gn) { var g = grids.FirstOrDefault(x => x.Name == gn.GetValue<string>()); if (g != null) return new Reference(g); }
                if (r["level"] is JsonValue ln) { var l = levels.FirstOrDefault(x => x.Name == ln.GetValue<string>()); if (l != null) return l.GetPlaneReference(); }
                if (string.Equals(model, doc.Title, StringComparison.OrdinalIgnoreCase) && stable != null)
                    return Reference.ParseFromStableRepresentation(doc, stable);
                var link = links.FirstOrDefault(l => string.Equals(l.GetLinkDocument().Title, model, StringComparison.OrdinalIgnoreCase));
                if (link != null && stable != null)
                    return Reference.ParseFromStableRepresentation(link.GetLinkDocument(), stable).CreateLinkReference(link);
                throw new InvalidOperationException($"reference in '{model}' not found here (open or link that model)");
            }

            return InTransaction(doc, "Create dimensions", () =>
            {
                foreach (var node in list)
                {
                    var o = node!.AsObject();
                    try
                    {
                        var refs = new ReferenceArray();
                        foreach (var rn in o["references"]!.AsArray()) refs.Append(Resolve(rn!.AsObject()));
                        var origin = ToPoint(o["origin_mm"]!);
                        var dj = o["direction"]!.AsObject();
                        var dir = new XYZ(dj["x"]!.GetValue<double>(), dj["y"]!.GetValue<double>(), dj["z"]!.GetValue<double>());
                        var line = Line.CreateBound(origin - dir * 100, origin + dir * 100);
                        var tname = typeOverride ?? o["type"]?.GetValue<string>();
                        var type = types.FirstOrDefault(t => t.Name == tname && t.StyleType == DimensionStyleType.Linear);
                        using (var st = new SubTransaction(doc))
                        {
                            st.Start();
                            var dim = type != null ? doc.Create.NewDimension(view, line, refs, type) : doc.Create.NewDimension(view, line, refs);
                            st.Commit();
                            var vals = new JsonArray();
                            if (dim.NumberOfSegments > 0) foreach (DimensionSegment sg in dim.Segments) vals.Add(sg.Value.HasValue ? ToMm(sg.Value.Value) : null);
                            else vals.Add(dim.Value.HasValue ? ToMm(dim.Value.Value) : null);
                            made.Add(new JsonObject { ["source_id"] = o["id"]?.DeepClone(), ["id"] = dim.Id.Value,
                                ["values_mm"] = vals, ["source_values_mm"] = (o["segments"]?.GetValue<int>() > 0 ? o["segment_values_mm"] : new JsonArray(o["value_mm"]?.DeepClone()))?.DeepClone(),
                                ["type"] = type?.Name ?? "(default: " + tname + " not in this model)" });
                        }
                    }
                    catch (Exception ex) { failed.Add(new JsonObject { ["source_id"] = o["id"]?.DeepClone(), ["error"] = ex.Message }); }
                }
                return new JsonObject { ["made"] = made, ["failed"] = failed };
            });
        }
    }
}
