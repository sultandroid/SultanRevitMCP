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
        // Read actual CAD vectors by layer without exploding the import or changing the model.
        private static JsonNode InspectCadGeometry(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var import = RequireElement(doc, ReqId(p, "element_id")) as ImportInstance
                ?? throw new ArgumentException("element_id must be a CAD import/link.");
            var filter = Str(p, "layer_contains");
            var limit = Math.Clamp((int)(Num(p, "limit") ?? 100), 0, 50000);
            var offset = Math.Max(0, (int)(Num(p, "offset") ?? 0));
            var includeMeshes = p["include_meshes"]?.GetValue<bool>() ?? false;
            var includeSurfaces = p["include_surfaces"]?.GetValue<bool>() ?? false;
            var counts = new Dictionary<string, int>();
            var nonCurves = new Dictionary<string, int>();
            var result = new JsonArray(); int matched = 0;
            void Walk(GeometryElement geometry, Transform transform, string parentLayer)
            {
                if (geometry == null) return;
                foreach (GeometryObject obj in geometry)
                {
                    var style = doc.GetElement(obj.GraphicsStyleId) as GraphicsStyle;
                    var layer = style?.GraphicsStyleCategory?.Name ?? parentLayer;
                    if (obj is GeometryInstance gi)
                    { Walk(gi.GetSymbolGeometry(), transform.Multiply(gi.Transform), layer); continue; }
                    if (!(obj is Curve) && !(obj is PolyLine))
                    {
                        var key = layer + " | " + obj.GetType().Name;
                        nonCurves[key] = nonCurves.TryGetValue(key, out var n) ? n + 1 : 1;
                        if (!(includeMeshes && obj is Mesh) && !(includeSurfaces && obj is Solid)) continue;
                    }
                    counts[layer] = counts.TryGetValue(layer, out var count) ? count + 1 : 1;
                    if (filter != null && layer.IndexOf(filter, StringComparison.OrdinalIgnoreCase) < 0) continue;
                    var index = matched++;
                    if (index < offset || result.Count >= limit) continue;
                    var row = new JsonObject { ["layer"] = layer, ["kind"] = obj.GetType().Name };
                    if (obj is Solid solid)
                    {
                        var faces = new JsonArray();
                        foreach (Face face in solid.Faces)
                        {
                            if (!(face is PlanarFace planar) || transform.OfVector(planar.FaceNormal).Normalize().Z < 0.9) continue;
                            var loops = new JsonArray();
                            foreach (var loop in face.GetEdgesAsCurveLoops())
                            {
                                var points = new JsonArray();
                                foreach (var curve in loop)
                                {
                                    var tessellated = curve.Tessellate();
                                    for (int i = 0; i < tessellated.Count - 1; i++) points.Add(PointJson(transform.OfPoint(tessellated[i])));
                                }
                                if (points.Count > 0) points.Add(points[0].DeepClone());
                                loops.Add(points);
                            }
                            faces.Add(new JsonObject { ["loops"] = loops, ["source_area_mm2"] = face.Area * MmPerFoot * MmPerFoot });
                        }
                        row["horizontal_faces"] = faces;
                    }
                    else if (obj is Mesh mesh)
                    {
                        // Hatch meshes repeat internal triangle edges. Return only their boundary.
                        var edges = new Dictionary<string, (int Count, XYZ Start, XYZ End)>();
                        string Key(XYZ pt) => $"{Math.Round(pt.X, 9):R},{Math.Round(pt.Y, 9):R},{Math.Round(pt.Z, 9):R}";
                        for (int i = 0; i < mesh.NumTriangles; i++)
                        {
                            var tri = mesh.get_Triangle(i);
                            for (int j = 0; j < 3; j++)
                            {
                                var a = tri.get_Vertex(j); var b = tri.get_Vertex((j + 1) % 3);
                                var ka = Key(a); var kb = Key(b); var k = string.CompareOrdinal(ka, kb) < 0 ? ka + ";" + kb : kb + ";" + ka;
                                edges[k] = edges.TryGetValue(k, out var edge) ? (edge.Count + 1, a, b) : (1, a, b);
                            }
                        }
                        var boundary = new JsonArray();
                        foreach (var edge in edges.Values.Where(e => e.Count == 1))
                            boundary.Add(new JsonObject { ["start"] = PointJson(transform.OfPoint(edge.Start)), ["end"] = PointJson(transform.OfPoint(edge.End)) });
                        row["boundary_edges"] = boundary; row["triangle_count"] = mesh.NumTriangles;
                    }
                    else if (obj is PolyLine pl)
                    { var pts = new JsonArray(); foreach (var pt in pl.GetCoordinates()) pts.Add(PointJson(transform.OfPoint(pt))); row["points"] = pts; }
                    else if (obj is Curve curve && curve.IsBound)
                    {
                        row["start"] = PointJson(transform.OfPoint(curve.GetEndPoint(0)));
                        row["end"] = PointJson(transform.OfPoint(curve.GetEndPoint(1)));
                        if (curve is Arc arc) { row["center"] = PointJson(transform.OfPoint(arc.Center)); row["radius_mm"] = ToMm(arc.Radius); }
                    }
                    result.Add(row);
                }
            }
            Walk(import.get_Geometry(new Options { IncludeNonVisibleObjects = true }), Transform.Identity, "(unknown)");
            var stats = new JsonArray();
            foreach (var pair in counts.OrderByDescending(x => x.Value)) stats.Add(new JsonObject { ["layer"] = pair.Key, ["count"] = pair.Value });
            var other = new JsonArray();
            foreach (var pair in nonCurves.OrderByDescending(x => x.Value)) other.Add(new JsonObject { ["layer_and_kind"] = pair.Key, ["count"] = pair.Value });
            return new JsonObject { ["element_id"] = import.Id.Value, ["units"] = "mm", ["layers"] = stats,
                ["matched"] = matched, ["offset"] = offset, ["returned"] = result.Count, ["non_curve_objects"] = other, ["geometry"] = result };
        }

        private static JsonNode SetElementsPinned(UIApplication app, JsonObject p)
        {
            var doc = Doc(app); var ids = ReqIds(p, "element_ids"); var pinned = p["pinned"]?.GetValue<bool>() ?? true;
            return InTransaction(doc, "Set element pin state", () =>
            {
                var values = new JsonArray();
                foreach (var id in ids) { var e = RequireElement(doc, id); e.Pinned = pinned; values.Add(new JsonObject { ["id"] = id.Value, ["pinned"] = e.Pinned }); }
                return new JsonObject { ["elements"] = values };
            });
        }

        private static JsonNode InspectDatums(UIApplication app, JsonObject p)
        {
            var host = Doc(app); var doc = host; var transform = Transform.Identity;
            var linkId = OptId(p, "link_instance_id");
            if (linkId != null)
            {
                var link = RequireElement(host, linkId) as RevitLinkInstance ?? throw new ArgumentException("Not a Revit link.");
                doc = link.GetLinkDocument() ?? throw new ArgumentException("Link is unloaded."); transform = link.GetTotalTransform();
            }
            var grids = new JsonArray();
            foreach (var g in new FilteredElementCollector(doc).OfClass(typeof(Grid)).Cast<Grid>())
                grids.Add(new JsonObject { ["id"] = g.Id.Value, ["name"] = g.Name, ["pinned"] = g.Pinned,
                    ["start"] = PointJson(transform.OfPoint(g.Curve.GetEndPoint(0))), ["end"] = PointJson(transform.OfPoint(g.Curve.GetEndPoint(1))) });
            var levels = new JsonArray();
            foreach (var l in new FilteredElementCollector(doc).OfClass(typeof(Level)).Cast<Level>())
                levels.Add(new JsonObject { ["id"] = l.Id.Value, ["name"] = l.Name, ["elevation_mm"] = ToMm(l.Elevation) });
            return new JsonObject { ["source_document"] = doc.Title, ["grids_in_host_coordinates"] = grids, ["levels_in_source_coordinates"] = levels };
        }
    }
}
