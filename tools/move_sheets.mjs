// Move sheets from one model to another (general, every project). Revit cannot copy a sheet across models, so each
// sheet is rebuilt in the target with the same views, settings, annotation, title block values and revision history,
// then a "moved" revision is added. Both models must be open in the same Revit (REVIT_MCP_PORT). The old sheets are
// NOT deleted here: render-check the new ones first, then delete (views-and-sheets.md, "Where sheets live").
//
// Usage: node tools/move_sheets.mjs <config.json>
// config: { "source": "<model title>", "target": "<model title>", "sheets": ["MD1-SF-ZZ-GF-DR-E-1001", ...],
//           "moved_revision": { "date": "11 Nov 2026", "description": "...", "issued_by": "...", "issued_to": "..." },
//           "view_prefix": "E" (optional, prefix for new view names), "dry": false }
// Writes <config>.result.json with the new ids per sheet.
import { call, useDocument } from "./rvt.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const cfgPath = process.argv[2];
if (!cfgPath) { console.log("Usage: node tools/move_sheets.mjs <config.json>"); process.exit(1); }
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const S = cfg.source, T = cfg.target;
const onS = (cmd, p = {}) => call(cmd, { ...p, document: S });
const onT = (cmd, p = {}) => call(cmd, { ...p, document: T });
useDocument(T);
const log = (...a) => console.log(...a);
const P = (el, n) => el.parameters?.filter((x) => x.name === n).map((x) => x.value) ?? [];
const SHEET_SKIP = new Set(["Title Blocks", "Viewports", "Schedule Graphics", "Revision Clouds", "Guide Grid"]);

// ---- source lookups
const sViews = (await onS("list_views")).views.filter((v) => v.view_type !== "DrawingSheet");
const sVps = (await onS("query_elements", { category: "OST_Viewports", limit: 1000 })).elements;
const sSheets = (await onS("query_elements", { category: "OST_Sheets", limit: 1000 })).elements;
const vpRows = [];
for (const v of sVps) {
  const e = await onS("get_element", { element_id: v.id });
  vpRows.push({ id: v.id, sheet: P(e, "Sheet Number")[0], viewName: P(e, "View Name").find((n) => sViews.some((x) => x.name === n)), title: P(e, "Title on Sheet")[0], type: e.type_name });
}
const sRevs = (await onS("list_revisions")).revisions;

// ---- target lookups (and the sheet parameters every Samaya model carries)
if (!cfg.dry) await onT("ensure_project_parameters", { category: "OST_Sheets", parameters: [{ name: "Sheet Group" }, { name: "Sheet Package" }] }).catch((e) => log("params:", e.message));
const tLevels = (await onT("list_levels")).levels;
const sLevels = (await onS("list_levels")).levels;
const tTB = (await onT("list_element_types", { category: "OST_TitleBlocks" })).types;
const tViewsNow = async () => (await onT("list_views")).views;

