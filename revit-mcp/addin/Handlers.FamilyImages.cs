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
    /// Title block upkeep without the Family Editor:
    ///   list_family_images      images inside an instance's family (type name, file, centre, size).
    ///   replace_family_image    reload image types from new files, keeping each image's centre and width.
    ///   list_family_parameters  family parameters, with GUIDs for shared ones (what a label is tied to).
    ///   bind_shared_parameters  add shared parameters to the project under given GUIDs, so labels tied to them fill.
    /// </summary>
    internal static partial class Handlers
    {
        private static Document OpenFamilyOf(Document doc, JsonObject p, out FamilyInstance target)
        {
            target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                     ?? throw new ArgumentException("element_id is not a family instance.");
            return doc.EditFamily(target.Symbol.Family);
        }

        private static JsonObject ImageInfo(Document fd, ImageInstance img)
        {
            var type = fd.GetElement(img.GetTypeId()) as ImageType;
            var c = img.GetLocation(BoxPlacement.Center);
            return new JsonObject
            {
                ["id"] = img.Id.Value,
                ["type"] = type?.Name,
                ["path"] = type?.Path,
                ["center"] = new JsonObject { ["x"] = ToMm(c.X), ["y"] = ToMm(c.Y) },
                ["width_mm"] = ToMm(img.Width),
                ["height_mm"] = ToMm(img.Height),
            };
        }

        /// <summary>list_family_images: Params: element_id.</summary>
        private static JsonNode ListFamilyImages(UIApplication app, JsonObject p)
        {
            var fd = OpenFamilyOf(Doc(app), p, out _);
            try
            {
                var items = new JsonArray();
                foreach (var img in new FilteredElementCollector(fd).OfClass(typeof(ImageInstance)).Cast<ImageInstance>())
                    items.Add(ImageInfo(fd, img));
                return new JsonObject { ["count"] = items.Count, ["images"] = items };
            }
            finally { fd.Close(false); }
        }

        /// <summary>
        /// replace_family_image: Params: element_id, items [{match, path}], save_path (optional).
        /// match is a case-insensitive part of the image type name or its file name. Each matching type is reloaded
        /// from path; every instance of it keeps its centre and width (pad the new file to the old proportions first,
        /// or the height changes). The family is then reloaded into the project.
        /// </summary>
        private static JsonNode ReplaceFamilyImage(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var items = p["items"] as JsonArray ?? throw new ArgumentException("items is required.");
            var savePath = p["save_path"]?.GetValue<string>();
            var fd = OpenFamilyOf(doc, p, out var target);
            try
            {
                var types = new FilteredElementCollector(fd).OfClass(typeof(ImageType)).Cast<ImageType>().ToList();
                var images = new FilteredElementCollector(fd).OfClass(typeof(ImageInstance)).Cast<ImageInstance>().ToList();
                var done = new JsonArray();
                using (var t = new Transaction(fd, "MCP: Replace family image"))
                {
                    t.Start();
                    foreach (var node in items)
                    {
                        var o = node.AsObject();
                        var match = ReqStr(o, "match");
                        var path = ReqStr(o, "path");
                        if (!File.Exists(path)) throw new ArgumentException($"No file at {path}.");
                        var hits = types.Where(ty => (ty.Name ?? "").IndexOf(match, StringComparison.OrdinalIgnoreCase) >= 0
                                                     || Path.GetFileName(ty.Path ?? "").IndexOf(match, StringComparison.OrdinalIgnoreCase) >= 0).ToList();
                        if (hits.Count == 0) throw new ArgumentException($"No image type matches {match}.");
                        foreach (var ty in hits)
                        {
                            var mine = images.Where(i => i.GetTypeId() == ty.Id)
                                             .Select(i => (img: i, c: i.GetLocation(BoxPlacement.Center), w: i.Width)).ToList();
                            var oldPath = ty.Path;
                            ty.ReloadFrom(new ImageTypeOptions(path, false, ImageTypeSource.Import));
                            foreach (var (img, c, w) in mine)
                            {
                                img.Width = w;
                                img.SetLocation(c, BoxPlacement.Center);
                            }
                            done.Add(new JsonObject { ["type"] = ty.Name, ["old"] = oldPath, ["new"] = path, ["instances"] = mine.Count,
                                                      ["now"] = new JsonArray(mine.Select(m => (JsonNode)ImageInfo(fd, m.img)).ToArray()) });
                        }
                    }
                    t.Commit();
                }
                if (!string.IsNullOrEmpty(savePath))
                    fd.SaveAs(savePath, new SaveAsOptions { OverwriteExistingFile = true });
                fd.LoadFamily(doc, new OverwriteFamily());
                return new JsonObject { ["family"] = target.Symbol.Family.Name, ["replaced"] = done, ["saved"] = savePath };
            }
            finally { fd.Close(false); }
        }

        /// <summary>list_family_parameters: Params: element_id.</summary>
        private static JsonNode ListFamilyParameters(UIApplication app, JsonObject p)
        {
            var fd = OpenFamilyOf(Doc(app), p, out _);
            try
            {
                var items = new JsonArray();
                foreach (FamilyParameter fp in fd.FamilyManager.Parameters)
                {
                    items.Add(new JsonObject
                    {
                        ["name"] = fp.Definition.Name,
                        ["shared"] = fp.IsShared,
                        ["guid"] = fp.IsShared ? fp.GUID.ToString() : null,
                        ["instance"] = fp.IsInstance,
                        ["builtin"] = (fp.Definition as InternalDefinition)?.BuiltInParameter.ToString(),
                        ["storage"] = fp.StorageType.ToString(),
                        ["spec"] = fp.Definition.GetDataType()?.TypeId,
                    });
                }
                // Labels in a title block tie to sheet or project parameters; a shared one added to a label lives
                // in the family as a SharedParameterElement, not as a family parameter.
                var shared = new JsonArray();
                foreach (var sp in new FilteredElementCollector(fd).OfClass(typeof(SharedParameterElement)).Cast<SharedParameterElement>())
                    shared.Add(new JsonObject { ["name"] = sp.Name, ["guid"] = sp.GuidValue.ToString(), ["spec"] = sp.GetDefinition()?.GetDataType()?.TypeId });
                return new JsonObject { ["count"] = items.Count, ["parameters"] = items, ["label_shared_parameters"] = shared };
            }
            finally { fd.Close(false); }
        }

        /// <summary>
        /// bind_shared_parameters: Params: parameters [{name, guid}] (text parameters), categories (default ["OST_Sheets"]).
        /// Writes the definitions to a scratch shared parameter file with the given GUIDs and binds them as instance
        /// parameters. A GUID already in the project is skipped. The user's shared parameter file setting is restored.
        /// </summary>
        private static JsonNode BindSharedParameters(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var list = p["parameters"] as JsonArray ?? throw new ArgumentException("parameters is required.");
            var cats = (p["categories"] as JsonArray)?.Select(n => n.GetValue<string>()).ToList() ?? new List<string> { "OST_Sheets" };
            var rvt = app.Application;
            var oldFile = rvt.SharedParametersFilename;
            var tmp = Path.Combine(Path.GetTempPath(), $"sultan_sp_{Guid.NewGuid():N}.txt");
            File.WriteAllText(tmp, "");
            var result = new JsonArray();
            try
            {
                rvt.SharedParametersFilename = tmp;
                var file = rvt.OpenSharedParameterFile();
                var group = file.Groups.Create("Bridge");
                var catSet = rvt.Create.NewCategorySet();
                foreach (var c in cats)
                {
                    if (!Enum.TryParse<BuiltInCategory>(c, out var bic)) throw new ArgumentException($"Unknown category {c}.");
                    catSet.Insert(Category.GetCategory(doc, bic));
                }
                using (var t = new Transaction(doc, "MCP: Bind shared parameters"))
                {
                    t.Start();
                    foreach (var node in list)
                    {
                        var o = node.AsObject();
                        var name = ReqStr(o, "name");
                        var guid = Guid.Parse(ReqStr(o, "guid"));
                        // A loaded title block brings its label parameters into the project as SharedParameterElements,
                        // unbound, so "present" is not "bound". Check the bindings themselves.
                        var existing = SharedParameterElement.Lookup(doc, guid);
                        if (existing != null && doc.ParameterBindings.get_Item(existing.GetDefinition()) != null)
                        {
                            if (p["expand_categories"]?.GetValue<bool>() == true)
                            {
                                var actual = existing.GetDefinition();
                                if (existing.Name != name || actual.GetDataType() != SpecTypeId.String.Text)
                                    throw new ArgumentException($"Shared parameter {guid} has a conflicting name or datatype.");
                                var oldBinding = doc.ParameterBindings.get_Item(actual) as InstanceBinding
                                    ?? throw new ArgumentException($"Shared parameter {name} is not instance bound.");
                                var union = rvt.Create.NewCategorySet();
                                foreach (Category c in oldBinding.Categories) union.Insert(c);
                                foreach (Category c in catSet) if (!union.Contains(c)) union.Insert(c);
                                if (union.Size != oldBinding.Categories.Size)
                                {
                                    if (!doc.ParameterBindings.ReInsert(actual, rvt.Create.NewInstanceBinding(union), GroupTypeId.IdentityData))
                                        throw new InvalidOperationException($"Could not expand categories for {name}.");
                                    result.Add(new JsonObject { ["name"] = name, ["status"] = "bound (categories expanded)", ["category_count"] = union.Size });
                                    continue;
                                }
                            }
                            result.Add(new JsonObject { ["name"] = existing.Name, ["status"] = "already bound" });
                            continue;
                        }
                        var def = group.Definitions.Create(new ExternalDefinitionCreationOptions(name, SpecTypeId.String.Text) { GUID = guid });
                        var binding = rvt.Create.NewInstanceBinding(catSet);
                        var ok = doc.ParameterBindings.Insert(def, binding, GroupTypeId.IdentityData)
                                 || doc.ParameterBindings.ReInsert(def, binding, GroupTypeId.IdentityData);
                        result.Add(new JsonObject { ["name"] = name, ["status"] = ok ? (existing != null ? "bound (was unbound)" : "bound") : "failed" });
                    }
                    t.Commit();
                }
            }
            finally
            {
                rvt.SharedParametersFilename = oldFile ?? "";
                try { File.Delete(tmp); } catch { }
            }
            return new JsonObject { ["results"] = result };
        }
    }
}
