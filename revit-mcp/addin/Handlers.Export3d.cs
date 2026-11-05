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
    /// export_view_dwg: exports one view (a 3D view for the workshop model) to DWG in mm, AutoCAD 2018, with solids as true
    /// ACIS 3D solids (default) or as polymesh. The carpentry 3D model for a fabrication package uses ACIS, so the workshop gets
    /// editable solids, not meshes. Params: view_id, folder, file_name, solids ("acis" | "mesh").
    /// </summary>
    internal static partial class Handlers
    {
        private static JsonNode ExportViewDwg(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var folder = ReqStr(p, "folder");
            var name = string.Join("_", ReqStr(p, "file_name").Split(Path.GetInvalidFileNameChars()));
            var mesh = (p["solids"]?.GetValue<string>() ?? "acis").Equals("mesh", StringComparison.OrdinalIgnoreCase);
            Directory.CreateDirectory(folder);
            var options = new DWGExportOptions
            {
                MergedViews = true,
                FileVersion = ACADVersion.R2018,
                TargetUnit = ExportUnit.Millimeter,
                SharedCoords = false,
                HideScopeBox = true,
                HideReferencePlane = true,
                HideUnreferenceViewTags = true,
                Colors = ExportColorMode.TrueColorPerView,
                ExportOfSolids = mesh ? SolidGeometry.Polymesh : SolidGeometry.ACIS,
            };
            var ok = doc.Export(folder, name, new List<ElementId> { view.Id }, options);
            var file = Path.Combine(folder, name + ".dwg");
            return new JsonObject { ["ok"] = ok, ["file"] = file, ["solids"] = mesh ? "mesh" : "acis", ["bytes"] = File.Exists(file) ? new FileInfo(file).Length : 0 };
        }
    }
}
