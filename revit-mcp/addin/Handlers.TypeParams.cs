using System;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    internal static partial class Handlers
    {
        private static ElementType FindTypeByName(Document doc, string name, string cls)
        {
            return new FilteredElementCollector(doc).WhereElementIsElementType().Cast<ElementType>()
                .FirstOrDefault(t => t.Name == name && (cls == null || t.GetType().Name == cls));
        }

        /// <summary>
        /// read_type_parameters: every writable parameter of a type (by type_id, or name + class such as DimensionType,
        /// TextNoteType), as portable data: numbers in internal units, element ids as the referenced element's name.
        /// Pair with apply_type_parameters to make one model's type match another's.
        /// </summary>
        private static JsonNode ReadTypeParameters(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var t = (p["type_id"] != null ? doc.GetElement(ReqId(p, "type_id")) as ElementType : FindTypeByName(doc, ReqStr(p, "name"), Str(p, "class")))
                    ?? throw new ArgumentException("type not found");
            var ps = new JsonArray();
            foreach (Parameter q in t.Parameters)
            {
                if (q.IsReadOnly || !q.HasValue) continue;
                var o = new JsonObject { ["name"] = q.Definition.Name, ["storage"] = q.StorageType.ToString() };
                if (q.Definition is InternalDefinition idf) o["builtin"] = idf.BuiltInParameter.ToString();
                switch (q.StorageType)
                {
                    case StorageType.Double: o["value"] = q.AsDouble(); break;
                    case StorageType.Integer: o["value"] = q.AsInteger(); break;
                    case StorageType.String: o["value"] = q.AsString(); break;
                    case StorageType.ElementId:
                        var e = doc.GetElement(q.AsElementId());
                        o["value_name"] = e?.Name; o["value_class"] = e?.GetType().Name; o["value_id"] = q.AsElementId().Value; break;
                    default: continue;
                }
                ps.Add(o);
            }
            return new JsonObject { ["document"] = doc.Title, ["name"] = t.Name, ["class"] = t.GetType().Name, ["family"] = t.FamilyName, ["parameters"] = ps };
        }

        /// <summary>
        /// apply_type_parameters: set the parameters read by read_type_parameters onto the same-named type of the same
        /// class in this model; if missing, duplicate the first type of that class (and family) under the name.
        /// Element-id values resolve by name in this model (built-in ids such as -1 are kept). Reports what it could not set.
        /// </summary>
        private static JsonNode ApplyTypeParameters(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var data = p["type"] as JsonObject ?? throw new ArgumentException("type (from read_type_parameters) is required.");
            var name = data["name"]!.GetValue<string>(); var cls = data["class"]?.GetValue<string>(); var fam = data["family"]?.GetValue<string>();
            var skipped = new JsonArray(); var set = 0; var created = false;
            return InTransaction(doc, $"Apply type parameters {name}", () =>
            {
                var t = FindTypeByName(doc, name, cls);
                if (t == null)
                {
                    var basis = new FilteredElementCollector(doc).WhereElementIsElementType().Cast<ElementType>()
                        .Where(x => x.GetType().Name == cls).OrderBy(x => x.FamilyName == fam ? 0 : 1).FirstOrDefault()
                        ?? throw new InvalidOperationException($"No {cls} in this model to start from.");
                    t = (ElementType)basis.Duplicate(name); created = true;
                }
                foreach (var node in data["parameters"]!.AsArray())
                {
                    var o = node!.AsObject();
                    var pname = o["name"]!.GetValue<string>();
                    Parameter q = null;
                    if (o["builtin"] is JsonValue b && Enum.TryParse<BuiltInParameter>(b.GetValue<string>(), out var bip) && bip != BuiltInParameter.INVALID) q = t.get_Parameter(bip);
                    q ??= t.LookupParameter(pname);
                    if (q == null || q.IsReadOnly) { skipped.Add($"{pname}: not on this type"); continue; }
                    if (q.Definition.Name == "Type Name") continue;
                    try
                    {
                        switch (q.StorageType)
                        {
                            case StorageType.Double: q.Set(o["value"]!.GetValue<double>()); break;
                            case StorageType.Integer: q.Set(o["value"]!.GetValue<int>()); break;
                            case StorageType.String: q.Set(o["value"]?.GetValue<string>() ?? ""); break;
                            case StorageType.ElementId:
                                var vid = o["value_id"]?.GetValue<long>() ?? -1;
                                var vname = o["value_name"]?.GetValue<string>(); var vcls = o["value_class"]?.GetValue<string>();
                                if (vid < 0 || vname == null) { q.Set(new ElementId(vid)); break; }
                                var target = new FilteredElementCollector(doc).WhereElementIsElementType().FirstOrDefault(x => x.Name == vname && x.GetType().Name == vcls)
                                             ?? new FilteredElementCollector(doc).WhereElementIsNotElementType().FirstOrDefault(x => x.Name == vname && x.GetType().Name == vcls);
                                if (target == null) { skipped.Add($"{pname}: '{vname}' not in this model"); continue; }
                                q.Set(target.Id); break;
                        }
                        set++;
                    }
                    catch (Exception ex) { skipped.Add($"{pname}: {ex.Message}"); }
                }
                return new JsonObject { ["type_id"] = t.Id.Value, ["name"] = t.Name, ["created"] = created, ["set"] = set, ["skipped"] = skipped };
            });
        }
    }
}