// ---- revisions: match by description and date, create the missing ones in source order, then the moved one
const tRevs = (await onT("list_revisions")).revisions;
const revMap = {}; // source revision number -> target revision id
// a new revision joins the numbering sequence the target's existing revisions use (else Revit numbers it 1, 2, ...)
const firstRev = tRevs[0]?.id;
async function joinSequence(id) {
  if (!firstRev) return null;
  const go = () => onT("set_revision_sequence", { revision_id: id, like_revision_id: firstRev });
  try { return (await go()).number; }
  catch {
    // fails while numbering is Per Sheet: switch to Per Project for the change (revit-bridge.md)
    await onT("set_revision_numbering_mode", { mode: "per_project" }).catch(() => {});
    return (await go().catch((e) => { log("  revision sequence:", e.message.slice(0, 80)); return {}; })).number ?? null;
  }
}
async function ensureRevs(numbers) {
  for (const r of sRevs.filter((x) => numbers.includes(x.number))) {
    if (revMap[r.number]) continue;
    const hit = tRevs.find((x) => x.description === r.description && x.date === r.date) ?? tRevs.find((x) => x.description === r.description);
    if (hit) { revMap[r.number] = hit.id; continue; }
    if (cfg.dry) { revMap[r.number] = -1; continue; }
    const made = await onT("create_revision", { date: r.date, description: r.description, issued_by: cfg.moved_revision?.issued_by ?? "", issued_to: cfg.moved_revision?.issued_to ?? "" });
    const number = await joinSequence(made.id) ?? made.number;
    revMap[r.number] = made.id; tRevs.push({ id: made.id, number, date: r.date, description: r.description });
    log(`  revision ${r.number} -> created ${number}`);
  }
}
// every source revision any of these sheets carries, made first in sequence order
const allOn = new Set();
const sheetRevs = {};
const sheetIdByNo = {};
for (const s of sSheets) { const e = await onS("get_element", { element_id: s.id }); sheetIdByNo[P(e, "Sheet Number")[0]] = s.id; }
for (const no of cfg.sheets) {
  const id = sheetIdByNo[no]; if (!id) throw new Error(`Sheet ${no} is not in ${S}.`);
  sheetRevs[no] = (await onS("list_revisions", { sheet_id: id })).on_sheet ?? [];
  sheetRevs[no].forEach((n) => allOn.add(n));
}
// make every dated source revision (not only those on these sheets), so numbers stay the same in both models
await ensureRevs(sRevs.filter((r) => allOn.has(r.number) || !/^Date \d/.test(r.date ?? "")).map((r) => r.number));
let movedRev = null;
if (cfg.moved_revision && !cfg.dry) {
  movedRev = tRevs.find((x) => x.description === cfg.moved_revision.description)?.id;
  if (!movedRev) { movedRev = (await onT("create_revision", cfg.moved_revision)).id; log(`  moved revision -> ${await joinSequence(movedRev)}`); }
}

