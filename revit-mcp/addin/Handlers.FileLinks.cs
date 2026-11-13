using System;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    internal static partial class Handlers
    {
        /// <summary>
        /// file_links: read the external references (Revit links, CAD links...) saved in an .rvt file on disk, without
        /// opening it (TransmissionData). For ACC / Autodesk Docs references it returns the region and the project and model
        /// GUIDs that save_cloud_copy needs. Revit strips these from a model while it is loaded as a link, so this is the way
        /// to find which cloud model a local copy was linked to. Params: path (absolute .rvt).
        /// </summary>
        private static JsonNode FileLinks(UIApplication app, JsonObject p)
        {
            var path = ReqStr(p, "path");
            if (!Path.IsPathRooted(path) || !File.Exists(path)) return Failed($"File not found: {path}");
            var data = TransmissionData.ReadTransmissionData(ModelPathUtils.ConvertUserVisiblePathToModelPath(path))
                       ?? throw new InvalidOperationException("The file holds no transmission data (not a Revit project, or saved by an add-in that strips it).");
            var items = new JsonArray();
            foreach (var id in data.GetAllExternalFileReferenceIds())
            {
                var r = data.GetLastSavedReferenceData(id);
                var o = new JsonObject { ["id"] = id.Value, ["type"] = r.ExternalFileReferenceType.ToString(), ["status"] = r.GetLinkedFileStatus().ToString() };
                try
                {
                    var mp = r.GetAbsolutePath() ?? r.GetPath();
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
                items.Add(o);
            }
            return new JsonObject { ["file"] = path, ["count"] = items.Count, ["references"] = items };
        }

        /// <summary>
        /// cloud_model_links: open an ACC / Autodesk Docs model in the background (all worksets closed, never shown or
        /// activated), list its Revit links with their cloud region / project / model GUIDs and placement, and close it
        /// without synchronising. Use the GUIDs with save_cloud_copy to get the live version of a linked model.
        /// Params: region (default US), project_guid, model_guid.
        /// </summary>
        private static JsonNode CloudModelLinks(UIApplication app, JsonObject p)
        {
            var region = Str(p, "region") ?? "US";
            var cloud = ModelPathUtils.ConvertCloudGUIDsToCloudPath(region, Guid.Parse(ReqStr(p, "project_guid")), Guid.Parse(ReqStr(p, "model_guid")));
            foreach (Document open in app.Application.Documents)
                if (!open.IsLinked && open.IsModelInCloud && open.GetCloudModelPath() is ModelPath op
                    && op.GetModelGUID() == cloud.GetModelGUID())
                    return Failed($"'{open.Title}' is already open in this Revit; read its links with inspect_link (document = its title).");
            var opts = new OpenOptions();
            opts.SetOpenWorksetsConfiguration(new WorksetConfiguration(WorksetConfigurationOption.CloseAllWorksets));
            var started = DateTime.Now;
            var d = app.Application.OpenDocumentFile(cloud, opts);
            try
            {
                var items = new JsonArray();
                foreach (var type in new FilteredElementCollector(d).OfClass(typeof(RevitLinkType)).Cast<RevitLinkType>())
                {
                    var o = new JsonObject { ["name"] = type.Name, ["status"] = type.GetLinkedFileStatus().ToString() };
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
                    // Cloud links are external resources, not external files: their ids sit in the reference information.
                    try
                    {
                        var res = new JsonArray();
                        foreach (var kv in type.GetExternalResourceReferences())
                        {
                            var r = kv.Value;
                            var info = new JsonObject();
                            foreach (var pair in r.GetReferenceInformation()) info[pair.Key] = pair.Value;
                            res.Add(new JsonObject { ["server_id"] = r.ServerId.ToString(), ["in_session_path"] = r.InSessionPath, ["display"] = r.GetResourceShortDisplayName(), ["info"] = info });
                        }
                        if (res.Count > 0) o["external_resources"] = res;
                    }
                    catch (Exception ex) { o["resource_error"] = ex.Message; }
                    var placements = new JsonArray();
                    foreach (var inst in new FilteredElementCollector(d).OfClass(typeof(RevitLinkInstance)).Cast<RevitLinkInstance>())
                        if (inst.GetTypeId() == type.Id) placements.Add(PointJson(inst.GetTotalTransform().Origin));
                    o["instance_origins"] = placements;
                    items.Add(o);
                }
                return new JsonObject { ["model"] = d.Title, ["seconds"] = Math.Round((DateTime.Now - started).TotalSeconds), ["links"] = items };
            }
            finally { d.Close(false); }
        }
    }
}
