// Client for the SultanRevitMCP bridge. Several Revits can run at once, each on its own port (48884 up); each writes
// %LOCALAPPDATA%\SultanRevitMCP\instances\<pid>.json with its port and open models.
// Which Revit a call goes to, first match wins:
//   1. REVIT_MCP_PORT in the environment (pin a session to one Revit);
//   2. the Revit that has the model named by params.document, or by useDocument() / REVIT_DOC for the whole script;
//   3. port 48884 (the first Revit started, and the only one before SultanRevitMCP).
// With a model named, the command also works on that model without making it active, so sessions never switch each
// other's active model. Commands that need the UI (active view, selection, open_view) still act on the active model.
import net from "node:net";
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.env.LOCALAPPDATA ?? "", "SultanRevitMCP", "instances");
let defaultDocument = process.env.REVIT_DOC || null;

/** Every following call works on this model (title or full path), in whichever Revit has it open. */
export function useDocument(title) { defaultDocument = title; }

/** Live Revits from the registry: [{pid, port, documents:[{title, path}]}]. Removes files of Revits that are gone. */
export function instances() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")); } catch { return []; }
  const out = [];
  for (const f of files) {
    try {
      const it = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
      try { process.kill(it.pid, 0); out.push(it); } catch { fs.rmSync(path.join(DIR, f), { force: true }); }
    } catch { /* half-written file; skip */ }
  }
  return out;
}

function portFor(document) {
  if (process.env.REVIT_MCP_PORT) return Number(process.env.REVIT_MCP_PORT);
  if (document) {
    const d = document.toLowerCase();
    const hit = instances().find((i) => i.documents?.some((x) => x.title?.toLowerCase() === d || x.path?.toLowerCase() === d));
    if (hit) return hit.port;
  }
  return 48884;
}

// "Revit did not pick up the command ... it was not run": Revit was busy (often another session's long command on the same
// Revit). The command never ran, so it is safe to send again. Retry for up to REVIT_MCP_WAIT_S seconds (default 600) so a
// long script is not left half-built when sessions share one Revit.
const NOT_RUN = /did not pick up the command/i;
export async function call(command, params = {}) {
  // A model already open in another Revit opens read-only, silently: work done there cannot be saved (Makkah, 5 Nov 2026).
  if (command === "open_document" && params.path) {
    const want = path.resolve(params.path).toLowerCase(), port = portFor(params.document ?? defaultDocument);
    const other = instances().find((i) => i.port !== port && i.documents?.some((d) => d.path && path.resolve(d.path).toLowerCase() === want));
    if (other && !params.read_only_ok) throw new Error(`${params.path} is already open in Revit pid ${other.pid} (port ${other.port}). Work there (REVIT_MCP_PORT=${other.port}); opening it here gives a read-only copy.`);
  }
  const until = Date.now() + 1000 * Number(process.env.REVIT_MCP_WAIT_S ?? 600);
  for (;;) {
    try { return await call1(command, params); } catch (e) {
      if (!NOT_RUN.test(e.message) || Date.now() > until) throw e;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

function call1(command, params = {}) {
  const document = params.document ?? defaultDocument ?? undefined;
  const body = document && params.document === undefined ? { ...params, document } : params;
  const port = portFor(document);
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const chunks = [];
    socket.setTimeout(280000, () => { socket.destroy(); reject(new Error("timeout: " + command)); });
    socket.on("connect", () => socket.write(JSON.stringify({ command, params: body }) + "\n"));
    socket.on("data", (c) => chunks.push(c));
    socket.on("error", reject);
    socket.on("end", () => {
      socket.destroy();
      try {
        const r = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (r.ok) resolve(r.result); else reject(new Error(r.error));
      } catch { reject(new Error("bad response: " + command)); }
    });
  });
}
