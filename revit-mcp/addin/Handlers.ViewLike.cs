using System;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    internal static partial class Handlers
    {
        /// <summary>
        /// Make, in another open model, a section, detail section, elevation-like section or 3D view with the same
        /// box, direction and depth as a view in the source model (sections from the crop box and its transform;
        /// 3D from eye, up and forward plus the section box). Name it with `name`. Then use match_view_settings and
        /// copy_view_contents. Used to move sheets between models.
        /// </summary>
        private static JsonNode CreateViewLike(UIApplication app, JsonObject p)
        {
            var src = OpenDocByName(app, Str(p, "source_document"), "source_document");
            var dst = OpenDocByName(app, Str(p, "target_document"), "target_document");
            var sv = RequireElement(src, ReqId(p, "source_view_id")) as View ?? throw new ArgumentException("source_view_id is not a view.");
            var name = Str(p, "name");
            return InTransaction(dst, "Create view like", () =>
            {
                View made;
                if (sv is ViewSection)
                {
                    var family = sv.ViewType == ViewType.Detail ? ViewFamily.Detail : ViewFamily.Section;
                    var type = new FilteredElementCollector(dst).OfClass(typeof(ViewFamilyType)).Cast<ViewFamilyType>()
                        .FirstOrDefault(t => t.ViewFamily == family) ?? throw new InvalidOperationException($"No {family} view type in the target.");
                    // A clean box from the source crop: unit axes, every bound enabled, depth from the far clip.
                    // The frame comes from the view itself (right, up, toward the viewer), never from the crop box axes,
                    // which can be mirrored: a mirrored frame makes a section that looks the other way and flips every
                    // copied note. The crop extents are re-expressed in that frame.
                    var c = sv.CropBox; var t0 = c.Transform;
                    var far = sv.get_Parameter(BuiltInParameter.VIEWER_BOUND_OFFSET_FAR)?.AsDouble() ?? 0;
                    made = null;
                    var tried = new System.Collections.Generic.List<string>();
                    foreach (var sign in new[] { 1.0, -1.0 })
                    {
                        var t = Transform.Identity;
                        t.Origin = t0.Origin;
                        t.BasisX = sv.RightDirection.Normalize() * sign; t.BasisY = sv.UpDirection.Normalize();
                        t.BasisZ = t.BasisX.CrossProduct(t.BasisY).Normalize();
                        var inv = t.Inverse;
                        double x0 = double.MaxValue, y0 = double.MaxValue, z0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue, z1 = double.MinValue;
                        foreach (var px in new[] { c.Min.X, c.Max.X }) foreach (var py in new[] { c.Min.Y, c.Max.Y }) foreach (var pz in new[] { c.Min.Z, c.Max.Z })
                        {
                            var q = inv.OfPoint(t0.OfPoint(new XYZ(px, py, pz)));
                            x0 = Math.Min(x0, q.X); y0 = Math.Min(y0, q.Y); z0 = Math.Min(z0, q.Z); x1 = Math.Max(x1, q.X); y1 = Math.Max(y1, q.Y); z1 = Math.Max(z1, q.Z);
                        }
                        var depth = Math.Max(Math.Max(far, z1 - z0), FromMm(10));
                        var box = new BoundingBoxXYZ { Transform = t, Enabled = true };
                        for (int i = 0; i < 3; i++) { box.set_MinEnabled(i, true); box.set_MaxEnabled(i, true); }
                        // keep the cut plane where the source has it: the face nearest the viewer of the source
                        var cut = sign > 0 ? z1 : z0 + depth;
                        box.Min = new XYZ(x0, y0, cut - depth);
                        box.Max = new XYZ(x1, y1, cut);
                        var v = ViewSection.CreateSection(dst, type.Id, box);
                        var dv = v.ViewDirection.DotProduct(sv.ViewDirection); var dr = v.RightDirection.DotProduct(sv.RightDirection);
                        tried.Add($"sign {sign}: view {dv:0.000}, right {dr:0.000}");
                        if (dv > 0.999 && dr > 0.999) { made = v; break; }
                        dst.Delete(v.Id);
                    }
                    if (made == null) throw new InvalidOperationException("could not make a section facing the same way as the source: " + string.Join("; ", tried));
                }
                else if (sv is View3D v3)
                {
                    var type = new FilteredElementCollector(dst).OfClass(typeof(ViewFamilyType)).Cast<ViewFamilyType>()
                        .First(t => t.ViewFamily == ViewFamily.ThreeDimensional);
                    var n = v3.IsPerspective ? View3D.CreatePerspective(dst, type.Id) : View3D.CreateIsometric(dst, type.Id);
                    n.SetOrientation(v3.GetOrientation());
                    if (v3.IsSectionBoxActive) { n.IsSectionBoxActive = true; n.SetSectionBox(v3.GetSectionBox()); }
                    made = n;
                }
                else throw new ArgumentException($"{sv.ViewType} is not handled here; plans use create_floor_plan, drafting views create_drafting_view.");
                if (!string.IsNullOrWhiteSpace(name)) made.Name = name;
                try { made.Scale = sv.Scale; } catch { }
                try { made.DetailLevel = sv.DetailLevel; made.DisplayStyle = sv.DisplayStyle; } catch { }
                if (made is ViewSection)
                {
                    try { made.CropBoxActive = sv.CropBoxActive; } catch { }
                    var far = sv.get_Parameter(BuiltInParameter.VIEWER_BOUND_OFFSET_FAR);
                    var dfar = made.get_Parameter(BuiltInParameter.VIEWER_BOUND_OFFSET_FAR);
                    if (far != null && dfar != null && !dfar.IsReadOnly) dfar.Set(far.AsDouble());
                }
                return new JsonObject { ["id"] = made.Id.Value, ["name"] = made.Name, ["view_type"] = made.ViewType.ToString() };
            });
        }
    }
}
