// read-only Odoo helper; key read from the access file, never printed
import fs from "node:fs";
const txt = fs.readFileSync("C:/Users/user/.claude/uploads/c44b4e0e-28a2-44a2-9f89-e5d849147aab/3d2e2e51-samaya-odoo-access.txt", "utf8");
const api = txt.slice(txt.indexOf("API / INTEGRATION"));
const get = (re) => (api.match(re) || [])[1]?.trim();
const URL = get(/URL:\s*(\S+)/), DB = get(/Database:\s*(\S+)/), LOGIN = get(/Login:\s*(\S+)/), KEY = get(/API key:\s*(\S+)/i);
const rpc = async (service, method, args) => { const j = await (await fetch(`${URL}/jsonrpc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: Date.now() }) })).json(); if (j.error) throw new Error(j.error.data?.message || j.error.message); return j.result; };
const uid = await rpc("common", "login", [DB, LOGIN, KEY]);
export const kw = (model, method, args, k = {}) => rpc("object", "execute_kw", [DB, uid, KEY, model, method, args, k]);
