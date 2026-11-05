// Download every attachment of an Odoo project task into a folder, using the Odoo JSON-RPC API.
// Usage: node odoo_task_files.mjs <accessFile> <taskId> <outDir>   (the API key is read from the access file, never printed)
import fs from "node:fs";
import path from "node:path";
const [accessFile, taskId, outDir] = process.argv.slice(2);
const txt = fs.readFileSync(accessFile, "utf8");
const api = txt.slice(txt.indexOf("API / INTEGRATION"));
const get = (re, s = api) => (s.match(re) || [])[1]?.trim();
const URL = get(/URL:\s*(\S+)/), DB = get(/Database:\s*(\S+)/), LOGIN = get(/Login:\s*(\S+)/), KEY = get(/API key:\s*(\S+)/i);
if (!URL || !DB || !LOGIN || !KEY) throw new Error("access file: missing URL, Database, Login or API key");
const rpc = async (service, method, args) => {
  const r = await fetch(`${URL}/jsonrpc`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: Date.now() }) });
  const j = await r.json(); if (j.error) throw new Error(j.error.data?.message || j.error.message); return j.result; };
const uid = await rpc("common", "login", [DB, LOGIN, KEY]);
if (!uid) throw new Error("login failed");
const kw = (model, method, args, kwargs = {}) => rpc("object", "execute_kw", [DB, uid, KEY, model, method, args, kwargs]);
const atts = await kw("ir.attachment", "search_read", [[["res_model", "=", "project.task"], ["res_id", "=", +taskId]]], { fields: ["id", "name", "file_size", "mimetype"] });
fs.mkdirSync(outDir, { recursive: true });
const done = [];
for (const a of atts) {
  const [rec] = await kw("ir.attachment", "read", [[a.id], ["datas"]]);
  const buf = Buffer.from(rec.datas || "", "base64");
  const safe = a.name.replace(/[<>:"/\\|?*]/g, "_");
  fs.writeFileSync(path.join(outDir, safe), buf);
  done.push({ id: a.id, name: safe, bytes: buf.length, expected: a.file_size, ok: buf.length === a.file_size });
}
console.log(JSON.stringify({ uid, files: done }, null, 1));
