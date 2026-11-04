using System;
using System.IO;
using Autodesk.Revit.UI;

namespace SultanRevitMCP
{
    /// <summary>Revit entry point: starts the local bridge when Revit starts.</summary>
    public class App : IExternalApplication
    {
        // Each Revit takes the first free port from 48884 up, so several Revits (one per session or model) run side by side.
        // REVIT_MCP_PORT pins one port instead.
        private const int FirstPort = 48884, LastPort = 48899;

        private BridgeServer _server;
        private ExternalEvent _event;

        public Result OnStartup(UIControlledApplication application)
        {
            // A bridge failure must never stop Revit from starting.
            try
            {
                var dispatcher = new CommandDispatcher();
                _event = ExternalEvent.Create(dispatcher);
                dispatcher.Attach(_event);
                var pinned = int.TryParse(Environment.GetEnvironmentVariable("REVIT_MCP_PORT"), out var p) ? p : 0;
                for (var port = pinned > 0 ? pinned : FirstPort; port <= (pinned > 0 ? pinned : LastPort); port++)
                {
                    try { var s = new BridgeServer(port, dispatcher); s.Start(); _server = s; Registry.Port = port; break; }
                    catch (System.Net.Sockets.SocketException) { Log.Write($"Port {port} is taken, trying the next."); }
                }
                if (_server == null) { Log.Write("No free bridge port."); return Result.Succeeded; }
                Log.Write($"Bridge listening on 127.0.0.1:{Registry.Port}");
                var events = application.ControlledApplication;
                events.DocumentOpened += (s, e) => Registry.Add(e.Document);
                events.DocumentCreated += (s, e) => Registry.Add(e.Document);
                events.DocumentSavedAs += (s, e) => Registry.Rename(e.OriginalPath, e.Document);
                events.DocumentClosing += (s, e) => Registry.Remove(e.Document);
                Registry.Write();
            }
            catch (Exception ex)
            {
                Log.Write($"Bridge failed to start: {ex}");
            }
            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            _server?.Stop();
            _event?.Dispose();
            Registry.Delete();
            return Result.Succeeded;
        }
    }

    /// <summary>
    /// %LOCALAPPDATA%\SultanRevitMCP\instances\&lt;pid&gt;.json: this Revit's bridge port and the models it has open, so a client
    /// can find the Revit that holds a given model. A file whose port no longer answers is stale and may be deleted by the client.
    /// </summary>
    internal static class Registry
    {
        public static int Port;
        private static readonly object Gate = new object();
        private static readonly System.Collections.Generic.Dictionary<string, string> Docs = new System.Collections.Generic.Dictionary<string, string>();
        private static readonly string Dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SultanRevitMCP", "instances");
        private static string FilePath => Path.Combine(Dir, $"{Environment.ProcessId}.json");

        public static void Add(Autodesk.Revit.DB.Document d) { if (d == null || d.IsLinked || d.IsFamilyDocument && string.IsNullOrEmpty(d.PathName)) return; lock (Gate) Docs[Key(d)] = d.Title; Write(); }
        public static void Remove(Autodesk.Revit.DB.Document d) { if (d == null) return; lock (Gate) Docs.Remove(Key(d)); Write(); }
        public static void Rename(string oldPath, Autodesk.Revit.DB.Document d) { lock (Gate) { if (oldPath != null) Docs.Remove(oldPath); } Add(d); }
        private static string Key(Autodesk.Revit.DB.Document d) => string.IsNullOrEmpty(d.PathName) ? d.Title : d.PathName;

        public static void Write()
        {
            try
            {
                lock (Gate)
                {
                    Directory.CreateDirectory(Dir);
                    var docs = new System.Text.Json.Nodes.JsonArray();
                    foreach (var kv in Docs) docs.Add(new System.Text.Json.Nodes.JsonObject { ["title"] = kv.Value, ["path"] = kv.Key });
                    var json = new System.Text.Json.Nodes.JsonObject { ["pid"] = Environment.ProcessId, ["port"] = Port, ["updated"] = DateTime.Now.ToString("s"), ["documents"] = docs };
                    File.WriteAllText(FilePath, json.ToJsonString());
                }
            }
            catch (Exception ex) { Log.Write($"Registry write failed: {ex.Message}"); }
        }

        public static void Delete() { try { File.Delete(FilePath); } catch { } }
    }

    internal static class Log
    {
        private static readonly object Gate = new object();
        private static readonly string FilePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SultanRevitMCP", "bridge.log");

        public static void Write(string message)
        {
            try
            {
                lock (Gate)
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
                    File.AppendAllText(FilePath, $"{DateTime.Now:s} {message}{Environment.NewLine}");
                }
            }
            catch
            {
                // Logging must never affect Revit.
            }
        }
    }
}
