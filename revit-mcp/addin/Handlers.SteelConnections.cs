using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Structure;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// Revit Steel Connections (Advance Steel based): load connection types by their Autodesk class GUID and apply them to
    /// columns / beams. The GUIDs come from the Steel Connections rules database, table HRLDefinition (ClassID), in
    /// the LocalDB instance "SteelConnections2026" (e.g. "Tube base plate" {0AE8BF0C-E00D-48C6-94D3-1075FA614CE7}).
    /// This does what Steel tab > Connection Settings > Add does, without the dialog.
    /// </summary>
    internal static partial class Handlers
    {
        /// <summary>
        /// ensure_connection_types: create (or find) structural connection types. Params: types [{name, guid, family?}].
        /// family defaults to name. Existing types with the same name are reused.
        /// </summary>
        private static JsonNode EnsureConnectionTypes(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var items = p["types"] as JsonArray ?? throw new ArgumentException("types is required: [{name, guid}].");
            return InTransaction(doc, "Ensure steel connection types", () =>
            {
                var existing = new FilteredElementCollector(doc).OfClass(typeof(StructuralConnectionHandlerType))
                    .Cast<StructuralConnectionHandlerType>().ToList();
                var result = new JsonArray();
                foreach (var node in items)
                {
                    var o = node!.AsObject();
                    var name = ReqStr(o, "name");
                    var guid = Guid.Parse(ReqStr(o, "guid"));
                    var family = Str(o, "family") ?? name;
                    var t = existing.FirstOrDefault(x => x.Name == name);
                    var created = false;
                    if (t == null)
                    {
                        t = StructuralConnectionHandlerType.Create(doc, name, guid, family);
                        created = true;
                    }
                    result.Add(new JsonObject { ["name"] = t.Name, ["id"] = t.Id.Value, ["guid"] = t.ConnectionGuid.ToString(), ["created"] = created });
                }
                return new JsonObject { ["types"] = result };
            });
        }

        /// <summary>
        /// list_connection_types: the structural connection types in the model (name, id, GUID, kind).
        /// </summary>
        private static JsonNode ListConnectionTypes(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var list = new JsonArray();
            foreach (var t in new FilteredElementCollector(doc).OfClass(typeof(StructuralConnectionHandlerType)).Cast<StructuralConnectionHandlerType>())
                list.Add(new JsonObject { ["id"] = t.Id.Value, ["name"] = t.Name, ["guid"] = t.ConnectionGuid.ToString(), ["custom"] = t.IsCustom(), ["generic"] = t.IsGeneric(), ["detailed"] = t.IsDetailed() });
            var count = new FilteredElementCollector(doc).OfClass(typeof(StructuralConnectionHandler)).GetElementCount();
            return new JsonObject { ["types"] = list, ["connections_in_model"] = count };
        }

        /// <summary>
        /// create_structural_connections: apply one connection type to many member sets, one undo step. Params: type_id,
        /// items [{element_ids: [...]}] - the members in the order the connection expects (e.g. a column for a base plate;
        /// column then beam for a cap plate; main beam then secondary for an end plate). Members that refuse are reported.
        /// </summary>
        private static JsonNode CreateStructuralConnections(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var typeId = ReqId(p, "type_id");
            if (!(doc.GetElement(typeId) is StructuralConnectionHandlerType type)) throw new ArgumentException("type_id is not a structural connection type.");
            var items = p["items"] as JsonArray ?? throw new ArgumentException("items is required.");
            var made = new JsonArray();
            var failed = new JsonArray();
            var result = InTransaction(doc, $"Steel connections: {type.Name} x{items.Count}", () =>
            {
                foreach (var node in items)
                {
                    var ids = (node!["element_ids"] as JsonArray ?? throw new ArgumentException("each item needs element_ids"))
                        .Select(n => new ElementId(n!.GetValue<long>())).ToList();
                    try
                    {
                        var h = StructuralConnectionHandler.Create(doc, ids, typeId);
                        made.Add(new JsonObject { ["id"] = h.Id.Value, ["members"] = new JsonArray(ids.Select(i => (JsonNode)i.Value).ToArray()) });
                    }
                    catch (Exception e)
                    {
                        failed.Add(new JsonObject { ["members"] = new JsonArray(ids.Select(i => (JsonNode)i.Value).ToArray()), ["error"] = e.Message });
                    }
                }
                return new JsonObject { ["type"] = type.Name, ["created"] = made.Count, ["connections"] = made, ["failed"] = failed };
            });
            return result;
        }
    }
}
