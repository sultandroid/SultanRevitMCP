using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

namespace RevitMcp
{
    /// <summary>
    /// Loopback-only TCP server. Each connection carries one JSON line in and one JSON line out:
    ///   {"command":"...","params":{...}}  ->  {"ok":true,"result":...} or {"ok":false,"error":"..."}
    /// Raw JSON rather than HTTP means a web page cannot drive Revit: a browser's request starts with an
    /// HTTP request line, which fails to parse and closes the connection.
    /// </summary>
    internal sealed class BridgeServer
    {
        private const int MaxRequestBytes = 4 * 1024 * 1024;
        private static readonly TimeSpan ReadTimeout = TimeSpan.FromSeconds(10);

        private readonly TcpListener _listener;
        private readonly CommandDispatcher _dispatcher;
        private readonly CancellationTokenSource _stop = new CancellationTokenSource();

        public BridgeServer(int port, CommandDispatcher dispatcher)
        {
            _listener = new TcpListener(IPAddress.Loopback, port);
            _dispatcher = dispatcher;
        }

        public void Start()
        {
            _listener.Start();
            _ = Task.Run(AcceptLoopAsync);
        }

        public void Stop()
        {
            _stop.Cancel();
            _listener.Stop();
        }

        private async Task AcceptLoopAsync()
        {
            while (!_stop.IsCancellationRequested)
            {
                try
                {
                    var client = await _listener.AcceptTcpClientAsync(_stop.Token);
                    _ = Task.Run(() => HandleAsync(client));
                }
                catch (OperationCanceledException)
                {
                    return;
                }
                catch (ObjectDisposedException)
                {
                    return;
                }
                catch (Exception ex)
                {
                    Log.Write($"Accept failed: {ex.Message}");
                }
            }
        }

        private async Task HandleAsync(TcpClient client)
        {
            using (client)
            {
                try
                {
                    var stream = client.GetStream();
                    var line = await ReadLineAsync(stream);
                    var response = await ProcessAsync(line);
                    var bytes = Encoding.UTF8.GetBytes(response.ToJsonString() + "\n");
                    await stream.WriteAsync(bytes, _stop.Token);
                }
                catch (Exception ex)
                {
                    Log.Write($"Connection dropped: {ex.Message}");
                }
            }
        }

        private async Task<JsonObject> ProcessAsync(string line)
        {
            try
            {
                var request = JsonNode.Parse(line)?.AsObject() ?? throw new InvalidDataException("Empty request.");
                var command = request["command"]?.GetValue<string>() ?? throw new InvalidDataException("Missing command.");

                // Answered off the Revit thread so callers can tell "add-in loaded" from "Revit is busy".
                if (command == "ping")
                {
                    var version = typeof(BridgeServer).Assembly.GetName().Version?.ToString();
                    return new JsonObject { ["ok"] = true, ["result"] = new JsonObject { ["bridge_version"] = version } };
                }

                if (!Handlers.Has(command)) throw new InvalidDataException($"Unknown command '{command}'.");

                var parameters = request["params"]?.AsObject();
                request.Remove("params");
                var result = await _dispatcher.SubmitAsync(command, parameters);
                return new JsonObject { ["ok"] = true, ["result"] = result };
            }
            catch (JsonException)
            {
                return new JsonObject { ["ok"] = false, ["error"] = "Request was not valid JSON." };
            }
            catch (Exception ex)
            {
                return new JsonObject { ["ok"] = false, ["error"] = ex.Message };
            }
        }

        private async Task<string> ReadLineAsync(NetworkStream stream)
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(_stop.Token);
            timeout.CancelAfter(ReadTimeout);

            using var buffer = new MemoryStream();
            var chunk = new byte[8192];
            while (true)
            {
                var read = await stream.ReadAsync(chunk, timeout.Token);
                if (read == 0) break;

                var newline = Array.IndexOf(chunk, (byte)'\n', 0, read);
                buffer.Write(chunk, 0, newline >= 0 ? newline : read);
                if (newline >= 0) break;
                if (buffer.Length > MaxRequestBytes) throw new InvalidDataException("Request too large.");
            }
            return Encoding.UTF8.GetString(buffer.GetBuffer(), 0, (int)buffer.Length);
        }
    }
}
