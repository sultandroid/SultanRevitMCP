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
        private static double Mm(double feet) => Math.Round(ToMm(feet), 1);

        private static ViewSheet RequireSheet(Document doc, ElementId id)
            => doc.GetElement(id) as ViewSheet ?? throw new ArgumentException("sheet_id is not a sheet.");

        private static Outline DrawingArea(Document doc, ViewSheet sheet, double marginMm)
        {
            // The Samaya title block is a full-sheet frame with the block on the right, so its
            // bounding box equals the sheet and cannot be used as a limit. The standard drawing
            // area is fixed: 20 mm margin, six 165 mm columns ending at 1012 mm, title block to
            // the right of that (views-and-sheets.md).
            var bb = sheet.Outline;            // BoundingBoxUV
            var sheetW = bb.Max.U;
            var sheetH = bb.Max.V;
            var m = FromMm(marginMm);
            var rightLimit = Math.Min(sheetW - FromMm(180), FromMm(1012));
            return new Outline(
                new XYZ(bb.Min.U + m, bb.Min.V + m, 0),
                new XYZ(rightLimit, sheetH - m, 0));
        }

        /// <summary>
        /// One view, sized to fill the sheet: sets the view scale until the viewport fits the
        /// drawing area inside the title block, then centres it. Repeats because the viewport
        /// grows in discrete steps as the scale changes.
        /// </summary>
        private static JsonNode FitViewToSheet(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var sheet = RequireSheet(doc, ReqId(p, "sheet_id"));
            var view = RequireElement(doc, ReqId(p, "view_id")) as View
                       ?? throw new ArgumentException("view_id is not a view.");
            var margin = Num(p, "margin_mm") ?? 15.0;

            var vp = new FilteredElementCollector(doc, sheet.Id)
                .OfClass(typeof(Viewport))
                .Cast<Viewport>()
                .FirstOrDefault(v => v.ViewId == view.Id);

            return InTransaction(doc, "Fit view to sheet", () =>
            {
                if (vp == null)
                {
                    // Not placed yet: put it somewhere, then fit.
                    vp = Viewport.Create(doc, sheet.Id, view.Id, new XYZ(FromMm(60), FromMm(60), 0));
                    doc.Regenerate();
                }

                string last = "";
                for (var i = 0; i < 6; i++)
                {
                    var area = DrawingArea(doc, sheet, margin);
                    var box = vp.GetBoxOutline();
                    var w = box.MaximumPoint.X - box.MinimumPoint.X;
                    var h = box.MaximumPoint.Y - box.MinimumPoint.Y;
                    var aw = area.MaximumPoint.X - area.MinimumPoint.X;
                    var ah = area.MaximumPoint.Y - area.MinimumPoint.Y;
                    if (w <= 0 || h <= 0) break;

                    var factor = Math.Min(aw / w, ah / h);
                    var current = view.Scale;
                    var target = (int)Math.Max(1, Math.Round(current / factor));
                    if (target == current) { last = "stable"; }
                    else
                    {
                        view.Scale = target;
                        doc.Regenerate();
                    }

                    var box2 = vp.GetBoxOutline();
                    var cx = (area.MinimumPoint.X + area.MaximumPoint.X) / 2.0;
                    var cy = (area.MinimumPoint.Y + area.MaximumPoint.Y) / 2.0;
                    var dx = cx - (box2.MinimumPoint.X + box2.MaximumPoint.X) / 2.0;
                    var dy = cy - (box2.MinimumPoint.Y + box2.MaximumPoint.Y) / 2.0;
                    vp.SetBoxCenter(new XYZ((box2.MinimumPoint.X + box2.MaximumPoint.X) / 2.0 + dx,
                                            (box2.MinimumPoint.Y + box2.MaximumPoint.Y) / 2.0 + dy, 0));
                    doc.Regenerate();

                    if (last == "stable" && Math.Abs(dx) < FromMm(1) && Math.Abs(dy) < FromMm(1)) break;
                }

                var final = vp.GetBoxOutline();
                return new JsonObject
                {
                    ["viewport_id"] = vp.Id.Value,
                    ["view"] = view.Name,
                    ["scale"] = view.Scale,
                    ["width_mm"] = Mm(final.MaximumPoint.X - final.MinimumPoint.X),
                    ["height_mm"] = Mm(final.MaximumPoint.Y - final.MinimumPoint.Y),
                    ["centre_mm"] = new JsonArray(Mm((final.MinimumPoint.X + final.MaximumPoint.X) / 2),
                                                 Mm((final.MinimumPoint.Y + final.MaximumPoint.Y) / 2)),
                };
            });
        }

        private static JsonNode SetViewScale(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View
                       ?? throw new ArgumentException("view_id is not a view.");
            var scale = (int)ReqNum(p, "scale");
            if (scale < 1 || scale > 5000) throw new ArgumentException("scale must be between 1 and 5000.");
            return InTransaction(doc, "Set view scale", () =>
            {
                view.Scale = scale;
                return new JsonObject { ["view"] = view.Name, ["scale"] = view.Scale };
            });
        }

        /// <summary>
        /// What is actually on a sheet: its size, the title block, and every viewport with its
        /// scale, size and centre in sheet millimetres. Use it to check margins and overlaps
        /// before a sheet is issued.
        /// </summary>
        private static JsonNode DrawingInfo(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var sheet = RequireSheet(doc, ReqId(p, "sheet_id"));

            var sbb = sheet.Outline;
            var tb = new FilteredElementCollector(doc, sheet.Id)
                .OfCategory(BuiltInCategory.OST_TitleBlocks)
                .WhereElementIsNotElementType()
                .FirstOrDefault();
            var tbBox = new JsonObject();
            if (tb != null)
            {
                var bb = tb.get_BoundingBox(sheet);
                var type = doc.GetElement(tb.GetTypeId());
                tbBox["type"] = type?.Name;
                if (bb != null)
                {
                    tbBox["min_mm"] = new JsonArray(Mm(bb.Min.X), Mm(bb.Min.Y));
                    tbBox["max_mm"] = new JsonArray(Mm(bb.Max.X), Mm(bb.Max.Y));
                }
            }

            var viewports = new JsonArray();
            foreach (var vp in new FilteredElementCollector(doc, sheet.Id)
                         .OfClass(typeof(Viewport)).Cast<Viewport>())
            {
                var box = vp.GetBoxOutline();
                var v = doc.GetElement(vp.ViewId) as View;
                viewports.Add(new JsonObject
                {
                    ["view"] = v?.Name,
                    ["view_type"] = v?.ViewType.ToString(),
                    ["scale"] = v?.Scale,
                    ["width_mm"] = Mm(box.MaximumPoint.X - box.MinimumPoint.X),
                    ["height_mm"] = Mm(box.MaximumPoint.Y - box.MinimumPoint.Y),
                    ["centre_mm"] = new JsonArray(Mm((box.MinimumPoint.X + box.MaximumPoint.X) / 2), Mm((box.MinimumPoint.Y + box.MaximumPoint.Y) / 2)),
                    ["left_mm"] = Mm(box.MinimumPoint.X),
                    ["right_mm"] = Mm(box.MaximumPoint.X),
                    ["bottom_mm"] = Mm(box.MinimumPoint.Y),
                    ["top_mm"] = Mm(box.MaximumPoint.Y),
                });
            }

            return new JsonObject
            {
                ["sheet_id"] = sheet.Id.Value,
                ["number"] = sheet.SheetNumber,
                ["name"] = sheet.Name,
                ["sheet_mm"] = new JsonArray(Mm(sbb.Max.U - sbb.Min.U), Mm(sbb.Max.V - sbb.Min.V)),
                ["title_block"] = tbBox,
                ["viewports"] = viewports,
                ["viewport_count"] = viewports.Count,
            };
        }
    }
}

