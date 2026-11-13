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
                    // Where the link comes from. For an ACC / Autodesk Docs model this gives the region and the project and
                    // model GUIDs that save_cloud_copy needs, so the live cloud version can be saved locally and linked.
                    try
                    {
                        var ext = type.GetExternalFileReference();
                        var mp = ext?.GetAbsolutePath() ?? ext?.GetPath();
                        if (mp != null)
                        {
                            o["path"] = ModelPathUtils.ConvertModelPathToUserVisiblePath(mp);
                            if (mp.CloudPath)
                            {
                                o["cloud_region"] = mp.Region;
                                o["cloud_project_guid"] = mp.GetProjectGUID().ToString();
                                o["cloud_model_guid"] = mp.GetModelGUID().ToString();
                            }
                        }
                    }
                    catch (Exception ex) { o["path_error"] = ex.Message; }
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

        /// <summary>
        /// Refits direct shapes in place: every vertex moves along one axis (x, y or z) by a piecewise-linear map,
        /// from[i] -> to[i] (ascending); outside the range the end shift applies. Each face is triangulated, its
        /// vertices mapped, and the shape rebuilt as tessellated geometry with the same materials. Element id, name
        /// and parameters stay. Use it to stretch a run of joinery to new bay sizes (e.g. arches 926/806 -> 880).
        /// </summary>
        private static JsonNode RemapShapes(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var ids = ReqIds(p, "element_ids");
            var axis = (Str(p, "axis") ?? "y").ToLowerInvariant();
            var from = (p["from"] as JsonArray ?? throw new ArgumentException("from is required.")).Select(n => FromMm(n.GetValue<double>())).ToArray();
            var to = (p["to"] as JsonArray ?? throw new ArgumentException("to is required.")).Select(n => FromMm(n.GetValue<double>())).ToArray();
            if (from.Length != to.Length || from.Length < 2) throw new ArgumentException("from and to need the same length (2 or more).");
            double Map(double v)
            {
                if (v <= from[0]) return v + (to[0] - from[0]);
                for (var i = 1; i < from.Length; i++)
                    if (v <= from[i]) return to[i - 1] + (v - from[i - 1]) * (to[i] - to[i - 1]) / (from[i] - from[i - 1]);
                return v + (to[^1] - from[^1]);
            }
            XYZ M(XYZ q) => axis == "x" ? new XYZ(Map(q.X), q.Y, q.Z) : axis == "z" ? new XYZ(q.X, q.Y, Map(q.Z)) : new XYZ(q.X, Map(q.Y), q.Z);
            var sourceTitle = Str(p, "source_document");
            var sourceDoc = sourceTitle == null ? null : app.Application.Documents.Cast<Document>().FirstOrDefault(d => d.Title.Equals(sourceTitle, StringComparison.OrdinalIgnoreCase))
                            ?? throw new ArgumentException($"source_document '{sourceTitle}' is not open.");
            var options = new Options { DetailLevel = ViewDetailLevel.Fine };
            return InTransaction(doc, "Remap shapes", () =>
            {
                var done = new JsonArray();
                foreach (var id in ids)
                {
                    var ds = doc.GetElement(id) as DirectShape;
                    if (ds == null) { done.Add(id.Value + ": not a direct shape"); continue; }
                    // Geometry from the same element id in another open document (an untouched backup), or from itself.
                    var srcEl = sourceDoc?.GetElement(id) ?? ds;
                    var solids = SolidsOf(srcEl.get_Geometry(options)).ToList();
                    var builder = new TessellatedShapeBuilder { Target = TessellatedShapeBuilderTarget.AnyGeometry, Fallback = TessellatedShapeBuilderFallback.Mesh };
                    var faces = 0;
                    foreach (var solid in solids)
                    {
                        builder.OpenConnectedFaceSet(true);
                        foreach (Face face in solid.Faces)
                        {
                            // A flat face is rebuilt whole (outer loop and holes), so no triangle edges show in views.
                            if (face is PlanarFace)
                            {
                                var loops = new List<IList<XYZ>>();
                                foreach (EdgeArray loop in face.EdgeLoops)
                                {
                                    var pts = new List<XYZ>();
                                    foreach (Edge edge in loop)
                                    {
                                        var seg = edge.AsCurveFollowingFace(face).Tessellate();
                                        for (var i = 0; i < seg.Count - 1; i++) pts.Add(M(seg[i]));
                                    }
                                    if (pts.Count >= 3) loops.Add(pts);
                                }
                                if (loops.Count > 0) { builder.AddFace(new TessellatedFace(loops, face.MaterialElementId)); faces++; continue; }
                            }
                            var mesh = face.Triangulate();
                            for (var t = 0; t < mesh.NumTriangles; t++)
                            {
                                var tri = mesh.get_Triangle(t);
                                builder.AddFace(new TessellatedFace(new List<XYZ> { M(tri.get_Vertex(0)), M(tri.get_Vertex(1)), M(tri.get_Vertex(2)) }, face.MaterialElementId));
                                faces++;
                            }
                        }
                        builder.CloseConnectedFaceSet();
                    }
                    builder.Build();
                    ds.SetShape(builder.GetBuildResult().GetGeometricalObjects());
                    done.Add($"{id.Value}: {faces} faces");
                }
                return new JsonObject { ["remapped"] = done };
            });
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
