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
        /// Make a view in one open model look like a view in another: scale, detail level, display style, discipline,
        /// crop box and annotation crop, view range (plans), phase and phase filter (by name), and per-category
        /// visibility and graphic overrides (by category, so they also act on links shown By Host View).
        /// Pairs with copy_view_contents to move a sheet's views between discipline models.
        /// </summary>
        private static JsonNode MatchViewSettings(UIApplication app, JsonObject p)
        {
            var src = OpenDocByName(app, Str(p, "source_document"), "source_document");
            var dst = OpenDocByName(app, Str(p, "target_document"), "target_document");
            var sv = RequireElement(src, ReqId(p, "source_view_id")) as View ?? throw new ArgumentException("source_view_id is not a view.");
            var dv = RequireElement(dst, ReqId(p, "target_view_id")) as View ?? throw new ArgumentException("target_view_id is not a view.");
            var notes = new JsonArray();
            return InTransaction(dst, "Match view settings", () =>
            {
                void Try(string what, Action a) { try { a(); } catch (Exception ex) { notes.Add($"{what}: {ex.Message}"); } }
                if (dv.ViewTemplateId != ElementId.InvalidElementId) Try("template", () => dv.ViewTemplateId = ElementId.InvalidElementId);
                Try("scale", () => dv.Scale = sv.Scale);
                Try("detail level", () => dv.DetailLevel = sv.DetailLevel);
                Try("display style", () => dv.DisplayStyle = sv.DisplayStyle);
                Try("discipline", () => dv.Discipline = sv.Discipline);
                Try("crop", () =>
                {
                    dv.CropBoxActive = sv.CropBoxActive;
                    dv.CropBoxVisible = sv.CropBoxVisible;
                    var b = sv.CropBox;
                    if (sv.CropBoxActive) dv.CropBox = b;
                    var ac = sv.get_Parameter(BuiltInParameter.VIEWER_ANNOTATION_CROP_ACTIVE);
                    var dac = dv.get_Parameter(BuiltInParameter.VIEWER_ANNOTATION_CROP_ACTIVE);
                    if (ac != null && dac != null && !dac.IsReadOnly) dac.Set(ac.AsInteger());
                });
                Try("annotation crop offsets", () =>
                {
                    var sm = sv.GetCropRegionShapeManager(); var dm = dv.GetCropRegionShapeManager();
                    if (sm != null && dm != null)
                    {
                        dm.LeftAnnotationCropOffset = sm.LeftAnnotationCropOffset; dm.RightAnnotationCropOffset = sm.RightAnnotationCropOffset;
                        dm.TopAnnotationCropOffset = sm.TopAnnotationCropOffset; dm.BottomAnnotationCropOffset = sm.BottomAnnotationCropOffset;
                    }
                });
                if (sv is ViewPlan sp && dv is ViewPlan dp)
                {
                    Try("view range", () =>
                    {
                        var sr = sp.GetViewRange(); var dr = dp.GetViewRange();
                        foreach (PlanViewPlane plane in Enum.GetValues(typeof(PlanViewPlane)))
                        {
                            var lvlId = sr.GetLevelId(plane);
                            var lvl = lvlId == ElementId.InvalidElementId ? null : src.GetElement(lvlId) as Level;
                            ElementId dl = ElementId.InvalidElementId;
                            if (lvl != null)
                            {
                                var match = new FilteredElementCollector(dst).OfClass(typeof(Level)).Cast<Level>()
                                    .OrderBy(l => Math.Abs(l.Elevation - lvl.Elevation)).FirstOrDefault();
                                if (match != null) dl = match.Id;
                            }
                            else if (lvlId.Value == -2 || lvlId.Value == -3 || lvlId.Value == -4) dl = lvlId; // unlimited / level below / level above
                            if (dl == ElementId.InvalidElementId && lvlId != ElementId.InvalidElementId && lvl == null) dl = lvlId;
                            if (dl != ElementId.InvalidElementId) dr.SetLevelId(plane, dl);
                            dr.SetOffset(plane, sr.GetOffset(plane));
                        }
                        dp.SetViewRange(dr);
                    });
                }
                Try("phase", () =>
                {
                    var ph = src.GetElement(sv.get_Parameter(BuiltInParameter.VIEW_PHASE).AsElementId())?.Name;
                    var dph = new FilteredElementCollector(dst).OfClass(typeof(Phase)).FirstOrDefault(x => x.Name == ph);
                    if (dph != null) dv.get_Parameter(BuiltInParameter.VIEW_PHASE).Set(dph.Id);
                    var pf = src.GetElement(sv.get_Parameter(BuiltInParameter.VIEW_PHASE_FILTER).AsElementId())?.Name;
                    var dpf = new FilteredElementCollector(dst).OfClass(typeof(PhaseFilter)).FirstOrDefault(x => x.Name == pf);
                    if (dpf != null) dv.get_Parameter(BuiltInParameter.VIEW_PHASE_FILTER).Set(dpf.Id);
                });

                var cats = 0; var ovr = 0;
                foreach (Category sc in src.Settings.Categories)
                {
                    foreach (var c in new[] { sc }.Concat(sc.SubCategories.Cast<Category>()))
                    {
                        Category dc = null;
                        try { dc = c.Parent == null ? dst.Settings.Categories.get_Item(c.Name)
                                : dst.Settings.Categories.get_Item(c.Parent.Name)?.SubCategories.Cast<Category>().FirstOrDefault(x => x.Name == c.Name); } catch { }
                        if (dc == null || (BuiltInCategory)dc.Id.Value == BuiltInCategory.OST_RvtLinks && c.Parent == null && false) continue;
                        try
                        {
                            if (sv.CanCategoryBeHidden(c.Id) && dv.CanCategoryBeHidden(dc.Id))
                            {
                                var h = sv.GetCategoryHidden(c.Id);
                                if (dv.GetCategoryHidden(dc.Id) != h) { dv.SetCategoryHidden(dc.Id, h); cats++; }
                            }
                            var o = sv.GetCategoryOverrides(c.Id);
                            if (o != null)
                            {
                                var n = CloneOverridesAcross(o, src, dst);
                                dv.SetCategoryOverrides(dc.Id, n); ovr++;
                            }
                        }
                        catch { /* category not valid in that view type */ }
                    }
                }
                return new JsonObject { ["scale"] = dv.Scale, ["categories_hidden_changed"] = cats, ["overrides_set"] = ovr, ["notes"] = notes };
            });
        }

        /// <summary>Copy override graphics between documents; patterns are mapped by name (solid fill kept).</summary>
        private static OverrideGraphicSettings CloneOverridesAcross(OverrideGraphicSettings o, Document src, Document dst)
        {
            ElementId Map(ElementId id, Type t)
            {
                if (id == ElementId.InvalidElementId) return id;
                var e = src.GetElement(id);
                if (e == null) return ElementId.InvalidElementId;
                if (e is FillPatternElement fp)
                {
                    var fill = fp.GetFillPattern();
                    var m = new FilteredElementCollector(dst).OfClass(typeof(FillPatternElement)).Cast<FillPatternElement>()
                        .FirstOrDefault(x => x.GetFillPattern().Target == fill.Target && (x.Name == fp.Name || (fill.IsSolidFill && x.GetFillPattern().IsSolidFill)));
                    return m?.Id ?? ElementId.InvalidElementId;
                }
                var match = new FilteredElementCollector(dst).OfClass(t).FirstOrDefault(x => x.Name == e.Name);
                return match?.Id ?? ElementId.InvalidElementId;
            }
            var n = new OverrideGraphicSettings();
            n.SetHalftone(o.Halftone);
            n.SetSurfaceTransparency(o.Transparency);
            if (o.DetailLevel != ViewDetailLevel.Undefined) n.SetDetailLevel(o.DetailLevel);
            if (o.ProjectionLineColor.IsValid) n.SetProjectionLineColor(o.ProjectionLineColor);
            if (o.CutLineColor.IsValid) n.SetCutLineColor(o.CutLineColor);
            if (o.ProjectionLineWeight > 0) n.SetProjectionLineWeight(o.ProjectionLineWeight);
            if (o.CutLineWeight > 0) n.SetCutLineWeight(o.CutLineWeight);
            n.SetProjectionLinePatternId(Map(o.ProjectionLinePatternId, typeof(LinePatternElement)));
            n.SetCutLinePatternId(Map(o.CutLinePatternId, typeof(LinePatternElement)));
            if (o.SurfaceForegroundPatternColor.IsValid) n.SetSurfaceForegroundPatternColor(o.SurfaceForegroundPatternColor);
            if (o.SurfaceBackgroundPatternColor.IsValid) n.SetSurfaceBackgroundPatternColor(o.SurfaceBackgroundPatternColor);
            if (o.CutForegroundPatternColor.IsValid) n.SetCutForegroundPatternColor(o.CutForegroundPatternColor);
            if (o.CutBackgroundPatternColor.IsValid) n.SetCutBackgroundPatternColor(o.CutBackgroundPatternColor);
            n.SetSurfaceForegroundPatternId(Map(o.SurfaceForegroundPatternId, typeof(FillPatternElement)));
            n.SetSurfaceBackgroundPatternId(Map(o.SurfaceBackgroundPatternId, typeof(FillPatternElement)));
            n.SetCutForegroundPatternId(Map(o.CutForegroundPatternId, typeof(FillPatternElement)));
            n.SetCutBackgroundPatternId(Map(o.CutBackgroundPatternId, typeof(FillPatternElement)));
            n.SetSurfaceForegroundPatternVisible(o.IsSurfaceForegroundPatternVisible);
            n.SetSurfaceBackgroundPatternVisible(o.IsSurfaceBackgroundPatternVisible);
            n.SetCutForegroundPatternVisible(o.IsCutForegroundPatternVisible);
            n.SetCutBackgroundPatternVisible(o.IsCutBackgroundPatternVisible);
            return n;
        }
    }
}
