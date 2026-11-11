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
        private static Document OpenDocByName(UIApplication app, string name, string what)
        {
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException($"{what} is required.");
            foreach (Document d in app.Application.Documents)
                if (!d.IsLinked && (string.Equals(d.Title, name, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(d.PathName, name, StringComparison.OrdinalIgnoreCase))) return d;
            throw new InvalidOperationException($"{what} '{name}' is not open in this Revit (as a model, not a link).");
        }

        private sealed class UseDestinationTypes : IDuplicateTypeNamesHandler
        {
            public DuplicateTypeAction OnDuplicateTypeNamesFound(DuplicateTypeNamesHandlerArgs args) => DuplicateTypeAction.UseDestinationTypes;
        }

        private static bool IsCopyableViewElement(Element e, ElementId viewId)
        {
            if (e.OwnerViewId != viewId) return false;
            if (e is View || e is ElementType) return false;
            var cat = e.Category;
            if (cat == null) return false;
            var bic = (BuiltInCategory)cat.Id.Value;
            // the view's own crop box, viewers and sketch planes are not content
            return bic != BuiltInCategory.OST_Viewers && bic != BuiltInCategory.OST_CropBoundary
                && bic != BuiltInCategory.OST_IOSSketchGrid && bic != BuiltInCategory.OST_SketchLines
                && bic != BuiltInCategory.OST_Cameras;
        }

        /// <summary>
        /// Copy the view-owned content of one view (text notes, detail lines, filled regions, detail components,
        /// dimensions, tags, symbols) into a view of another open model, origin to origin unless offset_mm is given.
        /// Batches by category, falls back to one element at a time, and returns what could not be copied
        /// (for example tags and dimensions that point into a linked model), with the tagged element ids, so the
        /// caller can re-create them natively. Used to move sheets between discipline models.
        /// </summary>
        private static JsonNode CopyViewContents(UIApplication app, JsonObject p)
        {
            var src = OpenDocByName(app, Str(p, "source_document"), "source_document");
            var dst = OpenDocByName(app, Str(p, "target_document"), "target_document");
            if (src.Equals(dst)) throw new ArgumentException("source and target are the same model; use the normal copy.");
            var sv = RequireElement(src, ReqId(p, "source_view_id")) as View ?? throw new ArgumentException("source_view_id is not a view.");
            var dv = RequireElement(dst, ReqId(p, "target_view_id")) as View ?? throw new ArgumentException("target_view_id is not a view.");
            var dx = p["offset_mm"] is JsonObject o ? FromMm(o["x"]?.GetValue<double>() ?? 0) : 0;
            var dy = p["offset_mm"] is JsonObject o2 ? FromMm(o2["y"]?.GetValue<double>() ?? 0) : 0;
            var only = (p["categories"] as JsonArray)?.Select(x => x!.GetValue<string>()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var dry = p["dry_run"] is JsonValue dr && dr.GetValue<bool>();

            var allElems = new FilteredElementCollector(src, sv.Id).WhereElementIsNotElementType().ToElements()
                .Where(e => IsCopyableViewElement(e, sv.Id))
                .Where(e => only == null || only.Contains(e.Category.Name) || only.Contains(((BuiltInCategory)e.Category.Id.Value).ToString()))
                .ToList();
            // Linear dimensions are rebuilt with remapped references (a copied dimension whose references are not in
            // the target is silently deleted by Revit); everything else is copied.
            var dims = allElems.OfType<Dimension>().Where(d => d.DimensionShape == DimensionShape.Linear && d.Curve is Line).ToList();
            var elems = allElems.Where(e => !dims.Any(d => d.Id == e.Id))
                .Where(e => only == null || only.Contains(e.Category.Name) || only.Contains(((BuiltInCategory)e.Category.Id.Value).ToString()))
                .ToList();
            var byCat = elems.GroupBy(e => e.Category.Name).ToDictionary(g => g.Key, g => g.Select(e => e.Id).ToList());
            var counts = new JsonObject();
            foreach (var kv in byCat) counts[kv.Key] = kv.Value.Count;
            if (dims.Count > 0) counts["Dimensions"] = dims.Count + (byCat.TryGetValue("Dimensions", out var od) ? od.Count : 0);
            if (dry) return new JsonObject { ["found"] = allElems.Count, ["by_category"] = counts };

            var opts = new CopyPasteOptions();
            opts.SetDuplicateTypeNamesHandler(new UseDestinationTypes());
            var xf = Transform.CreateTranslation(new XYZ(dx, dy, 0));
            var copied = new JsonObject();
            var failed = new JsonArray();
            var total = 0;

            // dimensions and tags last: they hang on references that must exist first
            var order = byCat.Keys.OrderBy(k => k.IndexOf("Tag", StringComparison.OrdinalIgnoreCase) >= 0 || k == "Dimensions" ? 1 : 0).ToList();
            var result = InTransaction(dst, "Copy view contents", () =>
            {
                foreach (var cat in order)
                {
                    var ids = byCat[cat];
                    var n = 0;
                    try
                    {
                        using (var st = new SubTransaction(dst))
                        {
                            st.Start();
                            n = ElementTransformUtils.CopyElements(sv, ids, dv, xf, opts).Count;
                            st.Commit();
                        }
                    }
                    catch
                    {
                        n = 0;
                        foreach (var id in ids)
                        {
                            try
                            {
                                using (var st = new SubTransaction(dst))
                                {
                                    st.Start();
                                    n += ElementTransformUtils.CopyElements(sv, new List<ElementId> { id }, dv, xf, opts).Count;
                                    st.Commit();
                                }
                            }
                            catch (Exception ex)
                            {
                                var e = src.GetElement(id);
                                var f = new JsonObject { ["id"] = id.Value, ["category"] = cat, ["error"] = ex.Message.Length > 120 ? ex.Message.Substring(0, 120) : ex.Message };
                                if (e is IndependentTag tag)
                                {
                                    var tagged = new JsonArray();
                                    foreach (var lid in tag.GetTaggedElementIds())
                                        tagged.Add(lid.LinkedElementId != ElementId.InvalidElementId ? lid.LinkedElementId.Value : lid.HostElementId.Value);
                                    f["tagged_ids"] = tagged;
                                    f["tag_type"] = src.GetElement(tag.GetTypeId())?.Name;
                                    f["leader"] = tag.HasLeader;
                                    try { var h = tag.TagHeadPosition; f["head_mm"] = new JsonObject { ["x"] = ToMm(h.X), ["y"] = ToMm(h.Y) }; } catch { }
                                }
                                failed.Add(f);
                            }
                        }
                    }
                    copied[cat] = n;
                    total += n;
                }
                return new JsonObject();
            });
            var r = result as JsonObject ?? new JsonObject();
            r["found"] = allElems.Count;
            r["copied_total"] = total;
            if (dims.Count > 0)
            {
                r["dimensions_not_copied"] = dims.Count;
                r["dimensions_hint"] = "Linear dimensions are not copied (Revit deletes copies whose references are missing). "
                    + "Run read_view_dimensions on the source view, then create_dimensions in the target with the link loaded.";
            }
            r["copied"] = copied;
            r["failed"] = failed;
            return r;
        }

        /// <summary>
        /// Copy whole drafting or legend-like views (with everything drawn in them) from one open model to another.
        /// Returns the new view ids. Legend views cannot be copied between models by Revit; they are reported.
        /// </summary>
        private static JsonNode CopyViewsBetweenModels(UIApplication app, JsonObject p)
        {
            var src = OpenDocByName(app, Str(p, "source_document"), "source_document");
            var dst = OpenDocByName(app, Str(p, "target_document"), "target_document");
            var ids = ReqIds(p, "view_ids");
            var opts = new CopyPasteOptions();
            opts.SetDuplicateTypeNamesHandler(new UseDestinationTypes());
            var outArr = new JsonArray();
            return InTransaction(dst, "Copy views between models", () =>
            {
                foreach (var id in ids)
                {
                    var v = src.GetElement(id) as View;
                    var row = new JsonObject { ["source_id"] = id.Value, ["name"] = v?.Name };
                    try
                    {
                        if (v == null) throw new ArgumentException("not a view");
                        if (v.ViewType != ViewType.DraftingView) throw new ArgumentException($"{v.ViewType} cannot be copied between models; only drafting views can.");
                        using (var st = new SubTransaction(dst))
                        {
                            st.Start();
                            var made = ElementTransformUtils.CopyElements(src, new List<ElementId> { id }, dst, Transform.Identity, opts);
                            st.Commit();
                            var nv = made.Select(m => dst.GetElement(m)).OfType<View>().FirstOrDefault();
                            row["new_id"] = nv?.Id.Value;
                            row["new_name"] = nv?.Name;
                        }
                    }
                    catch (Exception ex) { row["error"] = ex.Message; }
                    outArr.Add(row);
                }
                return new JsonObject { ["views"] = outArr };
            });
        }
    }
}