// ---- one sheet
const result = {};
for (const no of cfg.sheets) {
  const sid = sheetIdByNo[no];
  const di = await onS("drawing_info", { sheet_id: sid });
  const se = await onS("get_element", { element_id: sid });
  const tbInst = (await onS("query_elements", { category: "OST_TitleBlocks", view_id: sid })).elements[0];
  const tbe = tbInst ? await onS("get_element", { element_id: tbInst.id }) : null;
  const strParams = (e) => (e?.parameters ?? []).filter((x) => !x.read_only && x.storage === "String" && x.value != null && !/^Sheet (Number|Name)$/.test(x.name));
  log(`\n${no} ${di.name}: ${di.viewports.length} views, revisions ${sheetRevs[no].join(",")}`);
  if (cfg.dry) { for (const v of di.viewports) log(`  ${v.view_type} ${v.view} 1:${v.scale}`); continue; }

  const placed = [];
  for (const vp of di.viewports) {
    const sv = sViews.find((x) => x.name === vp.view);
    const row = vpRows.find((x) => x.sheet === no && x.viewName === vp.view);
    let tv;
    const short = no.split("-DR-")[1] ?? no;
    const newName = `${short} ${row?.title ?? vp.view}`;
    if (vp.view_type === "DraftingView") {
      // a fresh drafting view at the source scale, then its drawing (copying the view element itself brings stray parts)
      const existing = (await tViewsNow()).find((x) => x.name === newName);
      tv = existing?.id ?? (await onT("create_drafting_view", { name: newName })).id;
      await onT("set_parameter", { element_id: tv, parameter_name: "View Scale", value: String(vp.scale) }).catch(() => {});
      await onT("match_view_settings", { source_document: S, target_document: T, source_view_id: sv.id, target_view_id: tv }).catch(() => {});
      const c = await onT("copy_view_contents", { source_document: S, target_document: T, source_view_id: sv.id, target_view_id: tv });
      log(`  ${newName}: drafting view, copied ${c.copied_total}/${c.found}${c.failed.length ? `, failed ${c.failed.length}` : ""}`);
    } else if (vp.view_type === "FloorPlan" || vp.view_type === "CeilingPlan") {
      const sl = sLevels.find((l) => l.name === sv.level) ?? sLevels[0];
      const tl = tLevels.reduce((a, b) => (Math.abs(b.elevation_mm - sl.elevation_mm) < Math.abs(a.elevation_mm - sl.elevation_mm) ? b : a));
      const existing = (await tViewsNow()).find((x) => x.name === newName);
      tv = existing?.id ?? (await onT("create_floor_plan", { level_id: tl.id, name: newName, ceiling: vp.view_type === "CeilingPlan" })).id;
      const m = await onT("match_view_settings", { source_document: S, target_document: T, source_view_id: sv.id, target_view_id: tv });
      if (m.notes?.length) log("  settings notes:", JSON.stringify(m.notes));
      const c = await onT("copy_view_contents", { source_document: S, target_document: T, source_view_id: sv.id, target_view_id: tv });
      log(`  ${newName}: copied ${c.copied_total}/${c.found}${c.failed.length ? `, failed ${c.failed.length}: ${[...new Set(c.failed.map((f) => f.category))].join(",")}` : ""}`);
      if (c.failed.length) writeFileSync(`${cfgPath}.${short}.${tv}.failed.json`, JSON.stringify(c.failed, null, 1));
    } else if (["Section", "Detail", "ThreeD"].includes(vp.view_type)) {
      const existing = (await tViewsNow()).find((x) => x.name === newName);
      tv = existing?.id ?? (await onT("create_view_like", { source_document: S, target_document: T, source_view_id: sv.id, name: newName })).id;
      const m = await onT("match_view_settings", { source_document: S, target_document: T, source_view_id: sv.id, target_view_id: tv });
      if (m.notes?.length) log("  settings notes:", JSON.stringify(m.notes));
      const c = await onT("copy_view_contents", { source_document: S, target_document: T, source_view_id: sv.id, target_view_id: tv });
      log(`  ${newName}: ${vp.view_type}, copied ${c.copied_total}/${c.found}${c.failed.length ? `, failed ${c.failed.length}: ${[...new Set(c.failed.map((f) => f.category))].join(",")}` : ""}`);
      if (c.failed.length) writeFileSync(`${cfgPath}.${short}.${tv}.failed.json`, JSON.stringify(c.failed, null, 1));
    } else {
      log(`  SKIP ${vp.view_type} ${vp.view}: not handled; rebuild by hand`);
      continue;
    }
    if (row?.title) await onT("set_parameter", { element_id: tv, parameter_name: "Title on Sheet", value: row.title }).catch(() => {});
    placed.push({ tv, vp, row });
  }

  const tb = tTB.find((x) => x.name === di.title_block.type)?.id;
  const sh = (await onT("create_sheet", { number: no, name: di.name, title_block_type_id: tb })).id;
  for (const x of strParams(se)) await onT("set_parameter", { element_id: sh, parameter_name: x.name, value: x.value }).catch((e) => log("  sheet param", x.name, e.message.slice(0, 60)));
  const ttb = (await onT("query_elements", { category: "OST_TitleBlocks", view_id: sh })).elements[0];
  if (ttb) for (const x of strParams(tbe)) await onT("set_parameter", { element_id: ttb.id, parameter_name: x.name, value: x.value }).catch(() => {});
  for (const { tv, vp, row } of placed) {
    const r = await onT("place_view_on_sheet", { sheet_id: sh, view_id: tv, location: { x: vp.centre_mm[0], y: vp.centre_mm[1], z: 0 } });
    if (/no title/i.test(row?.type ?? "")) await onT("set_viewport_no_title", { viewport_id: r.id ?? r.viewport_id }).catch(() => {});
  }
  // sheet-level annotation (notes, tables drawn as text and lines)
  const dry = await onT("copy_view_contents", { source_document: S, target_document: T, source_view_id: sid, target_view_id: sh, dry_run: true });
  const cats = Object.keys(dry.by_category ?? {}).filter((k) => !SHEET_SKIP.has(k));
  if (cats.length) {
    const c = await onT("copy_view_contents", { source_document: S, target_document: T, source_view_id: sid, target_view_id: sh, categories: cats });
    log(`  sheet notes: copied ${c.copied_total}/${c.found}${c.failed.length ? `, failed ${c.failed.length}` : ""}`);
  }
  const revIds = sheetRevs[no].map((n) => revMap[n]).filter(Boolean);
  if (movedRev) revIds.push(movedRev);
  if (revIds.length) await onT("set_sheet_revisions", { sheet_ids: [sh], revision_ids: revIds });
  result[no] = { sheet_id: sh, views: placed.map((x) => ({ name: x.vp.view, id: x.tv })) };
  log(`  sheet ${sh} made`);
}
writeFileSync(`${cfgPath}.result.json`, JSON.stringify(result, null, 1));
if (!cfg.dry) log(JSON.stringify(await onT("save_document", {})).slice(0, 120));
