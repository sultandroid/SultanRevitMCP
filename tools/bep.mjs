// Samaya Factory BIM Execution Plan (ISO 19650-2), built from a project config and standards/sultan-standards.json.
// Usage: node tools/bep.mjs projects/<project>/project.json <out.html>   (A4, print to PDF from the browser or Edge headless)
// The BEP is ours; when the client issues an EIR or its own BIM standard, theirs wins and is quoted in section 2.
import { readFileSync, writeFileSync } from "node:fs";
import { S } from "./standards.mjs";

const [cfgPath, out] = process.argv.slice(2);
if (!cfgPath || !out) { console.log("usage: node tools/bep.mjs projects/<project>/project.json out.html"); process.exit(1); }
const P = JSON.parse(readFileSync(cfgPath, "utf8"));
const esc = (s) => String(s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const table = (head, rows) => `<table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
const bimRows = Object.entries(S.bim_standards).filter(([k]) => !k.startsWith("_")).flatMap(([tier, list]) => list.map((s) => [tier.replace(/^\d_/, "").replace(/_/g, " "), s.id, s.how]));
const today = new Date().toISOString().slice(0, 10);

// Level of information need (ISO 7817-1) for shopfit work: what each item carries, by stage.
const loin = [
  ["Existing shell", "Boxes from the site survey: walls, piers, columns, beams, slabs, openings", "Source and ASSUMED flags in Comments", "Survey sketch, EXT model"],
  ["Joinery units", "Fabrication geometry: every part, holes, grooves, edges (about LOD 400)", "Mark, material, finish, quantity per unit", "Unit sheet (front, side, sections, top, details, 3D, exploded), material quantities"],
  ["Wall cladding", "Every strip, backing and trim, cut to the units", "Mark, material, run length", "Arrangement and detail sheets; fitted after the units"],
  ["Ceilings and lighting", "Ceiling boards, steps and trays; luminaires at position", "Type, level, circuit", "RCP, electrical layouts"],
  ["Mechanical", "Equipment, ducts, grilles, drains at size and level", "System, flow, size", "Layouts, sections, details"],
  ["Electrical", "Devices, boards, circuits, routes", "Circuit, load, phase", "Layouts, circuits, board schedules"],
  ["Free-standing furniture", "Outline in general sections; full detail on its own sheet", "Mark, size", "Unit sheet"],
];
const cde = [
  ["WIP", "Work in progress", "The author's working models and sheets (OneDrive project folder)", "Author"],
  ["Shared", "For coordination", "Models linked for the other disciplines; coordination views and clash runs", "Information manager"],
  ["Published", "Issued", "Sheets issued as PDF with a Revit revision, in the project's Pdf folder", "Checker, then approver"],
  ["Archived", "Superseded", "Earlier issues kept unchanged; a new revision is made for every change", "Information manager"],
];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>BEP ${esc(P.number)}</title><style>
@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;font-size:10pt;color:#111;line-height:1.35}h1{font-size:18pt;margin:0 0 2mm}h2{font-size:12pt;margin:6mm 0 2mm;border-bottom:1px solid #999}
table{border-collapse:collapse;width:100%;margin:2mm 0}th,td{border:1px solid #bbb;padding:1.2mm 2mm;text-align:left;vertical-align:top}th{background:#eee}.ar{direction:rtl;font-family:Tahoma,Arial}.small{font-size:8.5pt;color:#444}
</style></head><body>
<h1>BIM Execution Plan</h1>
<div>${esc(P.name_en)} <span class="ar">${esc(P.name_ar)}</span><br>Project no. ${esc(P.number)} · Samaya Factory · ${today}</div>
<p class="small">Prepared to ISO 19650-1 and -2. This plan says how Samaya Factory produces, checks, shares and issues the project information. ${esc(P.client_requirements)}</p>
<h2>1. Project</h2>${table(["Item", "Value"], [["Client", P.client], ["Project", P.name_en], ["Number", P.number], ["Location", P.location], ["Designer", P.designer], ["Consultant", P.consultant], ["Fabricator and installer", P.contractor], ["Design source", P.design_source], ["Survey", P.survey], ["Status", P.status_notes]])}
<h2>2. Roles</h2>${table(["Role", "Person"], [["Information manager", P.people.information_manager], ["Checker (every sheet)", P.people.checker], ["Approver", P.people.approver], ["Production manager", P.people.production_manager], ["Designer of record", P.designer]])}
<h2>3. Standards applied</h2><p>Drawing and output: ${esc(Object.values(S.iso).slice(0, 9).join(", "))}. Units: millimetres. Projection: first angle. Sheets: ${esc(S.sheets.default_size)}, ISO 5457, with the factory title block (ISO 7200).</p>${table(["Tier", "Standard", "How we apply it"], bimRows)}
<h2>4. Models and federation</h2>${table(["File", "Discipline", "Role code", "Links"], P.models.map((m) => [m.file, m.discipline, m.role, m.links.join(", ") || "—"]))}
<p>Every model shares one origin (the shell's front-left outer corner), one set of levels and grids (on the existing inside faces, centre grids both ways; numbers right to left from the entrance, letters from the front), and phases Existing and New Construction (existing shown halftone). Links are placed origin to origin.</p>
<h2>5. Naming</h2>${table(["What", "Rule", "Example"], [["Sheets", S.sheets.number_pattern + " (ISO 19650 container name)", `${P.code}-SF-ZZ-GF-DR-A-2101`], ["Models", "<Project>_<DISCIPLINE>_<nn>.rvt", "Makkah_ARCH_01.rvt"], ["Revisions", "Two digits, Revit revisions only, one number per issue", "01, 02, 03"], ["Views", "<Discipline>-<Location>-<Type>-<Scope>", "A-L01-PLAN-New"]])}
<h2>6. Level of information need (ISO 7817-1)</h2>${table(["Item", "Geometry", "Information", "Documentation"], loin)}
<h2>7. Common data environment</h2>${table(["State", "Meaning", "Where", "Who moves it"], cde)}
<p class="small">Suitability and revision codes (S0-S4, A, C) are used only when the client asks for them.</p>
<h2>8. Coordination and clashes</h2><p>Coordination views colour each discipline (${esc(Object.entries(S.coordination.disciplines).map(([k, d]) => `${k} ${d.halftone ? "grey halftone" : "RGB " + d.color.join(" ")}`).join("; "))}). Every clash or clearance under ${S.coordination.clearance_flag_mm} mm becomes an issue, exported as BCF 2.1 so any BIM viewer can open it, with a view, the elements and a status. Coordination sheets: Z-1001 onwards.</p>
<h2>9. Checks before issue</h2><ul><li>Every sheet rendered and read; no overlaps, no placeholders, key plan, revision and sign-off filled.</li><li>Isolated and 3D views re-checked after model changes; linked models hidden in unit views.</li><li>Dimensions ISO 129-1; text and lines from the factory standard; sizes in whole cm where possible.</li><li>Models clash-checked against the existing shell; nothing new inside existing construction.</li></ul>
<h2>10. Deliverables (MIDP)</h2>${table(["Series", "Content"], P.deliverables.map((d) => [d.series, d.title]))}
<h2>11. Software and security</h2><p>Autodesk Revit 2026 with SultanRevitMCP (Samaya Factory's own Revit bridge), AutoCAD 2026 for source drawings. Models and the SultanRevitMCP repository are private; project data stays in the project folder (ISO 19650-5, security-minded).</p>
</body></html>`;
writeFileSync(out, html);
console.log("BEP written:", out);