namespace RevitMcp
{
    internal static partial class Handlers
    {
        /// <summary>
        /// Shrink the crop region to what is actually drawn in the view (including linked models),
        /// so a later fit_view_to_sheet has something to fill. Host geometry and every visible
        /// link are unioned; the margin is added on all four sides.
        /// </summary>
        private static JsonNode FitViewCropToModel(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View
                       ?? throw new ArgumentException("view_id is not a view.");
            var margin = Num(p, "margin_mm") ?? 100.0;

            BoundingBoxXYZ union = null;
            void Add(BoundingBoxXYZ bb)
            {
                if (bb == null) return;
                if (union == null)
                {
                    union = new BoundingBoxXYZ
                    {
                        Min = new XYZ(bb.Min.X, bb.Min.Y, bb.Min.Z),
                        Max = new XYZ(bb.Max.X, bb.Max.Y, bb.Max.Z),
                    };
                    return;
                }
                union.Min = new XYZ(Math.Min(union.Min.X, bb.Min.X), Math.Min(union.Min.Y, bb.Min.Y), Math.Min(union.Min.Z, bb.Min.Z));
                union.Max = new XYZ(Math.Max(union.Max.X, bb.Max.X), Math.Max(union.Max.Y, bb.Max.Y), Math.Max(union.Max.Z, bb.Max.Z));
            }

            // Only the named links are measured: a site or existing-shell link can span kilometres and
            // would zoom the plan out to nothing.
            var only = Str(p, "link_contains");
            foreach (var inst in new FilteredElementCollector(doc).OfClass(typeof(RevitLinkInstance)).Cast<RevitLinkInstance>())
            {
                if (inst.IsHidden(view)) continue;
                var name = inst.Name ?? string.Empty;
                if (only != null && name.IndexOf(only, StringComparison.OrdinalIgnoreCase) < 0) continue;
                Add(inst.get_BoundingBox(view));
            }
            foreach (var e in new FilteredElementCollector(doc, view.Id).WhereElementIsNotElementType())
            {
                if (e is View || e is ViewSheet) continue;
                Add(e.get_BoundingBox(view));
            }

            if (union == null)
                throw new InvalidOperationException("Nothing is visible in this view to fit the crop to: link the models first.");

            var m = FromMm(margin);
            return InTransaction(doc, "Fit crop to model", () =>
            {
                var cb = view.CropBox;
                cb.Min = new XYZ(union.Min.X - m, union.Min.Y - m, cb.Min.Z);
                cb.Max = new XYZ(union.Max.X + m, union.Max.Y + m, cb.Max.Z);
                view.CropBox = cb;
                view.CropBoxActive = true;
                view.CropBoxVisible = false;
                return new JsonObject
                {
                    ["view"] = view.Name,
                    ["crop_mm"] = new JsonArray(
                        Mm(union.Max.X - union.Min.X + 2 * m),
                        Mm(union.Max.Y - union.Min.Y + 2 * m)),
                };
            });
        }
    }
}

