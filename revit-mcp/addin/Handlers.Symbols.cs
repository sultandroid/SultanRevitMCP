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
    /// Device symbol commands: duplicate a type (optionally moving instances onto it), build a generic
    /// annotation symbol family, and nest that symbol in a device family's plan view so the symbol keeps
    /// its paper size at any view scale and travels with the device.
    /// </summary>
    internal static partial class Handlers
    {
        private const string DefaultAnnotationTemplate =
            @"C:\ProgramData\Autodesk\RVT 2026\Family Templates\English\Annotations\Metric Generic Annotation.rft";

        /// <summary>
        /// Duplicates an element type under a new name. instance_ids, if given, are moved onto the new type
        /// with ChangeTypeId; their location is read before and after so a move would be reported.
        /// type_comments, if given, is written to the new type (use it to record the legacy type name).
        /// </summary>
        private static JsonNode DuplicateType(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var source = RequireElement(doc, ReqId(p, "type_id")) as ElementType
                         ?? throw new ArgumentException("type_id is not an element type.");
            var name = ReqStr(p, "name");
            var instanceIds = p["instance_ids"] is JsonArray ? ReqIds(p, "instance_ids") : new List<ElementId>();
            var typeComments = Str(p, "type_comments");

            foreach (var id in instanceIds)
            {
                var e = RequireElement(doc, id);
                if (e.GetTypeId() != source.Id)
                    throw new ArgumentException($"Instance {id.Value} is not of type '{source.Name}'.");
            }

            return InTransaction(doc, $"Duplicate type {name}", () =>
            {
                var existing = new FilteredElementCollector(doc).OfClass(source.GetType()).Cast<ElementType>()
                    .FirstOrDefault(t => t.Name == name && t.FamilyName == source.FamilyName);
                if (existing != null) throw new ArgumentException($"A type named '{name}' already exists in '{source.FamilyName}'.");

                var copy = source.Duplicate(name);
                var newType = (ElementType)doc.GetElement(copy.Id);
                if (typeComments != null)
                    newType.get_Parameter(BuiltInParameter.ALL_MODEL_TYPE_COMMENTS)?.Set(typeComments);

                var moved = new JsonArray();
                var maxShift = 0.0;
                foreach (var id in instanceIds)
                {
                    var e = doc.GetElement(id);
                    var before = (e.Location as LocationPoint)?.Point;
                    e.ChangeTypeId(newType.Id);
                    doc.Regenerate();
                    var after = (doc.GetElement(id).Location as LocationPoint)?.Point;
                    var shift = before != null && after != null ? ToMm(before.DistanceTo(after)) : 0;
                    maxShift = Math.Max(maxShift, shift);
                    moved.Add(id.Value);
                }
                if (maxShift > 0.5)
                    throw new InvalidOperationException($"Changing type moved an instance by {maxShift} mm; rolled back.");

                return new JsonObject
                {
                    ["id"] = newType.Id.Value,
                    ["name"] = newType.Name,
                    ["family"] = newType.FamilyName,
                    ["instances_moved_onto_type"] = moved,
                    ["max_location_shift_mm"] = maxShift,
                };
            });
        }

        /// <summary>
        /// Builds a generic annotation family. Coordinates and sizes are paper millimetres about the
        /// family origin. Accepts lines [{start,end}], arcs [{center,radius,start_deg,end_deg}],
        /// circles [{center,radius}], fills [{points}] (solid, if the template has a filled region type)
        /// and texts [{at,text,size_mm,bold}]. The template's own text notes are removed.
        /// Saves to save_path; load_into_project also loads it into the active document.
        /// </summary>
        private static JsonNode CreateAnnotationSymbol(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var template = Str(p, "template_path") ?? DefaultAnnotationTemplate;
            if (!File.Exists(template)) throw new ArgumentException($"Template not found: '{template}'.");
            var savePath = ReqStr(p, "save_path");
            if (!savePath.EndsWith(".rfa", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("save_path must end in .rfa.");
            Directory.CreateDirectory(Path.GetDirectoryName(savePath));

            var fd = app.Application.NewFamilyDocument(template);
            var counts = new JsonObject();
            try
            {
                var view = new FilteredElementCollector(fd).OfClass(typeof(View)).Cast<View>()
                               .FirstOrDefault(v => !v.IsTemplate && v.ViewType != ViewType.ProjectBrowser
                                                    && v.ViewType != ViewType.SystemBrowser && v.ViewType != ViewType.Schedule)
                           ?? throw new InvalidOperationException("The annotation template has no drawing view.");

                using (var t = new Transaction(fd, "MCP: Build annotation symbol"))
                {
                    t.Start();
                    var notes = new FilteredElementCollector(fd).OfClass(typeof(TextNote)).ToElementIds();
                    if (notes.Count > 0) fd.Delete(notes);
                    counts["template_notes_removed"] = notes.Count;

                    var lines = 0;
                    foreach (var n in p["lines"] as JsonArray ?? new JsonArray())
                    {
                        var o = n.AsObject();
                        fd.FamilyCreate.NewDetailCurve(view, Line.CreateBound(ReqPoint(o, "start"), ReqPoint(o, "end")));
                        lines++;
                    }
                    foreach (var n in p["arcs"] as JsonArray ?? new JsonArray())
                    {
                        var o = n.AsObject();
                        var a0 = ReqNum(o, "start_deg") * Math.PI / 180;
                        var a1 = ReqNum(o, "end_deg") * Math.PI / 180;
                        fd.FamilyCreate.NewDetailCurve(view, Arc.Create(ReqPoint(o, "center"), FromMm(ReqNum(o, "radius")), a0, a1, XYZ.BasisX, XYZ.BasisY));
                        lines++;
                    }
                    foreach (var n in p["circles"] as JsonArray ?? new JsonArray())
                    {
                        var o = n.AsObject();
                        var c = ReqPoint(o, "center");
                        var r = FromMm(ReqNum(o, "radius"));
                        // Two halves: a closed arc is not accepted everywhere a curve is.
                        fd.FamilyCreate.NewDetailCurve(view, Arc.Create(c, r, 0, Math.PI, XYZ.BasisX, XYZ.BasisY));
                        fd.FamilyCreate.NewDetailCurve(view, Arc.Create(c, r, Math.PI, 2 * Math.PI, XYZ.BasisX, XYZ.BasisY));
                        lines += 2;
                    }
                    counts["curves"] = lines;

                    var fills = 0;
                    if (p["fills"] is JsonArray fillArray && fillArray.Count > 0)
                    {
                        var regionType = new FilteredElementCollector(fd).OfClass(typeof(FilledRegionType)).FirstElementId();
                        if (regionType == null || regionType == ElementId.InvalidElementId)
                            counts["fills_skipped"] = "template has no filled region type";
                        else
                            foreach (var n in fillArray)
                            {
                                var pts = (n["points"] as JsonArray ?? throw new ArgumentException("fill needs points.")).Select(ToPoint).ToList();
                                var loop = new CurveLoop();
                                for (var i = 0; i < pts.Count; i++) loop.Append(Line.CreateBound(pts[i], pts[(i + 1) % pts.Count]));
                                FilledRegion.Create(fd, regionType, view.Id, new List<CurveLoop> { loop });
                                fills++;
                            }
                    }
                    counts["fills"] = fills;

                    var texts = 0;
                    var baseType = fd.GetDefaultElementTypeId(ElementTypeGroup.TextNoteType);
                    foreach (var n in p["texts"] as JsonArray ?? new JsonArray())
                    {
                        var o = n.AsObject();
                        var size = ReqNum(o, "size_mm");
                        var bold = Bool(o, "bold");
                        var typeName = $"Symbol {size:0.##}mm{(bold ? " Bold" : "")}";
                        var type = new FilteredElementCollector(fd).OfClass(typeof(TextNoteType)).Cast<TextNoteType>().FirstOrDefault(x => x.Name == typeName)
                                   ?? (TextNoteType)((TextNoteType)fd.GetElement(baseType)).Duplicate(typeName);
                        type.get_Parameter(BuiltInParameter.TEXT_SIZE).Set(FromMm(size));
                        type.get_Parameter(BuiltInParameter.TEXT_FONT).Set("Arial");
                        type.get_Parameter(BuiltInParameter.TEXT_STYLE_BOLD).Set(bold ? 1 : 0);
                        type.get_Parameter(BuiltInParameter.TEXT_BACKGROUND).Set(1);
                        var options = new TextNoteOptions(type.Id) { HorizontalAlignment = HorizontalTextAlignment.Center };
                        TextNote.Create(fd, view.Id, ReqPoint(o, "at"), ReqStr(o, "text"), options);
                        texts++;
                    }
                    counts["texts"] = texts;
                    t.Commit();
                }

                fd.SaveAs(savePath, new SaveAsOptions { OverwriteExistingFile = true });
                if (Bool(p, "load_into_project"))
                {
                    var family = fd.LoadFamily(doc, new OverwriteFamily());
                    counts["project_family_id"] = family?.Id.Value;
                }
            }
            finally
            {
                fd.Close(false);
            }
            counts["path"] = savePath;
            counts["family"] = Path.GetFileNameWithoutExtension(savePath);
            return counts;
        }

        /// <summary>
        /// Loads an annotation symbol (annotation_path) into the family of element_id and places it in the
        /// family's plan view at location (mm, default origin), then reloads the family into the project.
        /// view_type: FloorPlan (default) or CeilingPlan. replace (default true) first removes earlier
        /// instances of the same symbol family. hide_model_in_plan (default true) hides the family's own
        /// model forms in plan and ceiling views; 3D and elevations are untouched. visibility_parameter, if
        /// given, binds the symbol's Visible to a Yes/No type parameter of that name (created if missing,
        /// default Yes), so types of one family can show different symbols. Instances are not moved.
        /// </summary>
        private static JsonNode NestAnnotationInFamily(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            var path = ReqStr(p, "annotation_path");
            if (!File.Exists(path)) throw new ArgumentException($"Annotation family not found: '{path}'.");
            var symbolFamilyName = Path.GetFileNameWithoutExtension(path);
            var viewType = Str(p, "view_type") ?? "FloorPlan";
            var wantType = viewType.Equals("CeilingPlan", StringComparison.OrdinalIgnoreCase) ? ViewType.CeilingPlan : ViewType.FloorPlan;
            var location = p["location"] != null ? ReqPoint(p, "location") : XYZ.Zero;
            var replace = p["replace"]?.GetValue<bool>() ?? true;
            var hideModel = p["hide_model_in_plan"]?.GetValue<bool>() ?? true;
            var visibilityParameter = Str(p, "visibility_parameter");

            // Record instance positions so the reload can be checked for movement.
            var familyId = target.Symbol.Family.Id;
            var before = new FilteredElementCollector(doc).OfClass(typeof(FamilyInstance)).Cast<FamilyInstance>()
                .Where(fi => fi.Symbol.Family.Id == familyId)
                .ToDictionary(fi => fi.Id, fi => (fi.Location as LocationPoint)?.Point);

            var result = new JsonObject();
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            try
            {
                var view = new FilteredElementCollector(familyDoc).OfClass(typeof(ViewPlan)).Cast<ViewPlan>()
                               .FirstOrDefault(v => !v.IsTemplate && v.ViewType == wantType)
                           ?? throw new InvalidOperationException($"The family has no {wantType} view to place the symbol in.");

                using (var t = new Transaction(familyDoc, "MCP: Nest annotation symbol"))
                {
                    t.Start();
                    var removed = 0;
                    if (replace)
                    {
                        var old = new FilteredElementCollector(familyDoc).OfClass(typeof(FamilyInstance)).Cast<FamilyInstance>()
                            .Where(fi => fi.Symbol.Family.Name == symbolFamilyName).Select(fi => fi.Id).ToList();
                        if (old.Count > 0) familyDoc.Delete(old);
                        removed = old.Count;
                    }
                    result["previous_symbols_removed"] = removed;

                    if (!familyDoc.LoadFamily(path, new OverwriteFamily(), out var symbolFamily))
                        symbolFamily = new FilteredElementCollector(familyDoc).OfClass(typeof(Family)).Cast<Family>()
                                           .FirstOrDefault(f => f.Name == symbolFamilyName)
                                       ?? throw new InvalidOperationException("Could not load the annotation family.");
                    var symbol = (FamilySymbol)familyDoc.GetElement(symbolFamily.GetFamilySymbolIds().First());
                    if (!symbol.IsActive) symbol.Activate();
                    var instance = familyDoc.FamilyCreate.NewFamilyInstance(location, symbol, view);
                    result["symbol_instance_id"] = instance.Id.Value;
                    result["view"] = view.Name;

                    if (visibilityParameter != null)
                    {
                        var fm = familyDoc.FamilyManager;
                        var fp = fm.get_Parameter(visibilityParameter);
                        if (fp == null)
                        {
                            fp = fm.AddParameter(visibilityParameter, GroupTypeId.Graphics, SpecTypeId.Boolean.YesNo, false);
                            foreach (FamilyType ft in fm.Types)
                            {
                                fm.CurrentType = ft;
                                fm.Set(fp, 1);
                            }
                        }
                        var visible = instance.get_Parameter(BuiltInParameter.IS_VISIBLE_PARAM)
                                      ?? throw new InvalidOperationException("The symbol instance has no Visible parameter.");
                        fm.AssociateElementParameterToFamilyParameter(visible, fp);
                        result["visibility_parameter"] = visibilityParameter;
                    }

                    var hidden = 0;
                    if (hideModel)
                    {
                        foreach (var form in new FilteredElementCollector(familyDoc).OfClass(typeof(GenericForm)).Cast<GenericForm>())
                        {
                            var vis = form.GetVisibility();
                            if (!vis.IsShownInTopBottom) continue;
                            vis.IsShownInTopBottom = false;
                            form.SetVisibility(vis);
                            hidden++;
                        }
                    }
                    result["model_forms_hidden_in_plan"] = hidden;
                    t.Commit();
                }
                familyDoc.LoadFamily(doc, new OverwriteFamily());
            }
            finally
            {
                familyDoc.Close(false);
            }

            var maxShift = 0.0;
            foreach (var kv in before)
            {
                var after = (doc.GetElement(kv.Key)?.Location as LocationPoint)?.Point;
                if (kv.Value != null && after != null) maxShift = Math.Max(maxShift, ToMm(kv.Value.DistanceTo(after)));
            }
            result["instances_checked"] = before.Count;
            result["max_location_shift_mm"] = maxShift;
            return result;
        }
    }
}
