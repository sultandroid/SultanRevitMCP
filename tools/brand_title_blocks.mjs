// Title blocks A0..A3 to the Samaya Factory standard, carrying another factory's brand (logo, owner, footer line).
// Usage (Revit open, bridge running): node tools/brand_title_blocks.mjs <brand.json> [keep]
// brand.json (paths relative to the json file):
//   { "prefix": "Endura Furniture Factory", "owner": "Endura Furniture Factory", "footer": "Endura Furniture Factory - Riyadh",
//     "logo": "endura-logo-black.png", "logo_width_mm": 130, "out_dir": "Title Blocks" }
// The logo must be opaque, black on white, about 2.75 : 1 (the Samaya logo slot), see title-blocks.md.
// Builds in a project, checks each size on a test sheet with its revision schedule,
// writes out_dir/<prefix> A0..A3.rfa, check-A0..A3.png and <prefix> Title Blocks.rvt (all four loaded, with revision schedules),
// then closes that project ("keep" leaves it open).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, unlinkSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { call } from "./rvt.mjs";
import { SIZES, spec } from "./title_block_spec.mjs";

const cfgPath = resolve(process.argv[2] ?? ""), cfg = JSON.parse(readFileSync(cfgPath, "utf8")), here = dirname(cfgPath);
const fwd = (p) => resolve(here, p).replace(/\\/g, "/");
const OUT = fwd(cfg.out_dir ?? "Title Blocks") + "/";
const SOURCE = cfg.source_rfa ?? "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Assetes/Revit Familes/Title Block/A1 metric_Samaya.rfa"; // carries the labels the builder moves
const BASE_TEMPLATE = cfg.base_template ?? "C:/ProgramData/Autodesk/RVT 2026/Templates/English/DefaultMetric.rte";
mkdirSync(OUT, { recursive: true });
const logo = OUT + basename(cfg.logo);
if (fwd(cfg.logo) !== logo) copyFileSync(fwd(cfg.logo), logo);
const brand = { owner: cfg.owner, footer: cfg.footer, logo, logo_width_mm: cfg.logo_width_mm };

const TITLE = `${cfg.prefix} Title Blocks`, BUILD = `${OUT}${TITLE}.rvt`; // the revision schedule lives only in this project (the bridge does not write it into the .rfa)
try { unlinkSync(BUILD); } catch {}
const before = (await call("list_documents")).documents?.map((d) => d.title) ?? [];
console.log("open before:", before.join(", "));
await call("create_project", { path: BUILD, template_path: BASE_TEMPLATE });
const g = async () => { await call("activate_document", { title: TITLE }); const t = (await call("get_project_info")).title; if (t !== TITLE) throw new Error("active is " + t); };

for (const [sz, SW, SH, SWID] of SIZES) {
  await g();
  const name = `${cfg.prefix} ${sz}`;
  const { revSchedule, ...build } = spec({ name, SW, SH, SWID, source_rfa: SOURCE, save_path: `${OUT}${name}.rfa`, brand });
  const r = await call("build_title_block", build); console.log(name, JSON.stringify(r).slice(0, 120));
  // Right after a load Revit can refuse the new type id once (seen on A2); wait and retry.
  const mk = () => call("create_sheet", { number: `TEST-${sz}`, name: `Test ${sz}`, title_block_type_id: r.types[0] });
  const sheet = (await mk().catch(async () => { await new Promise((ok) => setTimeout(ok, 2000)); await g(); return mk(); })).id;
  const tb = (await call("query_elements", { category: "OST_TitleBlocks", view_id: sheet, limit: 5 })).elements[0].id;
  await call("add_titleblock_revision_schedule", { element_id: tb, ...revSchedule }).catch((e) => console.log("rev schedule", e.message.slice(0, 80)));
  const im = await call("export_view_image", { view_id: sheet, pixel_size: 2400 });
  writeFileSync(`${OUT}check-${sz}.png`, Buffer.from(im.data_base64, "base64"));
}

await g(); await call("save_document", { title: TITLE });
if (process.argv[3] !== "keep") console.log("close", JSON.stringify(await call("close_document", { title: TITLE, save: false }).catch((e) => ({ err: e.message }))));
