// PROPOSAL ONLY. No checkout installation, build, deployment or Revit execution by this task.
// Registrations in Handlers.Table:
// ["ensure_basic_surface_type"] = EnsureBasicSurfaceType,
// ["create_ceiling"] = CreateCeilingSurface,
// ["create_floor_surface"] = CreateFloorSurface,
// All commands require document: exact full path of the open writable project.
// Types: { kind: "floor"|"ceiling", name, thickness_mm }.
// Instances: { level_id, type_id, boundary:[{x,y,z?}], holes?:[[{x,y,z?}]],
//              height_above_level_mm, mark?, comments? }.
// Boundary Z must be the selected level's elevation, not the finished/offset surface elevation.
// Omitted Z means 0 mm, so omit it only for a zero-elevation level. Offset controls actual hosting.
// Floors default offset to 0; ceilings require an explicit offset. Straight-edged horizontal polygons only.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    internal static partial class Handlers
    {
        private static Document SurfaceDocumentP04(UIApplication app, JsonObject p)
        {
            var target = ReqStr(p, "document");
            if (string.IsNullOrWhiteSpace(target) || !Path.IsPathFullyQualified(target))
                throw new ArgumentException("document must be the exact full path of an open project.");
            var doc = Doc(app);
            if (doc.IsReadOnly || doc.IsLinked || doc.IsFamilyDocument ||
                !string.Equals(doc.PathName, target, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("document must identify the exact open writable project.");
            return doc;
        }

        private static double SurfaceNumberP04(JsonObject p, string key, bool positive)
        {
            var value = ReqNum(p, key);
            if (!double.IsFinite(value) || (positive && value <= 0))
                throw new ArgumentException($"{key} must be finite" + (positive ? " and greater than zero." : "."));
            return value;
        }

        private static bool SurfaceDefinitionMatchesP04(HostObjAttributes type, double thickness)
        {
            var cs = type.GetCompoundStructure();
            if (cs == null || !cs.IsVerticallyHomogeneous() || cs.LayerCount != 1 ||
                cs.VariableLayerIndex != -1 || cs.HasStructuralDeck || Math.Abs(cs.GetWidth() - thickness) > FromMm(0.01))
                return false;
            var layer = cs.GetLayers()[0];
            return Math.Abs(layer.Width - thickness) <= FromMm(0.01) &&
                layer.Function == MaterialFunctionAssignment.Finish1 &&
                layer.MaterialId != null && layer.MaterialId.Value == ElementId.InvalidElementId.Value;
        }

        private static JsonNode EnsureBasicSurfaceType(UIApplication app, JsonObject p)
        {
            var doc = SurfaceDocumentP04(app, p);
            var kind = ReqStr(p, "kind").ToLowerInvariant();
            if (kind != "floor" && kind != "ceiling") throw new ArgumentException("kind must be floor or ceiling.");
            var name = ReqStr(p, "name");
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("name must not be blank.");
            var thickness = FromMm(SurfaceNumberP04(p, "thickness_mm", true));
            var types = new FilteredElementCollector(doc).OfClass(kind == "floor" ? typeof(FloorType) : typeof(CeilingType))
                .Cast<HostObjAttributes>().ToList();
            var matches = types.Where(t => string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase)).ToList();
            if (matches.Count > 1) throw new ArgumentException("Several surface types match this name.");
            JsonObject Result(HostObjAttributes type, bool created) => new JsonObject
            {
                ["id"] = type.Id.Value, ["name"] = type.Name, ["kind"] = kind,
                ["document"] = doc.PathName, ["created"] = created,
                ["thickness_mm"] = ToMm(type.GetCompoundStructure().GetWidth()),
                ["layer_count"] = 1, ["function"] = "Finish1", ["material"] = "By Category",
                ["performance_ratings_validated"] = false,
                ["note"] = "Generic single-layer WIP definition; source construction, fire, acoustic and thermal performance are not established."
            };
            if (matches.Count == 1)
            {
                if ((matches[0] is FloorType ft && ft.IsFoundationSlab) || !SurfaceDefinitionMatchesP04(matches[0], thickness))
                    throw new ArgumentException("Existing named type differs in kind, uniform layer, width, function or material; it was not changed.");
                return Result(matches[0], false);
            }
            // Structural/nonstructural is an INSTANCE flag for ordinary floors. Select Revit's
            // nonstructural default floor seed, excluding foundations/decks, and enforce flag 0 on creation.
            HostObjAttributes seed = kind == "floor"
                ? doc.GetElement(Floor.GetDefaultFloorType(doc, false)) as FloorType
                : types.FirstOrDefault(t => t.GetCompoundStructure() != null);
            if (seed == null || (seed is FloorType seedFloor && seedFloor.IsFoundationSlab) ||
                seed.GetCompoundStructure() == null || seed.GetCompoundStructure().HasStructuralDeck)
                throw new InvalidOperationException("No suitable compound non-foundation/non-deck surface seed is available.");
            return InTransaction(doc, "Ensure single-layer WIP " + kind + " type", () =>
            {
                var type = seed.Duplicate(name) as HostObjAttributes
                    ?? throw new InvalidOperationException("Failed to duplicate the surface type.");
                var cs = CompoundStructure.CreateSimpleCompoundStructure(new List<CompoundStructureLayer>
                {
                    new CompoundStructureLayer(thickness, MaterialFunctionAssignment.Finish1, ElementId.InvalidElementId)
                });
                cs.VariableLayerIndex = -1;
                // A simple structure defaults to wall end wrapping. Preserve the valid
                // host-kind setting from the seed (floors require NoEndCap).
                cs.EndCap = seed.GetCompoundStructure().EndCap;
                type.SetCompoundStructure(cs);
                // Clear common copied identification/performance text on the NEW type only.
                foreach (var id in new[] { BuiltInParameter.FIRE_RATING, BuiltInParameter.ALL_MODEL_DESCRIPTION,
                    BuiltInParameter.ALL_MODEL_MANUFACTURER, BuiltInParameter.ALL_MODEL_MODEL, BuiltInParameter.ALL_MODEL_TYPE_MARK })
                {
                    var parameter = type.get_Parameter(id);
                    if (parameter != null && !parameter.IsReadOnly && parameter.StorageType == StorageType.String)
                        parameter.Set("");
                }
                var notes = type.get_Parameter(BuiltInParameter.ALL_MODEL_TYPE_COMMENTS);
                if (notes != null && !notes.IsReadOnly && notes.StorageType == StorageType.String)
                    notes.Set("WIP generic single layer, material By Category. No verified project performance ratings.");
                doc.Regenerate();
                if (!SurfaceDefinitionMatchesP04(type, thickness))
                    throw new InvalidOperationException("Created type failed uniform single-layer thickness/material verification.");
                return Result(type, true);
            });
        }

        private static double SurfaceCrossP04(XYZ a, XYZ b, XYZ c) =>
            (b.X - a.X) * (c.Y - a.Y) - (b.Y - a.Y) * (c.X - a.X);

        private static bool SurfaceOnSegmentP04(XYZ p, XYZ a, XYZ b, double tol)
        {
            var length = a.DistanceTo(b);
            return Math.Abs(SurfaceCrossP04(a, b, p)) <= tol * length &&
                p.X >= Math.Min(a.X, b.X) - tol && p.X <= Math.Max(a.X, b.X) + tol &&
                p.Y >= Math.Min(a.Y, b.Y) - tol && p.Y <= Math.Max(a.Y, b.Y) + tol;
        }

        private static bool SurfaceSegmentsTouchP04(XYZ a, XYZ b, XYZ c, XYZ d, double tol) =>
            SurfaceOnSegmentP04(a, c, d, tol) || SurfaceOnSegmentP04(b, c, d, tol) ||
            SurfaceOnSegmentP04(c, a, b, tol) || SurfaceOnSegmentP04(d, a, b, tol) ||
            ((SurfaceCrossP04(a, b, c) > 0) != (SurfaceCrossP04(a, b, d) > 0) &&
             (SurfaceCrossP04(c, d, a) > 0) != (SurfaceCrossP04(c, d, b) > 0));

        private static double SurfaceSignedAreaP04(IList<XYZ> ring)
        {
            double twice = 0;
            for (var i = 0; i < ring.Count; i++)
                twice += ring[i].X * ring[(i + 1) % ring.Count].Y - ring[(i + 1) % ring.Count].X * ring[i].Y;
            return twice / 2;
        }

        private static bool SurfaceInsideP04(XYZ p, IList<XYZ> ring)
        {
            var inside = false;
            for (var i = 0; i < ring.Count; i++)
            {
                var a = ring[i]; var b = ring[(i + 1) % ring.Count];
                if ((a.Y > p.Y) != (b.Y > p.Y) && p.X < (b.X - a.X) * (p.Y - a.Y) / (b.Y - a.Y) + a.X)
                    inside = !inside;
            }
            return inside;
        }

        private static List<CurveLoop> SurfaceLoopsP04(UIApplication app, JsonObject p, Level level)
        {
            var tol = Math.Max(app.Application.ShortCurveTolerance, FromMm(0.01));
            var planeTol = FromMm(0.01);
            var arrays = new List<JsonArray> { p["boundary"] as JsonArray ?? throw new ArgumentException("boundary is required.") };
            if (p["holes"] != null)
                foreach (var hole in p["holes"].AsArray())
                    arrays.Add(hole as JsonArray ?? throw new ArgumentException("Each hole must be a polygon array."));
            var rings = new List<List<XYZ>>();
            foreach (var array in arrays)
            {
                if (array.Count < 3) throw new ArgumentException("Each polygon needs at least three corners, listed once.");
                var ring = array.Select(node =>
                {
                    var o = node?.AsObject() ?? throw new ArgumentException("Every corner must be a point object.");
                    var x = SurfaceNumberP04(o, "x", false); var y = SurfaceNumberP04(o, "y", false);
                    var z = Num(o, "z") ?? 0;
                    if (!double.IsFinite(z)) throw new ArgumentException("Point z must be finite.");
                    if (Math.Abs(FromMm(z) - level.Elevation) > planeTol)
                        throw new ArgumentException("All polygon Z values must equal the selected level elevation; use height_above_level_mm for surface offset.");
                    return new XYZ(FromMm(x), FromMm(y), level.Elevation);
                }).ToList();
                for (var i = 0; i < ring.Count; i++)
                {
                    if (ring[i].DistanceTo(ring[(i + 1) % ring.Count]) <= tol)
                        throw new ArgumentException("Polygon has a duplicate corner or a segment below Revit short-curve tolerance.");
                    for (var j = i + 1; j < ring.Count; j++)
                    {
                        if (j == i + 1 || (i == 0 && j == ring.Count - 1)) continue;
                        if (SurfaceSegmentsTouchP04(ring[i], ring[(i + 1) % ring.Count], ring[j], ring[(j + 1) % ring.Count], tol))
                            throw new ArgumentException("A polygon self-intersects or touches itself.");
                    }
                }
                if (Math.Abs(SurfaceSignedAreaP04(ring)) <= tol * tol)
                    throw new ArgumentException("Polygon has zero or negligible area.");
                rings.Add(ring);
            }
            for (var h = 1; h < rings.Count; h++)
            {
                if (!SurfaceInsideP04(rings[h][0], rings[0]))
                    throw new ArgumentException("Every hole must be strictly inside the outer boundary.");
                for (var k = 0; k < h; k++)
                {
                    for (var i = 0; i < rings[h].Count; i++)
                        for (var j = 0; j < rings[k].Count; j++)
                            if (SurfaceSegmentsTouchP04(rings[h][i], rings[h][(i + 1) % rings[h].Count],
                                rings[k][j], rings[k][(j + 1) % rings[k].Count], tol))
                                throw new ArgumentException("Polygon loops intersect or touch.");
                    if (k > 0 && (SurfaceInsideP04(rings[h][0], rings[k]) || SurfaceInsideP04(rings[k][0], rings[h])))
                        throw new ArgumentException("Nested holes or islands are unsupported.");
                }
            }
            var netArea = Math.Abs(SurfaceSignedAreaP04(rings[0])) - rings.Skip(1).Sum(r => Math.Abs(SurfaceSignedAreaP04(r)));
            if (netArea <= tol * tol) throw new ArgumentException("Net surface area must be positive.");
            var loops = new List<CurveLoop>();
            for (var r = 0; r < rings.Count; r++)
            {
                var ring = rings[r];
                if ((SurfaceSignedAreaP04(ring) > 0) != (r == 0)) ring.Reverse();
                var loop = new CurveLoop();
                for (var i = 0; i < ring.Count; i++) loop.Append(Line.CreateBound(ring[i], ring[(i + 1) % ring.Count]));
                loops.Add(loop);
            }
            if (!BoundaryValidation.IsValidHorizontalBoundary(loops))
                throw new ArgumentException("Revit rejected the horizontal boundary loops.");
            return loops;
        }

        private static JsonNode CreateCeilingSurface(UIApplication app, JsonObject p) => CreateNativeSurfaceP04(app, p, false);
        private static JsonNode CreateFloorSurface(UIApplication app, JsonObject p) => CreateNativeSurfaceP04(app, p, true);

        private static JsonNode CreateNativeSurfaceP04(UIApplication app, JsonObject p, bool floor)
        {
            var doc = SurfaceDocumentP04(app, p);
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var type = RequireElement(doc, ReqId(p, "type_id")) as HostObjAttributes;
            if (type == null || (floor ? !(type is FloorType) : !(type is CeilingType)))
                throw new ArgumentException("type_id must be the corresponding FloorType/CeilingType in this document.");
            if (type is FloorType ft && ft.IsFoundationSlab) throw new ArgumentException("Foundation slab types are unsupported.");
            var cs = type.GetCompoundStructure();
            if (cs == null || cs.HasStructuralDeck || !SurfaceDefinitionMatchesP04(type, cs.GetWidth()))
                throw new ArgumentException("Use a verified uniform single-layer By Category Finish1 surface type from ensure_basic_surface_type.");
            var offsetMm = floor && p["height_above_level_mm"] == null ? 0 : SurfaceNumberP04(p, "height_above_level_mm", false);
            var loops = SurfaceLoopsP04(app, p, level);
            return InTransaction(doc, floor ? "Create native nonstructural floor surface" : "Create native ceiling surface", () =>
            {
                Element element = floor ? Floor.Create(doc, loops, type.Id, level.Id) : Ceiling.Create(doc, loops, type.Id, level.Id);
                var heightId = floor ? BuiltInParameter.FLOOR_HEIGHTABOVELEVEL_PARAM : BuiltInParameter.CEILING_HEIGHTABOVELEVEL_PARAM;
                var height = element.get_Parameter(heightId);
                if (height == null || height.IsReadOnly || !height.Set(FromMm(offsetMm)))
                    throw new InvalidOperationException("Cannot set the native level offset.");
                if (floor)
                {
                    var structural = element.get_Parameter(BuiltInParameter.FLOOR_PARAM_IS_STRUCTURAL);
                    if (structural == null || structural.IsReadOnly || !structural.Set(0) || structural.AsInteger() != 0)
                        throw new InvalidOperationException("Cannot confirm nonstructural floor instance flag.");
                }
                foreach (var item in new[] { ("mark", BuiltInParameter.ALL_MODEL_MARK), ("comments", BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS) })
                {
                    var value = Str(p, item.Item1);
                    if (value == null) continue;
                    var parameter = element.get_Parameter(item.Item2);
                    if (parameter == null || parameter.IsReadOnly || !parameter.Set(value))
                        throw new InvalidOperationException("Cannot set " + item.Item1 + ".");
                }
                doc.Regenerate();
                if (Math.Abs(height.AsDouble() - FromMm(offsetMm)) > FromMm(0.01))
                    throw new InvalidOperationException("Native surface offset readback differs from request.");
                var box = element.get_BoundingBox(null);
                return new JsonObject
                {
                    ["id"] = element.Id.Value, ["native_class"] = element.GetType().FullName,
                    ["document"] = doc.PathName, ["type_id"] = type.Id.Value, ["level_id"] = level.Id.Value,
                    ["height_above_level_mm"] = ToMm(height.AsDouble()), ["profile_level_z_mm"] = ToMm(level.Elevation),
                    ["thickness_mm"] = ToMm(cs.GetWidth()), ["holes"] = loops.Count - 1,
                    ["nonstructural_instance"] = floor ? JsonValue.Create(true) : null,
                    ["bounding_box"] = box == null ? null : new JsonObject { ["min"] = PointJson(box.Min), ["max"] = PointJson(box.Max) },
                    ["note"] = "Native WIP geometry. Read native bounding faces/offset reference before claiming source floor or ceiling finish elevation; no construction/performance rating validation."
                };
            });
        }
    }
}
