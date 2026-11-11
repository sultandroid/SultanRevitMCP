using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// Cuts a box out of a family's free-form solids (the parts a unit was built from), so a unit can be split
    /// where it is made in two pieces or shortened where it runs into existing structure (Madina 2 RA-B, 11 Nov 2026:
    /// the arch is cut back to the column face and its legs behind it become a separate part).
    /// </summary>
    internal static partial class Handlers
    {
        /// <summary>
        /// trim_family_solids: element_id, min / max (mm). With local: true the box is in family coordinates,
        /// otherwise in project coordinates (mapped through the instance transform). Every free-form solid in the
        /// family loses the part inside the box (material kept). Extrusions (formers, rails) whose centre lies in the
        /// box are deleted when delete_extrusions is true; others are left and listed. Optional save_dir saves the rfa.
        /// </summary>
        private static JsonNode TrimFamilySolids(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var instance = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                           ?? throw new ArgumentException("element_id is not a family instance.");
            var a = ReqPoint(p, "min");
            var b = ReqPoint(p, "max");
            if (p["local"]?.GetValue<bool>() != true)
            {
                var inv = instance.GetTransform().Inverse;
                var pa = inv.OfPoint(a);
                var pb = inv.OfPoint(b);
                a = new XYZ(Math.Min(pa.X, pb.X), Math.Min(pa.Y, pb.Y), Math.Min(pa.Z, pb.Z));
                b = new XYZ(Math.Max(pa.X, pb.X), Math.Max(pa.Y, pb.Y), Math.Max(pa.Z, pb.Z));
            }
            if (b.X - a.X < 1e-6 || b.Y - a.Y < 1e-6 || b.Z - a.Z < 1e-6) throw new ArgumentException("The box is empty.");
            var deleteExtrusions = p["delete_extrusions"]?.GetValue<bool>() == true;
            var options = new Options { DetailLevel = ViewDetailLevel.Fine };
            var familyDoc = doc.EditFamily(instance.Symbol.Family);
            try
            {
                int cut = 0, untouched = 0, piecesOut = 0;
                var deleted = new JsonArray();
                var kept = new JsonArray();
                using (var transaction = new Transaction(familyDoc, "MCP: Trim family solids"))
                {
                    transaction.Start();
                    var loop = new CurveLoop();
                    var c = new[] { new XYZ(a.X, a.Y, a.Z), new XYZ(b.X, a.Y, a.Z), new XYZ(b.X, b.Y, a.Z), new XYZ(a.X, b.Y, a.Z) };
                    for (var k = 0; k < 4; k++) loop.Append(Line.CreateBound(c[k], c[(k + 1) % 4]));
                    var box = GeometryCreationUtilities.CreateExtrusionGeometry(new List<CurveLoop> { loop }, XYZ.BasisZ, b.Z - a.Z);
                    var boxBb = new BoundingBoxXYZ { Min = a, Max = b };

                    foreach (var form in new FilteredElementCollector(familyDoc).OfClass(typeof(FreeFormElement)).Cast<FreeFormElement>().ToList())
                    {
                        var solids = SolidsOf(form.get_Geometry(options)).ToList();
                        var fb = form.get_BoundingBox(null);
                        if (fb == null || fb.Max.X <= a.X || fb.Min.X >= b.X || fb.Max.Y <= a.Y || fb.Min.Y >= b.Y || fb.Max.Z <= a.Z || fb.Min.Z >= b.Z) { untouched++; continue; }
                        var material = form.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.AsElementId() ?? ElementId.InvalidElementId;
                        var result = new List<Solid>();
                        foreach (var s in solids)
                        {
                            var d = BooleanOperationsUtils.ExecuteBooleanOperation(s, box, BooleanOperationsType.Difference);
                            if (d == null || d.Volume < 1e-9) continue;
                            result.AddRange(SolidUtils.SplitVolumes(d).Where(v => v.Volume > 1e-9));
                        }
                        familyDoc.Delete(form.Id);
                        cut++;
                        foreach (var s in result)
                        {
                            var created = FreeFormElement.Create(familyDoc, s);
                            if (material != ElementId.InvalidElementId) created.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.Set(material);
                            piecesOut++;
                        }
                    }
                    foreach (var ext in new FilteredElementCollector(familyDoc).OfClass(typeof(GenericForm)).Cast<GenericForm>().Where(f => !(f is FreeFormElement)).ToList())
                    {
                        var eb = ext.get_BoundingBox(null);
                        if (eb == null) continue;
                        var m = (eb.Min + eb.Max) / 2;
                        var inside = m.X > a.X && m.X < b.X && m.Y > a.Y && m.Y < b.Y && m.Z > a.Z && m.Z < b.Z;
                        var overlaps = !(eb.Max.X <= a.X || eb.Min.X >= b.X || eb.Max.Y <= a.Y || eb.Min.Y >= b.Y || eb.Max.Z <= a.Z || eb.Min.Z >= b.Z);
                        if (inside && deleteExtrusions) { deleted.Add(ext.Id.Value); familyDoc.Delete(ext.Id); }
                        else if (overlaps) kept.Add(ext.Id.Value);
                    }
                    transaction.Commit();
                }
                var saveDir = Str(p, "save_dir");
                if (saveDir != null) familyDoc.SaveAs(Path.Combine(saveDir, instance.Symbol.Family.Name + ".rfa"), new SaveAsOptions { OverwriteExistingFile = true });
                familyDoc.LoadFamily(doc, new OverwriteFamily());
                return new JsonObject
                {
                    ["forms_cut"] = cut, ["forms_untouched"] = untouched, ["pieces_after"] = piecesOut,
                    ["extrusions_deleted"] = deleted, ["extrusions_overlapping_kept"] = kept,
                    ["box_local_mm"] = new JsonObject { ["min"] = new JsonObject { ["x"] = ToMm(a.X), ["y"] = ToMm(a.Y), ["z"] = ToMm(a.Z) }, ["max"] = new JsonObject { ["x"] = ToMm(b.X), ["y"] = ToMm(b.Y), ["z"] = ToMm(b.Z) } },
                };
            }
            finally
            {
                familyDoc.Close(false);
            }
        }
    }
}
