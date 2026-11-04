using System;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// add_family_text: puts a fixed text note into a loaded family (a title block, say) and reloads it.
    /// Revit has no API to add a label, so a value that is the same on every sheet, such as the mall address
    /// on the Knowledge Economic City shops, goes in as fixed text.
    /// Params: element_id (an instance of the family), text, at {x, y} in family mm,
    ///         like_text (copy the text type of an existing note with this text) or type_name,
    ///         replace_text (optional: move and retext that note instead of adding one; makes reruns safe),
    ///         save_path (optional: also save the family .rfa there).
    /// </summary>
    internal static partial class Handlers
    {
        private static JsonNode AddFamilyText(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            var text = ReqStr(p, "text");
            var at = ReqPoint(p, "at");
            var likeText = p["like_text"]?.GetValue<string>();
            var typeName = p["type_name"]?.GetValue<string>();
            var replace = p["replace_text"]?.GetValue<string>() ?? text;
            var savePath = p["save_path"]?.GetValue<string>();
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            try
            {
                var notes = new FilteredElementCollector(familyDoc).OfClass(typeof(TextNote)).Cast<TextNote>().ToList();
                ElementId typeId = null;
                if (typeName != null)
                    typeId = new FilteredElementCollector(familyDoc).OfClass(typeof(TextNoteType)).FirstOrDefault(t => t.Name == typeName)?.Id
                             ?? throw new ArgumentException($"No text type named {typeName}.");
                else if (likeText != null)
                    typeId = notes.FirstOrDefault(n => n.Text.Trim() == likeText)?.GetTypeId()
                             ?? throw new ArgumentException($"No text note reads {likeText}.");
                var view = notes.FirstOrDefault()?.OwnerViewId
                           ?? new FilteredElementCollector(familyDoc).OfClass(typeof(View)).Cast<View>().First(v => !v.IsTemplate).Id;
                string action;
                long id;
                using (var transaction = new Transaction(familyDoc, "MCP: Add family text"))
                {
                    transaction.Start();
                    var existing = notes.FirstOrDefault(n => n.Text.Trim() == replace.Trim());
                    if (existing != null)
                    {
                        existing.Text = text;
                        existing.Coord = at;
                        if (typeId != null) existing.ChangeTypeId(typeId);
                        action = "updated";
                        id = existing.Id.Value;
                    }
                    else
                    {
                        var note = TextNote.Create(familyDoc, view, at, text, typeId ?? familyDoc.GetDefaultElementTypeId(ElementTypeGroup.TextNoteType));
                        action = "added";
                        id = note.Id.Value;
                    }
                    transaction.Commit();
                }
                if (!string.IsNullOrEmpty(savePath))
                    familyDoc.SaveAs(savePath, new SaveAsOptions { OverwriteExistingFile = true });
                familyDoc.LoadFamily(doc, new OverwriteFamily());
                return new JsonObject { ["action"] = action, ["note_id"] = id, ["family"] = target.Symbol.Family.Name, ["saved"] = savePath };
            }
            finally
            {
                familyDoc.Close(false);
            }
        }

        /// <summary>list_text_notes: text notes with their text, view and sheet. Params: view_id (optional), contains (optional, any of a list).</summary>
        private static JsonNode ListTextNotes(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var viewId = OptId(p, "view_id");
            var contains = (p["contains"] as JsonArray)?.Select(n => n.GetValue<string>()).ToList();
            var notes = (viewId != null ? new FilteredElementCollector(doc, viewId) : new FilteredElementCollector(doc)).OfClass(typeof(TextNote)).Cast<TextNote>();
            var items = new JsonArray();
            foreach (var t in notes)
            {
                if (contains != null && !contains.Any(c => t.Text.Contains(c))) continue;
                var owner = doc.GetElement(t.OwnerViewId) as View;
                items.Add(new JsonObject { ["id"] = t.Id.Value, ["text"] = t.Text, ["view_id"] = owner?.Id.Value, ["view"] = owner?.Name, ["sheet_number"] = (owner as ViewSheet)?.SheetNumber, ["x"] = t.Coord.X * MmPerFoot, ["y"] = t.Coord.Y * MmPerFoot });
            }
            return new JsonObject { ["count"] = items.Count, ["notes"] = items };
        }

        /// <summary>set_text_note: replaces the whole text of one note. Params: element_id, text.</summary>
        private static JsonNode SetTextNote(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var note = RequireElement(doc, ReqId(p, "element_id")) as TextNote ?? throw new ArgumentException("element_id is not a text note.");
            var text = ReqStr(p, "text");
            return InTransaction(doc, "Set text note", () => { note.Text = text; return new JsonObject { ["id"] = note.Id.Value }; });
        }
    }
}
