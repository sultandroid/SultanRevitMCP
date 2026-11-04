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

        /// <summary>
        /// Takes the shared coordinates of a linked model into the host (Manage > Coordinates > Acquire).
        /// The host's own geometry does not move; only its survey point and shared coordinate system change.
        /// </summary>
        private static JsonNode AcquireCoordinates(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var inst = RequireElement(doc, ReqId(p, "link_instance_id")) as RevitLinkInstance
                ?? throw new ArgumentException("link_instance_id is not a linked model instance.");
            if (inst.GetLinkDocument() == null) throw new InvalidOperationException("The link is not loaded. Reload it first.");
            return InTransaction(doc, "Acquire coordinates", () =>
            {
                doc.AcquireCoordinates(inst.Id);
                var loc = doc.ActiveProjectLocation;
                var pos = loc.GetProjectPosition(XYZ.Zero);
                return new JsonObject
                {
                    ["from_link"] = inst.Name,
                    ["project_location"] = loc.Name,
                    ["origin_east_mm"] = ToMm(pos.EastWest),
                    ["origin_north_mm"] = ToMm(pos.NorthSouth),
                    ["origin_elevation_mm"] = ToMm(pos.Elevation),
                    ["angle_to_true_north_deg"] = pos.Angle * 180 / Math.PI,
                };
            });
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

        /// <summary>
        /// Hides the levels that come from linked models in the given views. The host's own levels must have
        /// "Building Story" = No; links keep the default Yes. A view filter on Levels with Building Story = Yes is
        /// added hidden to each view (host filters also act on linked elements shown By Host View).
        /// </summary>
        private static JsonNode HideLinkedLevels(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var viewIds = ReqIds(p, "view_ids");
            const string name = "Levels from linked models (Building Story = Yes)";
            return InTransaction(doc, "Hide linked levels", () =>
            {
                var cats = new List<ElementId> { new ElementId(BuiltInCategory.OST_Levels) };
                var filter = new FilteredElementCollector(doc).OfClass(typeof(ParameterFilterElement)).Cast<ParameterFilterElement>().FirstOrDefault(f => f.Name == name);
                if (filter == null)
                {
                    var rule = ParameterFilterRuleFactory.CreateEqualsRule(new ElementId(BuiltInParameter.LEVEL_IS_BUILDING_STORY), 1);
                    filter = ParameterFilterElement.Create(doc, name, cats, new ElementParameterFilter(rule));
                }
                var done = new JsonArray();
                foreach (var id in viewIds)
                {
                    var view = doc.GetElement(id) as View;
                    if (view == null || !view.AreGraphicsOverridesAllowed()) { done.Add(id.Value + ": skipped"); continue; }
                    if (!view.GetFilters().Contains(filter.Id)) view.AddFilter(filter.Id);
                    view.SetFilterVisibility(filter.Id, false);
                    done.Add(id.Value + ": hidden");
                }
                return new JsonObject { ["filter_id"] = filter.Id.Value, ["views"] = done };
            });
        }

        /// <summary>
        /// Reports how the Project Browser groups sheets (read-only in the API): the current organisation's name and,
        /// for one sheet, the folder levels it falls in (parameter name and folder name).
        /// </summary>
        private static JsonNode SheetBrowserInfo(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var org = BrowserOrganization.GetCurrentBrowserOrganizationForSheets(doc);
            var sheet = new FilteredElementCollector(doc).OfClass(typeof(ViewSheet)).Cast<ViewSheet>().FirstOrDefault(s => !s.IsPlaceholder);
            var folders = new JsonArray();
            if (org != null && sheet != null)
                foreach (var f in org.GetFolderItems(sheet.Id))
                    folders.Add(new JsonObject { ["parameter"] = (doc.GetElement(f.ElementId) as ParameterElement)?.Name ?? ((BuiltInParameter)f.ElementId.Value).ToString(), ["folder"] = f.Name });
            return new JsonObject
            {
                ["organisation"] = org?.Name,
                ["sample_sheet"] = sheet?.SheetNumber,
                ["folders"] = folders,
                ["groups_by_sheet_group"] = folders.Any(f => f["parameter"]?.GetValue<string>() == "Sheet Group"),
            };
        }

        /// <summary>Lists public members of a Revit API type (diagnostic), e.g. "Autodesk.Revit.DB.RevitLinkGraphicsSettings".</summary>
        private static JsonNode ApiMembers(UIApplication app, JsonObject p)
        {
            var t = typeof(Document).Assembly.GetType(ReqStr(p, "type")) ?? throw new ArgumentException("type not found");
            var a = new JsonArray();
            foreach (var m in t.GetMembers(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.DeclaredOnly))
                a.Add(m.MemberType + " " + m);
            return new JsonObject { ["members"] = a };
        }
    }
}
