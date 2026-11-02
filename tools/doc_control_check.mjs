// Live check of the document commands over the bridge socket. Prints each raw JSON response.
// Usage: node doc_control_check.mjs <second .rvt path>
import { createConnection } from "node:net";
import { statSync } from "node:fs";

const send = (command, params = {}) => new Promise((resolve, reject) => {
  const s = createConnection(48884, "127.0.0.1");
  let buf = "";
  s.setTimeout(600000, () => { s.destroy(); reject(new Error("timeout " + command)); });
  s.on("connect", () => s.write(JSON.stringify({ id: 1, command, params }) + "\n"));
  s.on("data", (d) => { buf += d; const i = buf.indexOf("\n"); if (i >= 0) { s.end(); console.log(command, buf.slice(0, i)); resolve(JSON.parse(buf.slice(0, i))); } });
  s.on("error", reject);
});

const second = process.argv[2];
await send("ping");
const list = await send("list_documents");
const docs = (list.result ?? list).documents;
const first = docs.find((d) => d.is_active);
if (!first) throw new Error("No active document");
const before = statSync(first.path).mtime;
await send("open_document", { path: second });
await send("activate_document", { title: first.title });
const saved = await send("save_document");
const info = await send("get_project_info");
const after = statSync(first.path).mtime;
const title = (info.result ?? info).title;
console.log("active is first:", title.replace(/\.rvt$/i, "") === first.title.replace(/\.rvt$/i, ""));
console.log("LastWriteTime before", before.toISOString(), "after", after.toISOString(), "changed", +after !== +before, "reported saved", (saved.result ?? saved).saved);
