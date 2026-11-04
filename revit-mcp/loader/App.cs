using System;
using System.IO;
using Autodesk.Revit.UI;

namespace SultanRevitMCP
{
    /// <summary>Revit entry point: starts the local bridge when Revit starts.</summary>
    public class App : IExternalApplication
    {
        private const int DefaultPort = 48884;

        private BridgeServer _server;
        private ExternalEvent _event;

        public Result OnStartup(UIControlledApplication application)
        {
            // A bridge failure (e.g. port taken by a second Revit) must never stop Revit from starting.
            try
            {
                var port = int.TryParse(Environment.GetEnvironmentVariable("REVIT_MCP_PORT"), out var p) ? p : DefaultPort;
                var dispatcher = new CommandDispatcher();
                _event = ExternalEvent.Create(dispatcher);
                dispatcher.Attach(_event);
                _server = new BridgeServer(port, dispatcher);
                _server.Start();
                Log.Write($"Bridge listening on 127.0.0.1:{port}");
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
            return Result.Succeeded;
        }
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
