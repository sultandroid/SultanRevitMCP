using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// Linked model diagnostics: link status, placement, extents, phases and phase mapping, and
    /// the creation GUIDs of host and link (a file copy keeps its GUID).
    /// </summary>
    internal static partial class Handlers
    {
        private static JsonArray PhaseNames(Document d)
        {
            var a = new JsonArray();
            foreach (Phase ph in d.Phases) a.Add(new JsonObject { ["id"] = ph.Id.Value, ["name"] = ph.Name });
            return a;
        }

        private static JsonNode ListPhases(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            return new JsonObject { ["phases"] = PhaseNames(doc), ["creation_guid"] = doc.CreationGUID.ToString() };
        }

        private static JsonNode InspectLink(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = doc.ActiveView;
            var links = new JsonArray();
            foreach (var inst in new FilteredElementCollector(doc).OfClass(typeof(RevitLinkInstance)).Cast<RevitLinkInstance>())
            {
                var type = doc.GetElement(inst.GetTypeId()) as RevitLinkType;
                var ld = inst.GetLinkDocument();
                var t = inst.GetTotalTransform();
                var bb = inst.get_BoundingBox(null);
                var o = new JsonObject
                {
                    ["id"] = inst.Id.Value,
                    ["name"] = inst.Name,
                    ["type_id"] = type?.Id.Value,
                    ["status"] = type?.GetLinkedFileStatus().ToString(),
                    ["is_loaded"] = type != null && RevitLinkType.IsLoaded(doc, type.Id),
                    ["origin"] = PointJson(t.Origin),
                    ["bounding_box"] = bb == null ? null : new JsonObject { ["min"] = PointJson(bb.Min), ["max"] = PointJson(bb.Max) },
                    ["hidden_in_active_view"] = view != null && inst.IsHidden(view),
                    ["link_doc"] = ld?.Title,
                    ["link_creation_guid"] = ld?.CreationGUID.ToString(),
                    ["link_phases"] = ld != null ? PhaseNames(ld) : null,
                    ["link_element_count"] = ld != null ? new FilteredElementCollector(ld).WhereElementIsNotElementType().Where(e => e.Category != null && e.Category.CategoryType == CategoryType.Model).Count() : 0,
                };
                if (type != null)
                {
                    var map = new JsonArray();
                    try
                    {
                        foreach (var kv in type.GetPhaseMap())
                            map.Add(new JsonObject
                            {
                                ["link_phase"] = ld?.GetElement(kv.Key)?.Name ?? kv.Key.Value.ToString(),
                                ["host_phase"] = doc.GetElement(kv.Value)?.Name ?? kv.Value.Value.ToString(),
                            });
                    }
                    catch (Exception ex) { map.Add(ex.Message); }
                    o["phase_map"] = map;
                }
                links.Add(o);
            }
            return new JsonObject
            {
                ["host_creation_guid"] = doc.CreationGUID.ToString(),
                ["host_phases"] = PhaseNames(doc),
                ["active_view"] = view?.Name,
                ["links"] = links,
            };
        }

        /// <summary>Reloads linked models from disk after they were edited in another Revit: all, or those whose file name contains "name".</summary>
        private static JsonNode ReloadLink(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var filter = Str(p, "name");
            var done = new JsonArray();
            foreach (var type in new FilteredElementCollector(doc).OfClass(typeof(RevitLinkType)).Cast<RevitLinkType>())
            {
                if (filter != null && type.Name.IndexOf(filter, StringComparison.OrdinalIgnoreCase) < 0) continue;
                var result = type.Reload();
                done.Add(new JsonObject { ["link"] = type.Name, ["result"] = result.LoadResult.ToString() });
            }
            return new JsonObject { ["reloaded"] = done };
        }
    }
}
