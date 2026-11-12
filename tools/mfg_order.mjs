// Writes the manufacturing order number in the MFG ORDER NO. cell of every sheet (title_block_spec.mjs moAt), Samaya Factory
// and client-factory title blocks alike (user, 12 Nov 2026). Old MO notes on the sheet are replaced.
// Usage: node tools/mfg_order.mjs --doc <title> --mo <number> [--sheets <prefix of sheet numbers>]
import { call } from "./rvt.mjs";
import { moAt } from "./title_block_spec.mjs";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const DOC = arg("doc"), MO = arg("mo"), PFX = arg("sheets", "");
if (!DOC || !MO) throw new Error("usage: --doc <title> --mo <number> [--sheets <prefix>]");
await call("activate_document", { title: DOC });
const tt = (await call("ensure_text_type", { name: "TB MFG Order 4", size_mm: 4, color: { r: 0, g: 0, b: 0 }, bold: true })).id;
const sheets = (await call("query_elements", { category: "OST_Sheets", limit: 500 })).elements;
let n = 0;
for (const s of sheets) {
  const g = await call("get_element", { element_id: s.id }), num = g.parameters.find((p) => p.name === "Sheet Number")?.value ?? "";
  if (!num.startsWith(PFX)) continue;
  const tb = (await call("query_elements", { category: "OST_TitleBlocks", view_id: s.id, limit: 2 })).elements[0];
  const size = /\b(A[0-3])\b/.exec(tb?.name ?? tb?.type ?? "")?.[1] ?? /\b(A[0-3])\b/.exec(JSON.stringify(tb ?? {}))?.[1];
  const at = size && moAt(size); if (!at) { console.log("skip", num, "size?", tb?.name); continue; }
  const old = (await call("list_view_annotations", { view_id: s.id }).catch(() => ({ items: [] }))).items?.filter((a) => /^MO\s/.test(a.text ?? "")).map((a) => a.id) ?? [];
  if (old.length) await call("delete_elements", { element_ids: old });
  await call("create_text_note", { view_id: s.id, location: at, text: `MO ${MO}`, text_type_id: tt }); n++;
}
await call("save_document", { title: DOC });
console.log("MO", MO, "on", n, "sheets");
