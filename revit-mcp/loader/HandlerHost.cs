using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json.Nodes;
using Autodesk.Revit.UI;

namespace SultanRevitMCP
{
    /// <summary>
    /// Holds the current handlers build. Each build is read from bytes into its own collectible load context, so the DLL on disk
    /// is never locked and a newer build can replace it while Revit runs: build, copy to a new version folder, call reload_handlers.
    /// Builds live in %LOCALAPPDATA%\SultanRevitMCP\handlers\&lt;version&gt;\, newest folder name wins; the copy next to the loader is
    /// the fallback when none exists.
    /// </summary>
    internal static class HandlerHost
    {
        private const string AssemblyFile = "SultanRevitMCP.Handlers.dll";
        private const string EntryType = "RevitMcp.Entry";

        public static readonly string BuildsDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SultanRevitMCP", "handlers");

        private static readonly object Gate = new object();
        private static AssemblyLoadContext _context;
        private static Func<string, bool> _has;
        private static Func<UIApplication, string, JsonObject, JsonNode> _run;
        private static string _source = "none";
        private static DateTime _loadedAt;

        // Commands the loader answers itself, so they work even when no handlers build loads.
        public static bool Has(string command)
        {
            if (command == "reload_handlers" || command == "handlers_info") return true;
            EnsureLoaded();
            return _has != null && _has(command);
        }

        public static JsonNode Run(UIApplication app, string command, JsonObject parameters)
        {
            if (command == "reload_handlers") return Load();
            if (command == "handlers_info") return Info();
            EnsureLoaded();
            if (_run == null) throw new InvalidOperationException($"No handlers build is loaded ({_source}). Build it and call reload_handlers.");
            return _run(app, command, parameters);
        }

        private static void EnsureLoaded()
        {
            if (_run != null) return;
            try { Load(); } catch (Exception ex) { Log.Write($"Handlers failed to load: {ex}"); }
        }

        /// <summary>Loads the newest build and drops the previous one. Runs on Revit's main thread, between commands.</summary>
        private static JsonNode Load()
        {
            lock (Gate)
            {
                var path = NewestBuild() ?? throw new FileNotFoundException($"No {AssemblyFile} in {BuildsDir} or next to the loader.");
                var pdb = Path.ChangeExtension(path, ".pdb");
                var context = new AssemblyLoadContext($"SultanRevitMCP handlers {DateTime.Now:HHmmss}", isCollectible: true);
                Assembly assembly;
                using (var dll = new MemoryStream(File.ReadAllBytes(path)))
                using (var symbols = File.Exists(pdb) ? new MemoryStream(File.ReadAllBytes(pdb)) : null)
                    assembly = context.LoadFromStream(dll, symbols);
                var entry = assembly.GetType(EntryType, throwOnError: true);
                var has = (Func<string, bool>)Delegate.CreateDelegate(typeof(Func<string, bool>), entry.GetMethod("Has"));
                var run = (Func<UIApplication, string, JsonObject, JsonNode>)Delegate.CreateDelegate(typeof(Func<UIApplication, string, JsonObject, JsonNode>), entry.GetMethod("Run"));

                var old = _context;
                _context = context; _has = has; _run = run; _source = path; _loadedAt = DateTime.Now;
                old?.Unload();
                Log.Write($"Handlers loaded from {path}");
                return Info();
            }
        }

        private static JsonNode Info() => new JsonObject
        {
            ["source"] = _source,
            ["version"] = _source == "none" ? null : Path.GetFileName(Path.GetDirectoryName(_source)),
            ["loaded_at"] = _loadedAt == default ? null : _loadedAt.ToString("s"),
            ["assembly_version"] = _run?.Method.DeclaringType?.Assembly.GetName().Version?.ToString(),
        };

        private static string NewestBuild()
        {
            if (Directory.Exists(BuildsDir))
            {
                var newest = Directory.GetDirectories(BuildsDir).OrderByDescending(d => Path.GetFileName(d), StringComparer.Ordinal)
                    .Select(d => Path.Combine(d, AssemblyFile)).FirstOrDefault(File.Exists);
                if (newest != null) return newest;
            }
            var beside = Path.Combine(Path.GetDirectoryName(typeof(HandlerHost).Assembly.Location) ?? "", AssemblyFile);
            return File.Exists(beside) ? beside : null;
        }
    }
}
