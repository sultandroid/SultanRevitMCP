using System;
using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// The Revit API may only be called on Revit's main thread, so socket threads queue commands here
    /// and an ExternalEvent drains the queue when Revit is idle.
    /// </summary>
    internal sealed class CommandDispatcher : IExternalEventHandler
    {
        private const int Queued = 0, Running = 1, Abandoned = 2;

        // How long a command may wait for Revit to become idle. Modal dialogs block ExternalEvents.
        private static readonly TimeSpan QueueTimeout = TimeSpan.FromSeconds(30);
        private static readonly TimeSpan RaiseInterval = TimeSpan.FromMilliseconds(500);

        private sealed class Pending
        {
            public string Command;
            public JsonObject Params;
            public int State = Queued;
            public readonly TaskCompletionSource<JsonNode> Completion =
                new TaskCompletionSource<JsonNode>(TaskCreationOptions.RunContinuationsAsynchronously);
        }

        private readonly ConcurrentQueue<Pending> _queue = new ConcurrentQueue<Pending>();
        private ExternalEvent _event;

        public void Attach(ExternalEvent externalEvent) => _event = externalEvent;

        public string GetName() => "Revit MCP Bridge";

        public async Task<JsonNode> SubmitAsync(string command, JsonObject parameters)
        {
            var item = new Pending { Command = command, Params = parameters ?? new JsonObject() };
            _queue.Enqueue(item);

            var deadline = DateTime.UtcNow + QueueTimeout;
            while (true)
            {
                _event.Raise();
                var finished = await Task.WhenAny(item.Completion.Task, Task.Delay(RaiseInterval));
                if (finished == item.Completion.Task) return await item.Completion.Task;

                // Claiming the state atomically guarantees a timed-out command can never run later.
                if (DateTime.UtcNow > deadline &&
                    Interlocked.CompareExchange(ref item.State, Abandoned, Queued) == Queued)
                {
                    throw new TimeoutException(
                        "Revit did not pick up the command within 30 seconds, and it was not run. " +
                        "Close any open dialog or finish the active command in Revit (press Esc), then retry.");
                }

                // Once it is running it cannot be cancelled, so wait for the real outcome.
                if (Volatile.Read(ref item.State) == Running) return await item.Completion.Task;
            }
        }

        public void Execute(UIApplication app)
        {
            while (_queue.TryDequeue(out var item))
            {
                if (Interlocked.CompareExchange(ref item.State, Running, Queued) != Queued) continue;
                try
                {
                    item.Completion.SetResult(Handlers.Run(app, item.Command, item.Params));
                }
                catch (Exception ex)
                {
                    Log.Write($"{item.Command} failed: {ex}");
                    item.Completion.SetException(ex);
                }
            }
        }
    }
}
