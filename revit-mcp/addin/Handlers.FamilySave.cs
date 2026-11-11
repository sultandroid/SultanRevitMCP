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
        /// save_family_copy: save a family loaded in this model as an .rfa file (by family_name, or by an instance's
        /// element_id). overwrite: replace an existing file. Use it to keep the repository copy of a shared family
        /// (title blocks) the same as the one in use, so other models load the right version.
        /// </summary>
        /// <summary>update_revision: change a revision's description, date, issued by / to, or issued flag.</summary>
        private static JsonNode UpdateRevision(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var r = RequireElement(doc, ReqId(p, "revision_id")) as Revision ?? throw new ArgumentException("revision_id is not a revision.");
            return InTransaction(doc, "Update revision", () =>
            {
                if (Str(p, "description") is string d) r.Description = d;
                if (Str(p, "date") is string dt) r.RevisionDate = dt;
                if (Str(p, "issued_by") is string ib) r.IssuedBy = ib;
                if (Str(p, "issued_to") is string it) r.IssuedTo = it;
                if (p["issued"] != null) r.Issued = p["issued"]!.GetValue<bool>();
                return new JsonObject { ["id"] = r.Id.Value, ["number"] = r.RevisionNumber, ["description"] = r.Description, ["date"] = r.RevisionDate };
            });
        }

        private static JsonNode SaveFamilyCopy(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var path = ReqStr(p, "path");
            if (!System.IO.Path.IsPathRooted(path) || !path.EndsWith(".rfa", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("path must be an absolute .rfa path.");
            Family fam = null;
            if (p["element_id"] != null) fam = (RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance)?.Symbol.Family;
            var name = Str(p, "family_name");
            if (fam == null && name != null) fam = new FilteredElementCollector(doc).OfClass(typeof(Family)).Cast<Family>().FirstOrDefault(f => f.Name == name);
            if (fam == null) throw new ArgumentException("family not found (give family_name or an instance element_id).");
            var overwrite = p["overwrite"]?.GetValue<bool>() == true;
            if (System.IO.File.Exists(path) && !overwrite) throw new InvalidOperationException($"{path} exists; pass overwrite: true to replace it.");
            var fdoc = doc.EditFamily(fam);
            try
            {
                fdoc.SaveAs(path, new SaveAsOptions { OverwriteExistingFile = overwrite, MaximumBackups = 1 });
            }
            finally { fdoc.Close(false); }
            return new JsonObject { ["family"] = fam.Name, ["path"] = path, ["bytes"] = new System.IO.FileInfo(path).Length };
        }
    }
}
