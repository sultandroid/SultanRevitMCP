// Grid balance for finished sheets (TV-01, 13 Nov 2026: "balance the sheets layout to be in grids without any overflow").
// Reads each sheet's viewports and sheet texts, keeps each view with the labels that belong to it (texts touching or
// within `attach` mm of its box), then:
//   1. groups views into rows (vertical overlap), lays each row out across the drawing zone with even gutters and
//      snaps each centre to the 6-column grid (column centres and lines) when the gutters allow;
//   2. stands every view of a row on one bottom line (titles read across);
//   3. moves the notes column to start on a column line (default 847);
//   4. reports overflow: any box (view or estimated text) outside the drawing area, or two boxes overlapping.
// Sheets drawn straight on the sheet (images, tables, schematics) keep their layout: only the notes column moves.
// Usage: node grid_balance.mjs <doc title> <sheet number> [...] [--dry] [--notes 847] [--zone 20,832] [--attach 40]
import { call as raw } from "./rvt.mjs";
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DOC = args[0], DRY = args.includes("--dry");
const SHEETS = args.slice(1).filter((a, i, s) => !a.startsWith("--") && !(i > 0 && s[i - 1].startsWith("--")));
const NOTES_X = +opt("--notes", 847), [Z0, Z1] = opt("--zone", "20,832").split(",").map(Number), ATT = +opt("--attach", 40);
const AREA = { x0: 20, x1: 1012, y0: 20, y1: 822 }, COL = (AREA.x1 - AREA.x0) / 6;
const GRID = Array.from({ length: 13 }, (_, i) => AREA.x0 + (i * COL) / 2);            // column lines and centres
const call = (n, a = {}) => raw(n, { document: DOC, ...a });
const size = (type) => +(/(\d+(?:\.\d+)?)/.exec(type ?? "")?.[1] ?? 5);
const textBox = (t) => { const ls = (t.text ?? "").split(/\r|\n/).filter((l, i, a) => l || i < a.length - 1); const s = size(t.type);
  const w = Math.max(...ls.map((l) => l.length)) * s * 0.62, h = ls.length * s * 1.55; return { x0: t.x_mm, x1: t.x_mm + w, y0: t.y_mm - h, y1: t.y_mm }; };
