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
    /// Sheet content in bulk, for copying a CAD sheet's tables and notes or writing them from data:
    ///   create_text_notes  many text notes in one transaction, each with its own type, wrap width and alignment.
    ///   place_image        an image (PNG/JPG/BMP) in a 2D view or on a sheet, centred on a point, at a width.
    /// </summary>
    internal static partial class Handlers
    {
        /// <summary>
        /// create_text_notes: Params: view_id, notes [{location {x,y}, text, text_type_id?, width_mm? (paper mm, wraps),
        /// align? "left"|"center"|"right", valign? "top"|"middle"|"bottom"}]. Line breaks in text are \r.
        /// The location is the note's anchor for the given alignment (top left by default).
        /// </summary>
        private static JsonNode CreateTextNotes(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var notes = p["notes"] as JsonArray ?? throw new ArgumentException("notes is required.");
            var defType = doc.GetDefaultElementTypeId(ElementTypeGroup.TextNoteType);
            return InTransaction(doc, "Create text notes", () =>
            {
                var ids = new JsonArray();
                foreach (var node in notes)
                {
                    var o = node.AsObject();
                    var opts = new TextNoteOptions(OptId(o, "text_type_id") ?? defType)
                    {
                        HorizontalAlignment = (o["align"]?.GetValue<string>() ?? "left") switch
                        {
                            "center" => HorizontalTextAlignment.Center,
                            "right" => HorizontalTextAlignment.Right,
                            _ => HorizontalTextAlignment.Left,
                        },
                        VerticalAlignment = (o["valign"]?.GetValue<string>() ?? "top") switch
                        {
                            "middle" => VerticalTextAlignment.Middle,
                            "bottom" => VerticalTextAlignment.Bottom,
                            _ => VerticalTextAlignment.Top,
                        },
                    };
                    var at = OnViewPlane(view, ReqPoint(o, "location"));
                    var text = ReqStr(o, "text");
                    var w = Num(o, "width_mm");
                    var note = w.HasValue && w.Value > 0
                        ? TextNote.Create(doc, view.Id, at, FromMm(w.Value), text, opts)
                        : TextNote.Create(doc, view.Id, at, text, opts);
                    ids.Add(note.Id.Value);
                }
                return new JsonObject { ["count"] = ids.Count, ["ids"] = ids };
            });
        }

        /// <summary>list_revisions: every revision in sequence order: id, sequence, number, date, description, issued, numbering sequence.</summary>
        private static JsonNode ListRevisions(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var items = new JsonArray();
            foreach (var id in Revision.GetAllRevisionIds(doc))
            {
                var r = (Revision)doc.GetElement(id);
                items.Add(new JsonObject
                {
                    ["id"] = id.Value, ["sequence"] = r.SequenceNumber, ["number"] = r.RevisionNumber, ["date"] = r.RevisionDate,
                    ["description"] = r.Description, ["issued"] = r.Issued,
                    ["numbering_sequence"] = (doc.GetElement(r.RevisionNumberingSequenceId) as RevisionNumberingSequence)?.Name,
                });
            }
            var result = new JsonObject { ["count"] = items.Count, ["revisions"] = items };
            // sheet_id (optional): which revisions show on that sheet (clouded or added), in sequence order
            if (p["sheet_id"] != null && doc.GetElement(ReqId(p, "sheet_id")) is ViewSheet sheet)
            {
                var on = new JsonArray();
                foreach (var id in sheet.GetAllRevisionIds()) on.Add(((Revision)doc.GetElement(id)).RevisionNumber);
                var added = new JsonArray();
                foreach (var id in sheet.GetAdditionalRevisionIds()) added.Add(((Revision)doc.GetElement(id)).RevisionNumber);
                result["on_sheet"] = on;
                result["added_to_sheet"] = added;
            }
            return result;
        }

        /// <summary>
        /// create_filled_regions: solid-colour filled regions in any 2D view (sections and plans too), from model points
        /// projected onto the view plane. Params: view_id, regions [{points [{x,y,z}], color {r,g,b}}]. One type per
        /// colour ("Fill r-g-b"). Use them for finish shading in schematic views; they draw over model geometry behind.
        /// </summary>
        private static JsonNode CreateFilledRegions(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var regions = p["regions"] as JsonArray ?? throw new ArgumentException("regions is required.");
            return InTransaction(doc, "Create filled regions", () =>
            {
                var solid = new FilteredElementCollector(doc).OfClass(typeof(FillPatternElement)).Cast<FillPatternElement>().First(f => f.GetFillPattern().IsSolidFill);
                var baseType = new FilteredElementCollector(doc).OfClass(typeof(FilledRegionType)).Cast<FilledRegionType>().First();
                var ids = new JsonArray();
                foreach (var node in regions)
                {
                    var o = node.AsObject();
                    var color = ColorOf(o, "color");
                    var typeName = $"Fill {color.Red}-{color.Green}-{color.Blue}";
                    var type = new FilteredElementCollector(doc).OfClass(typeof(FilledRegionType)).Cast<FilledRegionType>().FirstOrDefault(t => t.Name == typeName);
                    if (type == null)
                    {
                        type = (FilledRegionType)baseType.Duplicate(typeName);
                        type.ForegroundPatternId = solid.Id;
                        type.ForegroundPatternColor = color;
                        type.BackgroundPatternId = ElementId.InvalidElementId;
                        type.LineWeight = 1;
                    }
                    var pts = (o["points"] as JsonArray ?? throw new ArgumentException("points is required.")).Select(n => OnViewPlane(view, ToPoint(n))).ToList();
                    var loop = new CurveLoop();
                    for (var i = 0; i < pts.Count; i++) loop.Append(Line.CreateBound(pts[i], pts[(i + 1) % pts.Count]));
                    ids.Add(FilledRegion.Create(doc, type.Id, view.Id, new List<CurveLoop> { loop }).Id.Value);
                }
                return new JsonObject { ["count"] = ids.Count, ["ids"] = ids };
            });
        }

        /// <summary>
        /// import_cad: import a DWG into a view (a 1:1 drafting view for a CAD sheet's linework), in millimetres,
        /// origin to origin, colours kept, current view only. Params: view_id, path, color? "preserve"|"black"
        /// (default preserve), custom_scale? (multiply the file's millimetres, e.g. 13 to put a sheet-mm cut into a 1:13 view). Returns the import's id and its extents in the view.
        /// </summary>
        private static JsonNode ImportCad(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var path = Path.GetFullPath(ReqStr(p, "path"));
            if (!File.Exists(path)) throw new ArgumentException($"No file at {path}.");
            var opts = new DWGImportOptions
            {
                Unit = Num(p, "custom_scale").HasValue ? ImportUnit.Custom : ImportUnit.Millimeter,
                Placement = ImportPlacement.Origin,
                ColorMode = (Str(p, "color") ?? "preserve") == "black" ? ImportColorMode.BlackAndWhite : ImportColorMode.Preserved,
                ThisViewOnly = true,
                OrientToView = true,
                VisibleLayersOnly = true,
            };
            // custom_scale: file units are millimetres times this factor (a sheet cut to sheet mm, imported into a 1:n view).
            if (Num(p, "custom_scale") is double cs) opts.CustomScale = cs / 304.8;
            return InTransaction(doc, "Import CAD", () =>
            {
                if (!doc.Import(path, opts, view, out ElementId id)) throw new InvalidOperationException("Revit did not import the file.");
                var bb = doc.GetElement(id)?.get_BoundingBox(view);
                return new JsonObject
                {
                    ["id"] = id.Value,
                    ["min"] = bb == null ? null : new JsonObject { ["x"] = ToMm(bb.Min.X), ["y"] = ToMm(bb.Min.Y) },
                    ["max"] = bb == null ? null : new JsonObject { ["x"] = ToMm(bb.Max.X), ["y"] = ToMm(bb.Max.Y) },
                };
            });
        }

        /// <summary>
        /// save_cloud_copy: open a cloud (ACC / Autodesk Docs) model detached from its central, save it as a plain local
        /// file and close it. Gives a local host something to link, since Revit links cloud models only into cloud hosts.
        /// The central on ACC is not changed. Params: region? (default US), project_guid, model_guid, save_path.
        /// </summary>
        private static JsonNode SaveCloudCopy(UIApplication app, JsonObject p)
        {
            var region = Str(p, "region") ?? "US";
            var cloud = ModelPathUtils.ConvertCloudGUIDsToCloudPath(region, Guid.Parse(ReqStr(p, "project_guid")), Guid.Parse(ReqStr(p, "model_guid")));
            var savePath = Path.GetFullPath(ReqStr(p, "save_path"));
            if (File.Exists(savePath)) throw new ArgumentException($"{savePath} already exists; choose a new name.");
            // Revit will not detach a cloud model on open ("Detach option is not valid for cloud model"), so open it as is
            // (that only refreshes Revit's own local cache; nothing is synchronised back), then save a copy as a new
            // standalone central on disk and close without synchronising.
            var opts = new OpenOptions();
            opts.SetOpenWorksetsConfiguration(new WorksetConfiguration(WorksetConfigurationOption.OpenAllWorksets));
            var started = DateTime.Now;
            var d = app.Application.OpenDocumentFile(cloud, opts);
            try
            {
                var title = d.Title;
                var sa = new SaveAsOptions { OverwriteExistingFile = false };
                if (d.IsWorkshared) sa.SetWorksharingOptions(new WorksharingSaveAsOptions { SaveAsCentral = true });
                d.SaveAs(savePath, sa);
                return new JsonObject { ["title"] = title, ["saved"] = savePath, ["seconds"] = Math.Round((DateTime.Now - started).TotalSeconds),
                                        ["mb"] = Math.Round(new FileInfo(savePath).Length / 1048576.0) };
            }
            finally { d.Close(false); }
        }

        /// <summary>
        /// set_family_text_size: give text notes or labels in an instance's family a text type of their own at a new size,
        /// and reload the family. Use it when a title block label overflows its cell. Params: element_id (an instance),
        /// match (part of the note or label's text, as list_family_text shows it), size_mm, save_path?.
        /// The new type is a copy of the old one named "&lt;old&gt; &lt;size&gt; mm", so other texts keep theirs.
        /// </summary>
        private static JsonNode SetFamilyTextSize(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance ?? throw new ArgumentException("element_id is not a family instance.");
            var match = ReqStr(p, "match");
            var size = Num(p, "size_mm") ?? throw new ArgumentException("size_mm is required.");
            var savePath = p["save_path"]?.GetValue<string>();
            var fd = doc.EditFamily(target.Symbol.Family);
            try
            {
                var hits = new FilteredElementCollector(fd).OfClass(typeof(TextElement)).Cast<TextElement>()
                    .Where(t => (t.Text ?? "").IndexOf(match, StringComparison.OrdinalIgnoreCase) >= 0).ToList();
                if (hits.Count == 0) throw new ArgumentException($"No text or label in the family reads '{match}'.");
                var changed = new JsonArray();
                using (var t = new Transaction(fd, "MCP: Set family text size"))
                {
                    t.Start();
                    foreach (var te in hits)
                    {
                        var oldType = fd.GetElement(te.GetTypeId()) as ElementType;
                        var name = $"{oldType.Name} {size:0.##} mm";
                        var nt = new FilteredElementCollector(fd).OfClass(oldType.GetType()).Cast<ElementType>().FirstOrDefault(x => x.Name == name)
                                 ?? oldType.Duplicate(name);
                        nt.get_Parameter(BuiltInParameter.TEXT_SIZE)?.Set(FromMm(size));
                        te.ChangeTypeId(nt.Id);
                        changed.Add(new JsonObject { ["id"] = te.Id.Value, ["text"] = te.Text, ["type"] = name });
                    }
                    t.Commit();
                }
                if (!string.IsNullOrEmpty(savePath)) fd.SaveAs(savePath, new SaveAsOptions { OverwriteExistingFile = true });
                fd.LoadFamily(doc, new OverwriteFamily());
                return new JsonObject { ["changed"] = changed };
            }
            finally { fd.Close(false); }
        }

        /// <summary>
        /// place_image: Params: view_id, path, center {x,y} (sheet mm on a sheet, model mm in a model view),
        /// width_mm (same units), height_mm? (stretches to that height, proportions unlocked), foreground? (draw over model
        /// geometry; images default to Background and hide behind surfaces in hidden line).
        /// </summary>
        private static JsonNode PlaceImage(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var path = ReqStr(p, "path");
            if (!File.Exists(path)) throw new ArgumentException($"No file at {path}.");
            var width = Num(p, "width_mm") ?? throw new ArgumentException("width_mm is required.");
            var center = OnViewPlane(view, ReqPoint(p, "center"));
            return InTransaction(doc, "Place image", () =>
            {
                var type = new FilteredElementCollector(doc).OfClass(typeof(ImageType)).Cast<ImageType>()
                               .FirstOrDefault(t => string.Equals(t.Path, path, StringComparison.OrdinalIgnoreCase))
                           ?? ImageType.Create(doc, new ImageTypeOptions(path, false, ImageTypeSource.Import));
                var img = ImageInstance.Create(doc, view, type.Id, new ImagePlacementOptions(center, BoxPlacement.Center));
                var height = Num(p, "height_mm");
                if (height.HasValue)
                {   // stretch to an exact box (a photo scaled to an object's scheduled size)
                    img.LockProportions = false;
                    img.Height = FromMm(height.Value);
                }
                img.Width = FromMm(width);
                img.SetLocation(center, BoxPlacement.Center);
                if (p["foreground"]?.GetValue<bool>() ?? false)
                    img.get_Parameter(BuiltInParameter.IMPORT_BACKGROUND)?.Set(0);   // 0 = Foreground, 1 = Background
                return new JsonObject { ["id"] = img.Id.Value, ["type_id"] = type.Id.Value, ["width_mm"] = ToMm(img.Width), ["height_mm"] = ToMm(img.Height) };
            });
        }
    }
}
