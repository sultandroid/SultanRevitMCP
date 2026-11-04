using System.Text.Json.Nodes;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// The public face of the handlers assembly. The loader finds this type by name and calls it through reflection,
    /// so the loader never references a handlers build and any newer build can replace it in a running Revit.
    /// </summary>
    public static class Entry
    {
        public static bool Has(string command) => Handlers.Has(command);

        public static JsonNode Run(UIApplication app, string command, JsonObject parameters) => Handlers.Run(app, command, parameters);
    }
}
