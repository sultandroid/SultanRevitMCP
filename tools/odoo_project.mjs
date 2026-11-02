// Read a project and its client from Samaya's Odoo. Read only.
// Usage: ODOO_LOGIN=<email> ODOO_KEY=<api key> node odoo_project.mjs "<project code or name>"
const U = "https://samayainv.odoo.com/jsonrpc", D = "peerless-tech-samaya-18-0-18447146", L = process.env.ODOO_LOGIN, K = process.env.ODOO_KEY;
const rpc = async (service, method, args) => {
  const r = await (await fetch(U, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args } }) })).json();
  if (r.error) throw new Error(r.error.data?.message || r.error.message);
  return r.result;
};
const uid = await rpc("common", "authenticate", [D, L, K, {}]);
if (!uid) throw new Error("Odoo login failed");
const ex = (model, fn, a, k = {}) => rpc("object", "execute_kw", [D, uid, K, model, fn, a, k]);
const projects = await ex("project.project", "search_read", [[["name", "ilike", process.argv[2]]]], { fields: ["name", "partner_id", "user_id", "stage_id", "date_start", "date"], context: { active_test: false } });
for (const p of projects) {
  console.log(JSON.stringify(p));
  if (p.partner_id) console.log(JSON.stringify(await ex("res.partner", "read", [[p.partner_id[0]]], { fields: ["name", "street", "street2", "city", "country_id", "zip", "phone", "email", "vat"] })));
}