const union = (a, b) => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) });
const gap = (a, b) => Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1), Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 3 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 3;
const report = [];
for (const no of SHEETS) {
  const s = (await call("query_elements", { category: "OST_Sheets", parameter_name: "Sheet Number", parameter_value: no, limit: 1 })).elements[0];
  if (!s) { console.log(no, "no sheet"); continue; }
  const di = await call("drawing_info", { sheet_id: s.id });
  const vpEls = (await call("query_elements", { category: "OST_Viewports", view_id: s.id, limit: 60 })).elements;
  const vpIds = {};
  for (const e of vpEls) { const g = await call("get_element", { element_id: e.id }); const vn = g.parameters.find((p) => p.name === "View")?.value; if (vn) vpIds[vn] = e.id; } // "View" = the view shown (View Name can be the title)
  const vps = di.viewports.filter((v) => v.right_mm <= AREA.x1 + 1 && vpIds[v.view]).map((v) => ({ id: vpIds[v.view], name: v.view, box: { x0: v.left_mm, x1: v.right_mm, y0: v.bottom_mm - 14, y1: v.top_mm }, vb: v.bottom_mm }));
  const texts = (await call("list_view_annotations", { view_id: s.id })).items.filter((i) => i.kind === "text");
  const imgs = (await call("query_elements", { category: "OST_RasterImages", view_id: s.id, limit: 9 }).catch(() => ({ elements: [] }))).elements.length - 1; // minus the designer logo in the title block
  // notes column: texts that start right of the drawing zone
  const notes = texts.filter((t) => t.x_mm >= Z1 - 40 && t.x_mm < AREA.x1);
  const free = texts.filter((t) => !notes.includes(t));
  const groups = vps.filter((v) => v.box.x0 < Z1 - 20).map((v) => ({ ids: [v.id], box: { ...v.box }, own: { ...v.box }, vb: v.vb, name: v.name })); // views in the notes column (a 3D under the notes) stay
  if (!imgs && groups.length) {
    for (const t of free.filter((q) => !/Heading/i.test(q.type ?? ""))) { const tb = textBox(t); let best = null, bd = ATT;
      for (const g of groups) { const o = g.own, right = t.x_mm >= o.x1 - 5 && t.x_mm <= o.x1 + ATT && t.y_mm <= o.y1 + 20 && t.y_mm >= o.y0 - 20, under = t.x_mm >= o.x0 - 10 && t.x_mm <= o.x1 && t.y_mm <= o.y0 && t.y_mm >= o.y0 - 60;
        const d = gap(o, tb); if ((right || under) && d <= bd + 60) { bd = d; best = g; } } // labels right of a view, text blocks just under it
      if (best) { best.ids.push(t.id); best.box = union(best.box, tb); } }
  }
  const parked = vps.filter((v) => v.box.x0 >= Z1 - 20).map((v) => v.box);
  const moves = new Map();
  if (!imgs && groups.length > 1) {
    // rows by vertical overlap of the view boxes
    const rows = [];
    for (const g of [...groups].sort((a, b) => b.box.y1 - a.box.y1)) {
      const r = rows.find((rw) => rw.some((h) => Math.min(h.own.y1, g.own.y1) - Math.max(h.own.y0, g.own.y0) > 0.5 * Math.min(h.own.y1 - h.own.y0, g.own.y1 - g.own.y0)));
      r ? r.push(g) : rows.push([g]);
    }
    let floor = Infinity;                                                         // lowest point of the rows placed so far
    for (const row of rows) {
      row.sort((a, b) => a.box.x0 - b.box.x0);
      const push = Math.min(0, floor - 8 - Math.max(...row.map((g) => g.own.y1 + (Math.min(...row.map((h) => h.vb)) - g.vb))));
      const ry0 = Math.min(...row.map((g) => g.own.y0)), ry1 = Math.max(...row.map((g) => g.own.y1));
      const zr = Math.min(Z1, ...parked.filter((o) => o.y1 > ry0 - 20 && o.y0 < ry1 + 20).map((o) => o.x0 - 10));
      const W = row.reduce((a, g) => a + (g.box.x1 - g.box.x0), 0), freeW = zr - Z0 - W;
      if (freeW < 0) { report.push(`${no}: row kept as drawn (${Math.round(W)} mm wide with labels): ${row.map((g) => g.name).join(", ")}`); continue; }
      const gut = freeW / (row.length + 1), base = Math.min(...row.map((g) => g.vb)) + push;
      let x = Z0 + gut;
      for (const g of row) {
        const w = g.box.x1 - g.box.x0; let c = x + w / 2;
        const snap = GRID.reduce((a, p) => (Math.abs(p - c) < Math.abs(a - c) ? p : a), GRID[0]);
        if (Math.abs(snap - c) < gut / 2 - 4 && snap - w / 2 >= Z0 && snap + w / 2 <= zr) c = snap;   // on the grid if the gutters allow
        const dx = c - w / 2 - g.box.x0, dy = base - g.vb;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moves.set(g, [dx, dy]);
        g.box = { x0: g.box.x0 + dx, x1: g.box.x1 + dx, y0: g.box.y0 + dy, y1: g.box.y1 + dy }; g.own = { x0: g.own.x0 + dx, x1: g.own.x1 + dx, y0: g.own.y0 + dy, y1: g.own.y1 + dy };
        x = c + w / 2 + gut;
      }
      floor = Math.min(floor, ...row.map((g) => g.box.y0));
    }
  }
  // notes column to the column line (only if it fits the drawing area)
  const nW = notes.length ? Math.max(...notes.map((t) => textBox(t).x1 - t.x_mm)) : 0, nx = Math.min(NOTES_X, AREA.x1 - nW);
  const room = notes.length ? Math.min(...notes.map((t) => AREA.x1 - textBox(t).x1)) : 0;
  const noteDx = notes.length ? Math.max(Math.min(nx - Math.min(...notes.map((t) => t.x_mm)), room), Math.min(0, room)) : 0;
  if (!DRY) {
    for (const [g, [dx, dy]] of moves) await call("move_elements", { element_ids: g.ids, dx_mm: dx, dy_mm: dy }).catch((e) => console.log("move", g.name, e.message.slice(0, 60)));
    if (Math.abs(noteDx) > 0.5) await call("move_elements", { element_ids: notes.map((t) => t.id), dx_mm: noteDx, dy_mm: 0 }).catch((e) => console.log("notes", e.message.slice(0, 60)));
  }
  // overflow and overlap check on the result
  const boxes = [...groups.map((g) => ({ n: g.name, b: g.box })), ...notes.map((t) => { const b = textBox(t); return { n: "notes", b: { ...b, x0: b.x0 + noteDx, x1: b.x1 + noteDx } }; })];
  for (const { n, b } of boxes) if (b.x0 < AREA.x0 - 1 || b.x1 > AREA.x1 + 1 || b.y0 < AREA.y0 - 1 || b.y1 > AREA.y1 + 1) report.push(`${no}: ${n} outside the drawing area (${Math.round(b.x0)}..${Math.round(b.x1)}, ${Math.round(b.y0)}..${Math.round(b.y1)})`);
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) if (overlap(groups[i].own, groups[j].own)) report.push(`${no}: ${groups[i].name} overlaps ${groups[j].name}`);
  console.log(no, "imgs", imgs, imgs ? "drawn sheet: notes only" : `views ${groups.length}, moved ${moves.size}`, "notes dx", Math.round(noteDx));
}
if (!DRY) await call("save_document", { title: DOC });
console.log(report.length ? "CHECK:\n" + report.join("\n") : "OK: on the grid, nothing outside the drawing area, no overlaps");
