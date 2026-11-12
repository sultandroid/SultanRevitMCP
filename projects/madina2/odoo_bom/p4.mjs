// 12 Nov 2026, user: "Yes, fix the BOM" - Madina 2 approved EGGER decors are H1145 ST10 Natural Bardolino Oak and
// U775 ST9 White Grey (Orders/2026/039 .../الوان الاخشاب متجر المدينة 2; F416 / F638 also approved, not yet placed).
// The 11 Nov rules used Madina 1 / Makkah codes (H1113, H3710, U968, W1000): replaced.
import fs from "node:fs";
let t = fs.readFileSync("bom.mjs", "utf8");
const rp = (a, b) => { if (!t.includes(a)) throw new Error("p4: " + a.slice(0, 60)); t = t.replace(a, b); };
rp('const N = { H1113_8: NEW("MFC Sheet 8 mm [Egger H1113-ST10]", "لوح MFC إيجر H1113 سماكة 8 مم", "Sheet [205X280]"),',
   'const N = { H1113_8: NEW("MFC Sheet 8 mm [Egger H1113-ST10]", "لوح MFC إيجر H1113 سماكة 8 مم", "Sheet [205X280]"), U775_8: NEW("MFC Sheet 8 mm [Egger U775-ST9 White Grey]", "لوح MFC إيجر U775 أبيض رمادي سماكة 8 مم", "Sheet [205X280]"),');
rp('  if (/White Carcass/.test(m)) return [{ ...sheet(P.U775, SHE), note: "carcass colour U775 - confirm" }];', '  if (/White Carcass/.test(m)) return [sheet(P.U775, SHE)];');
rp('  if (/White Back 8|Pegboard Face White/.test(m)) return [sheet(P.W8, SHE)];', '  if (/White Back 8|Pegboard Face White/.test(m)) return [sheet(N.U775_8, SHE)];');
rp('  if (/Oak Frame 18/.test(m)) return [{ c: P.H1113, q:', '  if (/Oak Frame 18/.test(m)) return [{ c: P.H1145, q:');
rp('  if (/Oak Back 8/.test(m)) return [sheet(N.H1113_8, SHE)];', '  if (/Oak Back 8/.test(m)) return [sheet(P.H1145_8, SHE)];');
rp('  if (/Shelf 18 Approved Decor/.test(m)) return [{ ...sheet(P.H1113, SHE), note: "shelf decor - confirm" }];', '  if (/Shelf 18 Approved Decor/.test(m)) return [sheet(P.H1145, SHE)];');
rp('  if (/H3710/.test(m)) return [sheet(t <= 8 ? P.H3710_8 : P.H3710, SHE)];', '  if (/H3710/.test(m)) return [{ ...sheet(t <= 8 ? P.H1145_8 : P.H1145, SHE), note: "model says H3710 walnut (Makkah copy): not approved for Madina 2, H1145" }];');
rp('  if (/Pegboard Face Approved Oak/.test(m)) return [{ ...sheet(P.H3710_8, SHE), note: "oak pegboard face decor - confirm" }];', '  if (/Pegboard Face Approved Oak/.test(m)) return [sheet(P.H1145_8, SHE)];');
rp('  if (/U968/.test(m)) return [sheet(P.U968, SHE)];', '  if (/U968/.test(m)) return [{ ...sheet(P.U775, SHE), note: "model says U968 (Makkah copy): not approved for Madina 2, U775 - confirm" }];');
rp('[/H3710/, "WAL", "Walnut MFC", "MFC جوز"]', '[/H3710/, "BOK", "Bardolino Oak MFC", "MFC بلوط باردولينو"]');
rp('[/H1113|Oak Frame/, "OAK", "Oak MFC", "MFC بلوط"]', '[/H1113|Oak Frame/, "OAK", "Oak MFC", "MFC بلوط"]');
fs.writeFileSync("bom.mjs", t); console.log("patched 4");
