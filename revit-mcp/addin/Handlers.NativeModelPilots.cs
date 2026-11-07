using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Mechanical;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    internal static partial class Handlers
    {
        // These new authoring commands deliberately have no active-document fallback.
        private static Document RequireNativePilotDocument(UIApplication app, JsonObject p)
        {
            var target = ReqStr(p, "document");
            if (string.IsNullOrWhiteSpace(target) || !Path.IsPathFullyQualified(target))
                throw new ArgumentException("document must be the exact full path of the open target RVT.");
            var doc = Doc(app);
            if (doc.IsFamilyDocument || doc.IsLinked || doc.IsReadOnly ||
                !string.Equals(doc.PathName, target, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("document must identify an open, writable project by its exact full path.");
            return doc;
        }

        private static double PositivePilotMillimetres(JsonObject p, string key)
        {
            var value = ReqNum(p, key);
            if (!double.IsFinite(value) || value <= 0)
                throw new ArgumentException($"{key} must be finite and greater than zero.");
            return value;
        }

        /// <summary>One straight native rectangular duct. No fittings, turns or equipment connections.</summary>
        private static JsonNode CreateDuctRun(UIApplication app, JsonObject p)
        {
            var doc = RequireNativePilotDocument(app, p);
            var system = RequireElement(doc, ReqId(p, "system_type_id")) as MechanicalSystemType
                ?? throw new ArgumentException("system_type_id must be a MechanicalSystemType in the target document.");
            var ductType = RequireElement(doc, ReqId(p, "duct_type_id")) as DuctType
                ?? throw new ArgumentException("duct_type_id must be a DuctType in the target document.");
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            if (p["diameter_mm"] != null)
                throw new ArgumentException("This initial helper supports rectangular width_mm/height_mm only.");
            var widthMm = PositivePilotMillimetres(p, "width_mm");
            var heightMm = PositivePilotMillimetres(p, "height_mm");
            var input = p["points"] as JsonArray ?? throw new ArgumentException("points is required.");
            if (input.Count != 2)
                throw new ArgumentException("Exactly two points are supported; turns and multiple segments are unsupported.");
            var points = input.Select(n =>
            {
                var point = n?.AsObject() ?? throw new ArgumentException("Each point must be an object.");
                var x = ReqNum(point, "x");
                var y = ReqNum(point, "y");
                var z = Num(point, "z") ?? 0;
                if (!double.IsFinite(x) || !double.IsFinite(y) || !double.IsFinite(z))
                    throw new ArgumentException("Point coordinates must be finite millimetres.");
                return new XYZ(FromMm(x), FromMm(y), FromMm(z));
            }).ToArray();
            if (points[0].DistanceTo(points[1]) <= Math.Max(FromMm(2.54), app.Application.ShortCurveTolerance))
                throw new ArgumentException("The duct must exceed Revit's minimum MEP/short-curve length.");
            var comments = Str(p, "comments");

            return InTransaction(doc, "Create native straight rectangular duct", () =>
            {
                var duct = Duct.Create(doc, system.Id, ductType.Id, level.Id, points[0], points[1]);
                doc.Regenerate();
                var ends = duct.ConnectorManager.Connectors.Cast<Connector>()
                    .Where(c => c.ConnectorType == ConnectorType.End).ToList();
                if (ends.Count != 2 || ends.Any(c => c.Domain != Domain.DomainHvac || c.Shape != ConnectorProfileType.Rectangular))
                    throw new ArgumentException("duct_type_id must create a rectangular HVAC duct with two end connectors.");
                var width = duct.get_Parameter(BuiltInParameter.RBS_CURVE_WIDTH_PARAM);
                var height = duct.get_Parameter(BuiltInParameter.RBS_CURVE_HEIGHT_PARAM);
                if (width == null || height == null || width.IsReadOnly || height.IsReadOnly ||
                    !width.Set(FromMm(widthMm)) || !height.Set(FromMm(heightMm)))
                    throw new InvalidOperationException("The selected duct type does not accept the requested rectangular dimensions.");
                if (comments != null)
                    duct.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(comments);
                doc.Regenerate();
                if (Math.Abs(width.AsDouble() - FromMm(widthMm)) > 1e-6 ||
                    Math.Abs(height.AsDouble() - FromMm(heightMm)) > 1e-6)
                    throw new InvalidOperationException("Created duct dimensions differ from the requested dimensions.");
                ends = duct.ConnectorManager.Connectors.Cast<Connector>()
                    .Where(c => c.ConnectorType == ConnectorType.End).ToList();
                if (ends.Count != 2 || ends.Any(c => c.IsConnected))
                    throw new InvalidOperationException("This pilot requires two open terminal ends; unexpected connections roll back the change.");
                return new JsonObject
                {
                    ["id"] = duct.Id.Value,
                    ["native_class"] = typeof(Duct).FullName,
                    ["document"] = doc.PathName,
                    ["system_type_id"] = system.Id.Value,
                    ["duct_type_id"] = ductType.Id.Value,
                    ["level_id"] = level.Id.Value,
                    ["width_mm"] = ToMm(width.AsDouble()),
                    ["height_mm"] = ToMm(height.AsDouble()),
                    ["length_mm"] = ToMm(points[0].DistanceTo(points[1])),
                    ["segments"] = 1,
                    ["fittings"] = 0,
                    ["open_terminal_ends"] = ends.Count,
                    ["equipment_connected"] = false,
                    ["connectivity_status"] = "Native straight duct; both terminal ends open; no equipment-connected system claimed."
                };
            });
        }

        /// <summary>Return/create a named basic wall type with one uniform Structure layer, material By Category.</summary>
        private static JsonNode EnsureBasicWallType(UIApplication app, JsonObject p)
        {
            var doc = RequireNativePilotDocument(app, p);
            var name = ReqStr(p, "name");
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("name must not be blank.");
            var widthMm = PositivePilotMillimetres(p, "width_mm");
            var width = FromMm(widthMm);
            var types = new FilteredElementCollector(doc).OfClass(typeof(WallType)).Cast<WallType>().ToList();
            var matches = types.Where(t => string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase)).ToList();
            if (matches.Count > 1) throw new InvalidOperationException("Several wall types match this name; use a unique name.");
            JsonObject Result(WallType type, bool created) => new JsonObject
            {
                ["id"] = type.Id.Value,
                ["name"] = type.Name,
                ["document"] = doc.PathName,
                ["created"] = created,
                ["kind"] = type.Kind.ToString(),
                ["width_mm"] = ToMm(type.Width),
                ["layer_count"] = 1,
                ["layer_function"] = MaterialFunctionAssignment.Structure.ToString(),
                ["material"] = "By Category",
                ["note"] = "Type definition only; does not validate project material specification or source geometry."
            };
            bool Matches(WallType type)
            {
                if (type.Kind != WallKind.Basic || Math.Abs(type.Width - width) > FromMm(0.01)) return false;
                var structure = type.GetCompoundStructure();
                if (structure == null || !structure.IsVerticallyHomogeneous() || structure.VariableLayerIndex != -1 || structure.LayerCount != 1)
                    return false;
                var layer = structure.GetLayers()[0];
                return Math.Abs(layer.Width - width) <= FromMm(0.01) &&
                    layer.Function == MaterialFunctionAssignment.Structure &&
                    layer.MaterialId != null && layer.MaterialId.Value == ElementId.InvalidElementId.Value;
            }
            if (matches.Count == 1)
            {
                if (!Matches(matches[0]))
                    throw new ArgumentException("The existing named type differs from the requested uniform single-layer basic wall definition; it was not changed. " + DescribeWallDefinition(matches[0]));
                return Result(matches[0], false);
            }
            var seed = types.FirstOrDefault(t => t.Kind == WallKind.Basic)
                ?? throw new InvalidOperationException("This model has no basic wall type to duplicate.");
            return InTransaction(doc, "Ensure uniform single-layer basic wall type", () =>
            {
                var type = seed.Duplicate(name) as WallType
                    ?? throw new InvalidOperationException("Failed to duplicate a basic wall type.");
                var structure = CompoundStructure.CreateSimpleCompoundStructure(new List<CompoundStructureLayer>
                {
                    new CompoundStructureLayer(width, MaterialFunctionAssignment.Structure, ElementId.InvalidElementId)
                });
                structure.VariableLayerIndex = -1;
                type.SetCompoundStructure(structure);
                doc.Regenerate();
                if (!Matches(type)) throw new InvalidOperationException("Created wall type does not match the requested definition. " + DescribeWallDefinition(type));
                return Result(type, true);
            });
        }

        private static string DescribeWallDefinition(WallType type)
        {
            var structure = type.GetCompoundStructure();
            var actual = new JsonObject
            {
                ["kind"] = type.Kind.ToString(),
                ["type_width_mm"] = ToMm(type.Width),
                ["has_compound_structure"] = structure != null
            };
            if (structure != null)
            {
                actual["is_vertically_compound"] = structure.IsVerticallyCompound;
                actual["is_vertically_homogeneous"] = structure.IsVerticallyHomogeneous();
                actual["variable_layer_index"] = structure.VariableLayerIndex;
                actual["layer_count"] = structure.LayerCount;
                actual["layers"] = new JsonArray(structure.GetLayers().Select(layer => (JsonNode)new JsonObject
                {
                    ["width_mm"] = ToMm(layer.Width),
                    ["function"] = layer.Function.ToString(),
                    ["material_id"] = layer.MaterialId?.Value,
                    ["expected_by_category_material_id"] = ElementId.InvalidElementId.Value
                }).ToArray());
            }
            return "Actual wall definition: " + actual.ToJsonString();
        }
    }
}