namespace RevitMcp
{
    internal static partial class Handlers
    {
        /// <summary>Read a view's crop region in model millimetres, and its scale and crop state.</summary>
        private static JsonNode ViewCropInfo(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View
                       ?? throw new ArgumentException("view_id is not a view.");
            var cb = view.CropBox;
            return new JsonObject
            {
                ["view"] = view.Name,
                ["scale"] = view.Scale,
                ["crop_active"] = view.CropBoxActive,
                ["min_mm"] = new JsonArray(ToMm(cb.Min.X), ToMm(cb.Min.Y)),
                ["max_mm"] = new JsonArray(ToMm(cb.Max.X), ToMm(cb.Max.Y)),
            };
        }

        /// <summary>
        /// Set a view's crop region from model millimetres. This is how a plan is framed on the
        /// grids instead of being left at the extents of a link that spans the whole mall.
        /// </summary>
        private static JsonNode SetViewCrop(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View
                       ?? throw new ArgumentException("view_id is not a view.");
            var min = ReqPoint(p, "min_mm");
            var max = ReqPoint(p, "max_mm");
            if (max.X <= min.X || max.Y <= min.Y) throw new ArgumentException("max_mm must be greater than min_mm on both axes.");
            return InTransaction(doc, "Set view crop", () =>
            {
                var cb = view.CropBox;
                cb.Min = new XYZ(FromMm(ToMm(min.X)), FromMm(ToMm(min.Y)), cb.Min.Z);
                cb.Max = new XYZ(FromMm(ToMm(max.X)), FromMm(ToMm(max.Y)), cb.Max.Z);
                view.CropBox = cb;
                view.CropBoxActive = true;
                view.CropBoxVisible = false;
                return new JsonObject
                {
                    ["view"] = view.Name,
                    ["width_mm"] = Math.Round(ToMm(max.X) - ToMm(min.X), 1),
                    ["height_mm"] = Math.Round(ToMm(max.Y) - ToMm(min.Y), 1),
                };
            });
        }
    }
}
