using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// Family documents: read a family's types, parameters, solids, profiles, dimensions and reference planes, and measure
    /// each type, without touching the user's active document.
    ///
    /// Every command here takes the family from one of three sources:
    ///   path        an .rfa on disk. It is opened in the background (never shown, never made active), read, and closed
    ///               without saving. expect_sha256 (a prefix is enough) refuses the wrong build before anything is read.
    ///               When the same file is already open, that open document is used and left open.
    ///   element_id  an instance in the active (or "document") model: its family is opened for editing, read, and closed.
    ///   document    an open family document by title or path; with none of the three, the active document.
    /// Lengths are millimetres, angles degrees. Nothing is saved; the measuring commands roll their changes back.
    /// </summary>
    internal static partial class Handlers
    {
        private const int MaxLoopPoints = 2000;

        // ---- Source resolution ------------------------------------------------------------------

        private sealed class FamilyOpen
        {
            public Document Doc;
            public bool CloseWhenDone;
            public JsonObject Info = new JsonObject();
        }

        private static JsonNode WithFamily(UIApplication app, JsonObject p, bool write, Func<Document, JsonObject> body)
        {
            var source = OpenFamilySource(app, p, write);
            if (source.Doc == null) return source.Info;
            try
            {
                var result = body(source.Doc);
                result["source"] = source.Info;
                return result;
            }
            finally
            {
                if (source.CloseWhenDone) source.Doc.Close(false);
            }
        }

        private static FamilyOpen OpenFamilySource(UIApplication app, JsonObject p, bool write)
        {
            var source = new FamilyOpen();
            var path = Str(p, "path");
            if (!string.IsNullOrEmpty(path))
            {
                if (write) throw new ArgumentException("This command changes the family, so it needs an open family (document), not a path.");
                if (!Path.IsPathRooted(path)) throw new ArgumentException($"path must be absolute: {path}");
                var info = new FileInfo(path);
                source.Info["kind"] = "path";
                source.Info["path"] = path;
                if (!info.Exists) { source.Info = Failed($"File not found: {path}"); return source; }
                // OneDrive / Desktop Connector placeholders list with a size but have no local bytes; Revit then reports
                // "does not exist". Say what it really is.
                const FileAttributes recallOnDataAccess = (FileAttributes)0x00400000;
                if ((info.Attributes & (FileAttributes.Offline | recallOnDataAccess)) != 0)
                {
                    source.Info = Failed($"{path} is a cloud-only placeholder (OneDrive / ACC). Make it available on this device, then retry.");
                    return source;
                }
                source.Info["bytes"] = info.Length;
                source.Info["modified"] = info.LastWriteTime.ToString("s");
                var already = app.Application.Documents.Cast<Document>()
                    .FirstOrDefault(d => !d.IsLinked && string.Equals(d.PathName, path, StringComparison.OrdinalIgnoreCase));
                if (already == null)
                {
                    string sha;
                    try
                    {
                        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                        sha = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
                    }
                    catch (IOException e) { source.Info = Failed($"Cannot read {path}: {e.Message}"); return source; }
                    source.Info["sha256"] = sha;
                    var expect = Str(p, "expect_sha256");
                    if (!string.IsNullOrEmpty(expect) && !sha.StartsWith(expect.Trim().ToLowerInvariant(), StringComparison.Ordinal))
                    {
                        var refused = Failed($"sha256 {sha.Substring(0, 12)}... does not start with {expect}; wrong build, nothing opened.");
                        refused["sha256"] = sha;
                        source.Info = refused;
                        return source;
                    }
                    try { source.Doc = app.Application.OpenDocumentFile(path); }
                    catch (Autodesk.Revit.Exceptions.ApplicationException e)
                    {
                        var clash = app.Application.Documents.Cast<Document>().FirstOrDefault(d => !d.IsLinked && string.Equals(BareTitle(d.Title), BareTitle(Path.GetFileName(path)), StringComparison.OrdinalIgnoreCase));
                        source.Info = Failed(clash != null
                            ? $"Revit would not open {path}: a family of the same name is already open from {clash.PathName}. Pass document=\"{clash.Title}\" to read that one, or close it first. ({e.Message})"
                            : $"Revit would not open {path}: {e.Message}");
                        return source;
                    }
                    source.CloseWhenDone = true;
                    source.Info["opened"] = "background, closed without saving";
                }
                else
                {
                    source.Doc = already;
                    source.Info["opened"] = "already open; left open";
                    source.Info["sha256"] = "not checked: Revit holds the file open";
                }
            }
            else if (p["element_id"] != null)
            {
                if (write) throw new ArgumentException("This command changes the family, so open the family itself and pass document.");
                var host = Doc(app);
                var instance = RequireElement(host, ReqId(p, "element_id")) as FamilyInstance ?? throw new ArgumentException("element_id is not a family instance.");
                if (!instance.Symbol.Family.IsEditable) throw new InvalidOperationException("This family cannot be edited.");
                source.Doc = host.EditFamily(instance.Symbol.Family);
                source.CloseWhenDone = true;
                source.Info["kind"] = "element_id";
                source.Info["host"] = host.Title;
                source.Info["instance_type"] = instance.Symbol.Name;
            }
            else
            {
                source.Doc = FamilyDocByTarget(app);
                source.Info["kind"] = "document";
            }
            if (!source.Doc.IsFamilyDocument)
            {
                if (source.CloseWhenDone) source.Doc.Close(false);
                source.Info = Failed($"'{source.Doc.Title}' is not a family document.");
                source.Doc = null;
                return source;
            }
            source.Info["title"] = source.Doc.Title;
            if (!string.IsNullOrEmpty(source.Doc.PathName)) source.Info["doc_path"] = source.Doc.PathName;
            return source;
        }

        /// <summary>The "document" target, matched also without its .rfa extension; else the active document.</summary>
        private static Document FamilyDocByTarget(UIApplication app)
        {
            if (!string.IsNullOrEmpty(_target))
            {
                var hit = app.Application.Documents.Cast<Document>().FirstOrDefault(d => !d.IsLinked &&
                    (string.Equals(BareTitle(d.Title), BareTitle(_target), StringComparison.OrdinalIgnoreCase)
                     || string.Equals(d.PathName, _target, StringComparison.OrdinalIgnoreCase)));
                if (hit != null) return hit;
            }
            return Doc(app);
        }

        // ---- Values ----------------------------------------------------------------------------

        private static string SpecName(ForgeTypeId spec)
        {
            if (spec == null || spec.Empty()) return null;
            try { return LabelUtils.GetLabelForSpec(spec); } catch { return spec.TypeId; }
        }

        private static string GroupName(ForgeTypeId group)
        {
            if (group == null || group.Empty()) return null;
            try { return LabelUtils.GetLabelForGroup(group); } catch { return group.TypeId; }
        }

        /// <summary>A family parameter's value in one type: lengths in mm, angles in degrees, ids as names.</summary>
        private static JsonNode TypeValue(Document doc, FamilyType type, FamilyParameter fp)
        {
            if (!type.HasValue(fp)) return null;
            switch (fp.StorageType)
            {
                case StorageType.Double:
                    var v = type.AsDouble(fp);
                    if (v == null) return null;
                    var spec = fp.Definition.GetDataType();
                    if (spec == SpecTypeId.Length) return Math.Round(v.Value * MmPerFoot, 3);
                    if (spec == SpecTypeId.Angle) return Math.Round(v.Value * 180 / Math.PI, 4);
                    return Math.Round(v.Value, 6);
                case StorageType.Integer:
                    var i = type.AsInteger(fp);
                    if (i == null) return null;
                    return fp.Definition.GetDataType() == SpecTypeId.Boolean.YesNo ? (JsonNode)(i.Value != 0) : i.Value;
                case StorageType.String:
                    return type.AsString(fp);
                case StorageType.ElementId:
                    var id = type.AsElementId(fp);
                    if (id == null || id == ElementId.InvalidElementId) return null;
                    return doc.GetElement(id)?.Name ?? id.Value.ToString();
                default:
                    return null;
            }
        }

        private static string Unit(FamilyParameter fp)
        {
            if (fp.StorageType != StorageType.Double) return null;
            var spec = fp.Definition.GetDataType();
            if (spec == SpecTypeId.Length) return "mm";
            if (spec == SpecTypeId.Angle) return "deg";
            return "internal";
        }

        private static List<FamilyType> SelectTypes(FamilyManager fm, JsonObject p)
        {
            var all = fm.Types.Cast<FamilyType>().ToList();
            var wanted = (p["types"] as JsonArray)?.Select(n => n.GetValue<string>()).ToList();
            if (wanted == null || wanted.Count == 0) return all;
            var missing = wanted.Where(w => all.All(t => t.Name != w)).ToList();
            if (missing.Count > 0) throw new ArgumentException($"No type named {string.Join(", ", missing)}. Types: {string.Join(", ", all.Select(t => t.Name))}");
            return all.Where(t => wanted.Contains(t.Name)).ToList();
        }

        // ---- family_types -------------------------------------------------------------------------

        /// <summary>
        /// family_types: the family's category, every type, and every family parameter with its value in each type.
        /// Params: source (path / element_id / document), types (optional names), name_contains (optional filter).
        /// </summary>
        private static JsonNode FamilyTypes(UIApplication app, JsonObject p) => WithFamily(app, p, false, doc => FamilyTypesOf(doc, p));

        private static JsonObject FamilyTypesOf(Document doc, JsonObject p)
        {
            var fm = doc.FamilyManager;
            var types = SelectTypes(fm, p);
            var filter = Str(p, "name_contains");
            var parameters = new JsonArray();
            foreach (var fp in fm.GetParameters())
            {
                var name = fp.Definition.Name;
                if (!string.IsNullOrEmpty(filter) && name.IndexOf(filter, StringComparison.OrdinalIgnoreCase) < 0) continue;
                var values = new JsonObject();
                foreach (var t in types) values[t.Name] = TypeValue(doc, t, fp);
                var o = new JsonObject
                {
                    ["name"] = name,
                    ["instance"] = fp.IsInstance,
                    ["unit"] = Unit(fp),
                    ["spec"] = SpecName(fp.Definition.GetDataType()),
                    ["group"] = GroupName(fp.Definition.GetGroupTypeId()),
                    ["values"] = values,
                };
                if (!string.IsNullOrEmpty(fp.Formula)) o["formula"] = fp.Formula;
                if (fp.IsReporting) o["reporting"] = true;
                if (fp.IsShared) o["guid"] = fp.GUID.ToString();
                if (fp.IsReadOnly) o["read_only"] = true;
                if (fp.Id.Value < 0) o["builtin"] = true;
                var associated = fp.AssociatedParameters.Size;
                if (associated > 0) o["drives_element_parameters"] = associated;
                parameters.Add(o);
            }
            var family = doc.OwnerFamily;
            return new JsonObject
            {
                ["family"] = doc.Title,
                ["category"] = family?.FamilyCategory?.Name,
                ["placement"] = family?.FamilyPlacementType.ToString(),
                ["current_type"] = fm.CurrentType?.Name,
                ["types"] = new JsonArray(fm.Types.Cast<FamilyType>().Select(t => (JsonNode)t.Name).ToArray()),
                ["parameter_count"] = parameters.Count,
                ["parameters"] = parameters,
            };
        }

        // ---- family_forms -------------------------------------------------------------------------

        /// <summary>
        /// family_forms: every solid, void and nested family in the family, with its kind, extents, material, visibility,
        /// the family parameters that drive it, and its profile loops measured in their own sketch plane (minimum-area
        /// rectangle w x h, area, centroid), so section sizes read directly (a 100 x 100 tube with a 90 x 90 hole = 5 wall).
        /// Params: source, kinds (Extrusion, Sweep, Blend, Revolution, SweptBlend, FreeFormElement, FamilyInstance),
        ///         solid_only, include_curves (raw profile curves in model mm), limit, offset.
        /// </summary>
        private static JsonNode FamilyForms(UIApplication app, JsonObject p) => WithFamily(app, p, false, doc => FamilyFormsOf(doc, p));

        private static JsonObject FamilyFormsOf(Document doc, JsonObject p)
        {
            var kinds = (p["kinds"] as JsonArray)?.Select(n => n.GetValue<string>()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var solidOnly = Bool(p, "solid_only");
            var curves = Bool(p, "include_curves");
            var limit = Limit(p);
            var offset = (int)(Num(p, "offset") ?? 0);
            var fm = doc.FamilyManager;

            var elements = new FilteredElementCollector(doc).OfClass(typeof(GenericForm)).Cast<Element>()
                .Concat(new FilteredElementCollector(doc).OfClass(typeof(FamilyInstance)).Cast<Element>())
                .Where(e => kinds == null || kinds.Contains(e.GetType().Name))
                .Where(e => !solidOnly || !(e is GenericForm g) || g.IsSolid)
                .OrderBy(e => e.Id.Value).ToList();

            BoundingBoxXYZ overall = null;
            var counts = new JsonObject();
            foreach (var e in elements)
            {
                var kind = e is GenericForm g ? (g.IsSolid ? e.GetType().Name : "Void " + e.GetType().Name) : "FamilyInstance";
                counts[kind] = (counts[kind]?.GetValue<int>() ?? 0) + 1;
                if (e is GenericForm gf && !gf.IsSolid) continue;
                overall = Union(overall, e.get_BoundingBox(null));
            }

            var items = new JsonArray();
            foreach (var e in elements.Skip(offset).Take(limit)) items.Add(FormJson(doc, fm, e, curves));
            return new JsonObject
            {
                ["family"] = doc.Title,
                ["current_type"] = fm.CurrentType?.Name,
                ["counts"] = counts,
                ["solid_extents"] = BoxJson(overall),
                ["total"] = elements.Count,
                ["offset"] = offset,
                ["returned"] = items.Count,
                ["forms"] = items,
            };
        }

        private static JsonObject FormJson(Document doc, FamilyManager fm, Element e, bool curves)
        {
            var o = new JsonObject { ["id"] = e.Id.Value, ["kind"] = e.GetType().Name };
            var box = e.get_BoundingBox(null);
            if (box != null) o["extents"] = BoxJson(box);
            if (e is GenericForm g)
            {
                o["solid"] = g.IsSolid;
                o["visible"] = g.Visible;
                if (g.Subcategory != null) o["subcategory"] = g.Subcategory.Name;
                var mat = e.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM);
                if (mat != null)
                {
                    var m = doc.GetElement(mat.AsElementId());
                    o["material"] = m?.Name;
                }
                var drivers = new JsonObject();
                foreach (Parameter q in e.Parameters)
                {
                    FamilyParameter fp = null;
                    try { fp = fm.GetAssociatedFamilyParameter(q); } catch { }
                    if (fp != null) drivers[q.Definition.Name] = fp.Definition.Name;
                }
                if (drivers.Count > 0) o["driven_by"] = drivers;
                if (e is Extrusion x)
                {
                    o["start_mm"] = ToMm(x.StartOffset);
                    o["end_mm"] = ToMm(x.EndOffset);
                    o["depth_mm"] = ToMm(Math.Abs(x.EndOffset - x.StartOffset));
                }
                // Every Sketch the form owns (Sketch, ProfileSketch, PathSketch, TopSketch, BottomSketch...), read by
                // reflection so all form kinds share one path.
                var sketches = new JsonObject();
                foreach (var prop in e.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
                {
                    if (prop.PropertyType != typeof(Sketch) || prop.GetIndexParameters().Length > 0) continue;
                    Sketch s = null;
                    try { s = prop.GetValue(e) as Sketch; } catch { }
                    if (s != null) sketches[prop.Name] = SketchJson(s, curves);
                }
                foreach (var prop in new[] { "TopOffset", "BottomOffset", "StartAngle", "EndAngle" })
                {
                    var pi = e.GetType().GetProperty(prop);
                    if (pi?.PropertyType != typeof(double)) continue;
                    try
                    {
                        var val = (double)pi.GetValue(e);
                        o[ToSnake(prop) + (prop.EndsWith("Angle") ? "_deg" : "_mm")] = prop.EndsWith("Angle") ? Math.Round(val * 180 / Math.PI, 4) : ToMm(val);
                    }
                    catch { }
                }
                if (sketches.Count > 0) o["sketches"] = sketches;
            }
            else if (e is FamilyInstance fi)
            {
                o["family"] = fi.Symbol?.FamilyName;
                o["type"] = fi.Symbol?.Name;
                o["category"] = fi.Category?.Name;
                if (fi.Location is LocationPoint lp)
                {
                    o["point"] = PointJson(lp.Point);
                    o["rotation_deg"] = Math.Round(lp.Rotation * 180 / Math.PI, 4);
                }
                var t = fi.GetTotalTransform();
                o["facing"] = DirectionJson(t.BasisY);
            }
            return o;
        }

        private static string ToSnake(string name) =>
            string.Concat(name.Select((c, i) => i > 0 && char.IsUpper(c) ? "_" + char.ToLowerInvariant(c) : char.ToLowerInvariant(c).ToString()));

        /// <summary>A sketch's plane and its loops, each measured in the plane; identical loops are also grouped by size.</summary>
        private static JsonObject SketchJson(Sketch sketch, bool curves)
        {
            var plane = sketch.SketchPlane.GetPlane();
            var loops = new JsonArray();
            var polys = new List<List<UV>>();
            var raw = new List<CurveArray>();
            foreach (CurveArray loop in sketch.Profile)
            {
                var pts = new List<UV>();
                foreach (Curve c in loop)
                {
                    var t = c.Tessellate();
                    foreach (var q in t.Take(t.Count - 1))
                    {
                        if (pts.Count >= MaxLoopPoints) break;
                        var d = q - plane.Origin;
                        pts.Add(new UV(d.DotProduct(plane.XVec), d.DotProduct(plane.YVec)));
                    }
                }
                polys.Add(pts);
                raw.Add(loop);
            }
            var groups = new Dictionary<string, int>();
            for (var i = 0; i < polys.Count; i++)
            {
                var pts = polys[i];
                if (pts.Count < 2) continue;
                var (w, h) = MinRect(pts);
                var area = Math.Abs(Shoelace(pts));
                var c = Centroid(pts);
                var centre = plane.Origin + plane.XVec * c.U + plane.YVec * c.V;
                var lo = new JsonObject
                {
                    ["w_mm"] = ToMm(Math.Max(w, h)),
                    ["h_mm"] = ToMm(Math.Min(w, h)),
                    ["area_mm2"] = Math.Round(area * MmPerFoot * MmPerFoot, 1),
                    ["centre"] = PointJson(centre),
                    ["curves"] = raw[i].Size,
                };
                var inside = Enumerable.Range(0, polys.Count).Where(j => j != i && polys[j].Count > 2 && Contains(polys[j], pts[0])).ToList();
                if (inside.Count > 0) lo["inside_loop"] = inside[0];
                if (curves) lo["curve_list"] = CurvesJson(raw[i]);
                loops.Add(lo);
                var key = $"{lo["w_mm"]!.GetValue<double>():0.#} x {lo["h_mm"]!.GetValue<double>():0.#}" + (inside.Count > 0 ? " (hole)" : "");
                groups[key] = groups.TryGetValue(key, out var n) ? n + 1 : 1;
            }
            return new JsonObject
            {
                ["plane_origin"] = PointJson(plane.Origin),
                ["plane_normal"] = DirectionJson(plane.Normal),
                ["plane_x"] = DirectionJson(plane.XVec),
                ["loop_count"] = loops.Count,
                ["loop_sizes"] = new JsonObject(groups.OrderByDescending(g => g.Value).Select(g => new KeyValuePair<string, JsonNode>(g.Key, g.Value))),
                ["loops"] = loops,
            };
        }

        private static JsonArray CurvesJson(CurveArray loop)
        {
            var list = new JsonArray();
            foreach (Curve c in loop)
            {
                var o = new JsonObject { ["kind"] = c.GetType().Name, ["start"] = PointJson(c.GetEndPoint(0)), ["end"] = PointJson(c.GetEndPoint(1)), ["length_mm"] = ToMm(c.Length) };
                if (c is Arc a) { o["centre"] = PointJson(a.Center); o["radius_mm"] = ToMm(a.Radius); }
                list.Add(o);
            }
            return list;
        }

        private static double Shoelace(List<UV> pts)
        {
            double s = 0;
            for (var i = 0; i < pts.Count; i++) { var a = pts[i]; var b = pts[(i + 1) % pts.Count]; s += a.U * b.V - b.U * a.V; }
            return s / 2;
        }

        private static UV Centroid(List<UV> pts)
        {
            var a = Shoelace(pts);
            if (Math.Abs(a) < 1e-12) return new UV(pts.Average(q => q.U), pts.Average(q => q.V));
            double cx = 0, cy = 0;
            for (var i = 0; i < pts.Count; i++)
            {
                var p0 = pts[i]; var p1 = pts[(i + 1) % pts.Count];
                var f = p0.U * p1.V - p1.U * p0.V;
                cx += (p0.U + p1.U) * f; cy += (p0.V + p1.V) * f;
            }
            return new UV(cx / (6 * a), cy / (6 * a));
        }

        /// <summary>Minimum-area enclosing rectangle over the loop's own edge directions: exact for polygons, close for arcs.</summary>
        private static (double, double) MinRect(List<UV> pts)
        {
            double bestA = double.MaxValue, bw = 0, bh = 0;
            for (var i = 0; i < pts.Count; i++)
            {
                var e = pts[(i + 1) % pts.Count] - pts[i];
                var len = Math.Sqrt(e.U * e.U + e.V * e.V);
                if (len < 1e-9) continue;
                double ux = e.U / len, uy = e.V / len;
                double minU = double.MaxValue, maxU = double.MinValue, minV = double.MaxValue, maxV = double.MinValue;
                foreach (var q in pts)
                {
                    var u = q.U * ux + q.V * uy; var v = -q.U * uy + q.V * ux;
                    minU = Math.Min(minU, u); maxU = Math.Max(maxU, u); minV = Math.Min(minV, v); maxV = Math.Max(maxV, v);
                }
                var area = (maxU - minU) * (maxV - minV);
                if (area < bestA) { bestA = area; bw = maxU - minU; bh = maxV - minV; }
            }
            return (bw, bh);
        }

        private static bool Contains(List<UV> poly, UV q)
        {
            var inside = false;
            for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
            {
                if ((poly[i].V > q.V) != (poly[j].V > q.V) &&
                    q.U < (poly[j].U - poly[i].U) * (q.V - poly[i].V) / (poly[j].V - poly[i].V) + poly[i].U) inside = !inside;
            }
            return inside;
        }

        private static BoundingBoxXYZ Union(BoundingBoxXYZ a, BoundingBoxXYZ b)
        {
            if (b == null) return a;
            if (a == null) return new BoundingBoxXYZ { Min = b.Min, Max = b.Max };
            a.Min = new XYZ(Math.Min(a.Min.X, b.Min.X), Math.Min(a.Min.Y, b.Min.Y), Math.Min(a.Min.Z, b.Min.Z));
            a.Max = new XYZ(Math.Max(a.Max.X, b.Max.X), Math.Max(a.Max.Y, b.Max.Y), Math.Max(a.Max.Z, b.Max.Z));
            return a;
        }

        private static JsonObject BoxJson(BoundingBoxXYZ box) => box == null ? null : new JsonObject
        {
            ["min"] = PointJson(box.Min),
            ["max"] = PointJson(box.Max),
            ["size"] = new JsonObject { ["x"] = ToMm(box.Max.X - box.Min.X), ["y"] = ToMm(box.Max.Y - box.Min.Y), ["z"] = ToMm(box.Max.Z - box.Min.Z) },
        };

        // ---- family_dimensions ----------------------------------------------------------------------

        /// <summary>
        /// family_dimensions: the family's dimensions (value, label parameter, view) and reference planes (name, plane,
        /// "Is Reference" setting), the skeleton the parameters drive. Params: source, labelled_only.
        /// </summary>
        private static JsonNode FamilyDimensions(UIApplication app, JsonObject p) => WithFamily(app, p, false, doc => FamilyDimensionsOf(doc, p));

        private static JsonObject FamilyDimensionsOf(Document doc, JsonObject p)
        {
            var labelledOnly = Bool(p, "labelled_only");
            var dims = new JsonArray();
            foreach (var d in new FilteredElementCollector(doc).OfClass(typeof(Dimension)).Cast<Dimension>())
            {
                FamilyParameter label = null;
                try { label = d.FamilyLabel; } catch { }
                if (labelledOnly && label == null) continue;
                var angular = d.DimensionShape == DimensionShape.Angular;
                double Conv(double v) => angular ? Math.Round(v * 180 / Math.PI, 4) : ToMm(v);
                var o = new JsonObject { ["id"] = d.Id.Value, ["unit"] = angular ? "deg" : "mm", ["view"] = d.View?.Name };
                if (label != null) o["label"] = label.Definition.Name;
                if (d.Value != null) o["value"] = Conv(d.Value.Value);
                else
                {
                    var segs = new JsonArray();
                    foreach (DimensionSegment s in d.Segments) if (s.Value != null) segs.Add(Conv(s.Value.Value));
                    o["segments"] = segs;
                    o["value"] = segs.Sum(n => n!.GetValue<double>());
                }
                if (d.AreSegmentsEqual) o["equal"] = true;
                dims.Add(o);
            }
            var planes = new JsonArray();
            foreach (var rp in new FilteredElementCollector(doc).OfClass(typeof(ReferencePlane)).Cast<ReferencePlane>())
            {
                var pl = rp.GetPlane();
                planes.Add(new JsonObject
                {
                    ["id"] = rp.Id.Value,
                    ["name"] = rp.Name,
                    ["normal"] = DirectionJson(pl.Normal),
                    ["offset_mm"] = ToMm(pl.Origin.DotProduct(pl.Normal)),
                    ["is_reference"] = rp.get_Parameter(BuiltInParameter.ELEM_REFERENCE_NAME)?.AsValueString(),
                    ["defines_origin"] = rp.get_Parameter(BuiltInParameter.DATUM_PLANE_DEFINES_ORIGIN)?.AsInteger() == 1 ? true : null,
                });
            }
            return new JsonObject { ["family"] = doc.Title, ["current_type"] = doc.FamilyManager.CurrentType?.Name, ["dimensions"] = dims, ["reference_planes"] = planes };
        }

        // ---- family_type_extents ---------------------------------------------------------------------

        /// <summary>
        /// family_type_extents: switch to each type, regenerate, measure the solid extents and length parameters, then roll
        /// everything back, so the family is left exactly as it was. Answers "which type is 3500 high".
        /// Params: source, types (optional names), match_height_mm (optional: mark the type(s) whose solid height is within
        /// tolerance_mm, default 1).
        /// </summary>
        private static JsonNode FamilyTypeExtents(UIApplication app, JsonObject p) => WithFamily(app, p, false, doc => FamilyTypeExtentsOf(doc, p));

        private static JsonObject FamilyTypeExtentsOf(Document doc, JsonObject p)
        {
            if (doc.IsReadOnly) throw new InvalidOperationException("The family document is read-only.");
            if (doc.IsModifiable) throw new InvalidOperationException("A transaction is already open on this family; finish it first.");
            var fm = doc.FamilyManager;
            var types = SelectTypes(fm, p);
            var match = Num(p, "match_height_mm");
            var tol = Num(p, "tolerance_mm") ?? 1;
            var lengths = fm.GetParameters().Where(fp => fp.StorageType == StorageType.Double && fp.Definition.GetDataType() == SpecTypeId.Length).ToList();
            var results = new JsonArray();
            var originalType = fm.CurrentType?.Name;
            var failures = new FailureCollector();
            using (var t = new Transaction(doc, "MCP: measure family types (rolled back)"))
            {
                var options = t.GetFailureHandlingOptions();
                options.SetFailuresPreprocessor(failures);
                options.SetClearAfterRollback(true);
                t.SetFailureHandlingOptions(options);
                t.Start();
                foreach (var type in types)
                {
                    var o = new JsonObject { ["type"] = type.Name };
                    try
                    {
                        fm.CurrentType = type;
                        doc.Regenerate();
                        BoundingBoxXYZ box = null;
                        foreach (var e in new FilteredElementCollector(doc).OfClass(typeof(GenericForm)).Cast<GenericForm>())
                            if (e.IsSolid && e.Visible) box = Union(box, e.get_BoundingBox(null));
                        foreach (var e in new FilteredElementCollector(doc).OfClass(typeof(FamilyInstance)))
                            box = Union(box, e.get_BoundingBox(null));
                        o["solid_extents"] = BoxJson(box);
                        var values = new JsonObject();
                        foreach (var fp in lengths) values[fp.Definition.Name] = TypeValue(doc, type, fp);
                        o["lengths_mm"] = values;
                        if (match != null && box != null)
                            o["matches_height"] = Math.Abs(ToMm(box.Max.Z - box.Min.Z) - match.Value) <= tol;
                    }
                    catch (Exception e) { o["error"] = e.Message; }
                    results.Add(o);
                }
                t.RollBack();
            }
            var r = new JsonObject { ["family"] = doc.Title, ["current_type"] = originalType, ["rolled_back"] = true, ["types"] = results };
            var notes = failures.Warnings.Concat(failures.Errors).Distinct().ToList();
            if (notes.Count > 0) r["warnings"] = new JsonArray(notes.Select(w => (JsonNode)w).ToArray());
            return r;
        }

        // ---- family_report ---------------------------------------------------------------------------

        /// <summary>
        /// family_report: types + parameters, forms (summary: no raw curves), dimensions and per-type extents in one call,
        /// from one open of the file. Params: source, include (types, forms, dimensions, extents; default all), types.
        /// </summary>
        private static JsonNode FamilyReport(UIApplication app, JsonObject p) => WithFamily(app, p, false, doc =>
        {
            var include = (p["include"] as JsonArray)?.Select(n => n.GetValue<string>().ToLowerInvariant()).ToHashSet()
                          ?? new HashSet<string> { "types", "forms", "dimensions", "extents" };
            var r = new JsonObject { ["family"] = doc.Title, ["category"] = doc.OwnerFamily?.FamilyCategory?.Name };
            if (include.Contains("types")) r["types"] = FamilyTypesOf(doc, p);
            if (include.Contains("forms"))
            {
                var fp = new JsonObject { ["limit"] = MaxLimit };
                r["forms"] = FamilyFormsOf(doc, fp);
            }
            if (include.Contains("dimensions")) r["dimensions"] = FamilyDimensionsOf(doc, p);
            if (include.Contains("extents")) r["extents"] = FamilyTypeExtentsOf(doc, p);
            return r;
        });

        // ---- set_family_parameters ------------------------------------------------------------------

        /// <summary>
        /// set_family_parameters: in an open family (document or active), optionally switch to / create a type, then set
        /// values or formulas. Lengths take mm, angles degrees, Yes/No true/false, element ids a name. One undo step;
        /// nothing is saved. Params: type (optional), create_type (bool), values [{name, value?, formula?}], keep_type (bool:
        /// leave the family on this type; default true).
        /// </summary>
        private static JsonNode SetFamilyParameters(UIApplication app, JsonObject p) => WithFamily(app, p, true, doc =>
        {
            var fm = doc.FamilyManager;
            var typeName = Str(p, "type");
            var values = p["values"] as JsonArray ?? throw new ArgumentException("values is required: [{name, value | formula}].");
            var set = new JsonArray(); var skipped = new JsonArray();
            var result = InTransaction(doc, $"Set family parameters{(typeName != null ? " " + typeName : "")}", () =>
            {
                if (typeName != null)
                {
                    var type = fm.Types.Cast<FamilyType>().FirstOrDefault(t => t.Name == typeName);
                    if (type == null)
                    {
                        if (!Bool(p, "create_type")) throw new ArgumentException($"No type named {typeName}; pass create_type to make it from the current type.");
                        type = fm.NewType(typeName);
                    }
                    fm.CurrentType = type;
                }
                foreach (var node in values)
                {
                    var o = node!.AsObject();
                    var name = o["name"]!.GetValue<string>();
                    var fp = fm.get_Parameter(name);
                    if (fp == null) { skipped.Add($"{name}: no such family parameter"); continue; }
                    try
                    {
                        if (o["formula"] != null)
                        {
                            fm.SetFormula(fp, o["formula"]!.GetValue<string>());
                        }
                        else
                        {
                            var v = o["value"] ?? throw new ArgumentException("value or formula is required");
                            var spec = fp.Definition.GetDataType();
                            switch (fp.StorageType)
                            {
                                case StorageType.Double:
                                    var d = v.GetValue<double>();
                                    fm.Set(fp, spec == SpecTypeId.Length ? d / MmPerFoot : spec == SpecTypeId.Angle ? d * Math.PI / 180 : d);
                                    break;
                                case StorageType.Integer:
                                    fm.Set(fp, v.GetValueKind() == System.Text.Json.JsonValueKind.True ? 1 : v.GetValueKind() == System.Text.Json.JsonValueKind.False ? 0 : v.GetValue<int>());
                                    break;
                                case StorageType.String:
                                    fm.Set(fp, v.GetValue<string>());
                                    break;
                                case StorageType.ElementId:
                                    var target = v.GetValue<string>();
                                    var hit = new FilteredElementCollector(doc).WhereElementIsElementType().FirstOrDefault(x => x.Name == target)
                                              ?? new FilteredElementCollector(doc).OfClass(typeof(Material)).FirstOrDefault(x => x.Name == target)
                                              ?? throw new ArgumentException($"no element named {target}");
                                    fm.Set(fp, hit.Id);
                                    break;
                            }
                        }
                        set.Add(name);
                    }
                    catch (Exception e) { skipped.Add($"{name}: {e.Message}"); }
                }
                doc.Regenerate();
                var now = new JsonObject();
                foreach (var node in values)
                {
                    var name = node!["name"]!.GetValue<string>();
                    var fp = fm.get_Parameter(name);
                    if (fp != null) now[name] = TypeValue(doc, fm.CurrentType, fp);
                }
                return new JsonObject { ["type"] = fm.CurrentType?.Name, ["set"] = set, ["skipped"] = skipped, ["values_now"] = now };
            });
            return (JsonObject)result;
        });
    }
}
