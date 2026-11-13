using System;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Structure;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// Steel framing in one undo step each, at exact positions: structural columns (posts) and beams.
    /// Coordinates in project mm (internal origin); heights in mm above the given level.
    /// </summary>
    internal static partial class Handlers
    {
        /// <summary>
        /// create_columns: place structural columns of one type on a level. Params: type_id, level_id,
        /// base_offset_mm (default 0), top_offset_mm (height of the top above the same level, required),
        /// items [{x, y, rotation_deg?, mark?, comments?}].
        /// </summary>
        private static JsonNode CreateColumns(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var symbol = RequireElement(doc, ReqId(p, "type_id")) as FamilySymbol ?? throw new ArgumentException("type_id is not a family type.");
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var baseOff = FromMm(Num(p, "base_offset_mm") ?? 0);
            var topOff = FromMm(ReqNum(p, "top_offset_mm"));
            if (topOff <= baseOff) throw new ArgumentException("top_offset_mm must be above base_offset_mm.");
            var items = p["items"] as JsonArray ?? throw new ArgumentException("items is required.");
            return InTransaction(doc, $"Create {items.Count} columns", () =>
            {
                if (!symbol.IsActive) symbol.Activate();
                var ids = new JsonArray();
                foreach (var node in items)
                {
                    var o = node!.AsObject();
                    var pt = new XYZ(FromMm(ReqNum(o, "x")), FromMm(ReqNum(o, "y")), level.Elevation);
                    var fi = doc.Create.NewFamilyInstance(pt, symbol, level, StructuralType.Column);
                    fi.get_Parameter(BuiltInParameter.FAMILY_BASE_LEVEL_PARAM)?.Set(level.Id);
                    fi.get_Parameter(BuiltInParameter.FAMILY_TOP_LEVEL_PARAM)?.Set(level.Id);
                    fi.get_Parameter(BuiltInParameter.FAMILY_TOP_LEVEL_OFFSET_PARAM)?.Set(topOff);
                    fi.get_Parameter(BuiltInParameter.FAMILY_BASE_LEVEL_OFFSET_PARAM)?.Set(baseOff);
                    var rot = Num(o, "rotation_deg") ?? 0;
                    if (Math.Abs(rot) > 1e-9)
                        ElementTransformUtils.RotateElement(doc, fi.Id, Line.CreateBound(pt, pt + XYZ.BasisZ), rot * Math.PI / 180);
                    if (Str(o, "mark") is string mark) fi.get_Parameter(BuiltInParameter.ALL_MODEL_MARK)?.Set(mark);
                    if (Str(o, "comments") is string c) fi.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(c);
                    ids.Add(fi.Id.Value);
                }
                return new JsonObject { ["type"] = symbol.Name, ["level"] = level.Name, ["count"] = ids.Count, ["ids"] = ids };
            });
        }

        /// <summary>
        /// create_beams: place structural beams of one type on a level along straight centrelines. The beam top sits at
        /// top_mm above the level (Revit's default top justification). Params: type_id, level_id, top_mm,
        /// items [{start {x,y}, end {x,y}, mark?, comments?}], allow_join (default false: ends are not joined or cut back,
        /// so each beam keeps exactly the length given).
        /// </summary>
        private static JsonNode CreateBeams(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var symbol = RequireElement(doc, ReqId(p, "type_id")) as FamilySymbol ?? throw new ArgumentException("type_id is not a family type.");
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var z = level.Elevation + FromMm(ReqNum(p, "top_mm"));
            var allowJoin = Bool(p, "allow_join");
            var items = p["items"] as JsonArray ?? throw new ArgumentException("items is required.");
            return InTransaction(doc, $"Create {items.Count} beams", () =>
            {
                if (!symbol.IsActive) symbol.Activate();
                var ids = new JsonArray();
                foreach (var node in items)
                {
                    var o = node!.AsObject();
                    var s = o["start"]!.AsObject(); var e = o["end"]!.AsObject();
                    var a = new XYZ(FromMm(ReqNum(s, "x")), FromMm(ReqNum(s, "y")), z);
                    var b = new XYZ(FromMm(ReqNum(e, "x")), FromMm(ReqNum(e, "y")), z);
                    if (a.DistanceTo(b) < FromMm(10)) throw new ArgumentException("A beam is shorter than 10 mm.");
                    var fi = doc.Create.NewFamilyInstance(Line.CreateBound(a, b), symbol, level, StructuralType.Beam);
                    if (!allowJoin)
                    {
                        StructuralFramingUtils.DisallowJoinAtEnd(fi, 0);
                        StructuralFramingUtils.DisallowJoinAtEnd(fi, 1);
                    }
                    if (Str(o, "mark") is string mark) fi.get_Parameter(BuiltInParameter.ALL_MODEL_MARK)?.Set(mark);
                    if (Str(o, "comments") is string c) fi.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(c);
                    ids.Add(fi.Id.Value);
                }
                return new JsonObject { ["type"] = symbol.Name, ["level"] = level.Name, ["count"] = ids.Count, ["ids"] = ids };
            });
        }
    }
}
