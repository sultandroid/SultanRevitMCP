// PROPOSAL ONLY: not installed, registered, built or run by this task.
// Copy into an approved Handlers*.cs partial file only after review.
// Add to Handlers.Table:
// ["inspect_project_parameter_bindings"] = InspectProjectParameterBindings,
// Call through rvt.mjs with { document: exactFullPath, name_prefix: "RCRC_" }.
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
        /// <summary>Read bindings and unbound shared definitions; no transaction or application settings change.</summary>
        private static JsonNode InspectProjectParameterBindings(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            if (doc.IsFamilyDocument)
                throw new ArgumentException("Project parameter bindings require a project document.");
            var prefix = Str(p, "name_prefix") ?? "";
            var rows = new List<JsonObject>();
            var boundSharedIds = new HashSet<long>();
            var iterator = doc.ParameterBindings.ForwardIterator();
            iterator.Reset();
            while (iterator.MoveNext())
            {
                var definition = iterator.Key;
                var binding = iterator.Current as ElementBinding;
                SharedParameterElement shared = null;
                if (definition is InternalDefinition internalDefinition)
                    shared = doc.GetElement(internalDefinition.Id) as SharedParameterElement;
                else if (definition is ExternalDefinition externalDefinition)
                    shared = SharedParameterElement.Lookup(doc, externalDefinition.GUID);
                if (shared != null) boundSharedIds.Add(shared.Id.Value);
                if (!definition.Name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;

                var categories = binding == null ? new List<Category>() : binding.Categories.Cast<Category>()
                    .OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase).ToList();
                rows.Add(new JsonObject
                {
                    ["name"] = definition.Name,
                    ["parameter_element_id"] = (definition as InternalDefinition)?.Id.Value,
                    ["shared_parameter_element_id"] = shared?.Id.Value,
                    ["is_shared"] = shared != null,
                    ["guid"] = shared?.GuidValue.ToString("D"),
                    ["data_type_id"] = definition.GetDataType().TypeId,
                    ["binding_kind"] = binding is InstanceBinding ? "Instance" : binding is TypeBinding ? "Type" : "Other",
                    ["categories"] = new JsonArray(categories.Select(c => (JsonNode)new JsonObject
                    {
                        ["id"] = c.Id.Value,
                        ["name"] = c.Name
                    }).ToArray())
                });
            }

            // Also expose unbound shared definitions: a GUID/name collision can exist before a binding exists.
            var unbound = new FilteredElementCollector(doc).OfClass(typeof(SharedParameterElement))
                .Cast<SharedParameterElement>()
                .Where(e => !boundSharedIds.Contains(e.Id.Value) && e.Name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                .OrderBy(e => e.Name, StringComparer.OrdinalIgnoreCase)
                .Select(e => (JsonNode)new JsonObject
                {
                    ["name"] = e.Name,
                    ["shared_parameter_element_id"] = e.Id.Value,
                    ["guid"] = e.GuidValue.ToString("D"),
                    ["data_type_id"] = e.GetDefinition().GetDataType().TypeId,
                    ["binding_kind"] = "Unbound"
                }).ToArray();
            var bindings = rows.OrderBy(r => r["name"].GetValue<string>(), StringComparer.OrdinalIgnoreCase)
                .ThenBy(r => r["guid"]?.GetValue<string>() ?? "", StringComparer.OrdinalIgnoreCase)
                .Select(r => (JsonNode)r).ToArray();
            return new JsonObject
            {
                ["document"] = doc.PathName,
                ["title"] = doc.Title,
                ["name_prefix"] = prefix,
                ["binding_count"] = bindings.Length,
                ["bindings"] = new JsonArray(bindings),
                ["unbound_shared_parameter_count"] = unbound.Length,
                ["unbound_shared_parameters"] = new JsonArray(unbound)
            };
        }
    }
}
