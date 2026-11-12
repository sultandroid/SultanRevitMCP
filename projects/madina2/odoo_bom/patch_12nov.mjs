// One-off patch of bom.mjs for the 12 Nov 2026 model (kept for the record; bom.mjs in the repo already has it).
import fs from "node:fs";
let s = fs.readFileSync("bom.mjs", "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("patch target not found: " + a.slice(0, 60)); s = s.replace(a, b); };
// Odoo products found 12 Nov 2026 (read only)
rep("GYP: 25326, NCPAINT: 23454, WBPAINT: 22184 };", "GYP: 25326, NCPAINT: 23454, WBPAINT: 22184,\n  H1145: 29380, H1145_8: 29476, PLY18: 24438, M8ROD: 27758, ANCH: 27759 };");
rep('DFRAME: NEW("Display frame white (aluminium)", "إطار عرض أبيض (ألومنيوم)", "m") };',
  `DFRAME: NEW("Display frame white (aluminium)", "إطار عرض أبيض (ألومنيوم)", "m"),
  M10: NEW("Threaded rod M10 x 3 m", "قضيب مسنن M10 طول 3 م", "Units"), FB406: NEW("Flat bar 40x6 mm", "حديد مبسط 40x6 مم", "m"), FB308: NEW("Flat bar 30x8 mm", "حديد مبسط 30x8 مم", "m"),
  ANG25: NEW("Angle 25x25x3 mm", "زاوية حديد 25x25x3 مم", "m"), ANG40: NEW("Angle 40x40x4 mm", "زاوية حديد 40x40x4 مم", "m"), MESH: NEW("Welded mesh 4 mm @ 100 x 100", "شبك ملحوم 4 مم فتحة 100x100", "m²") };`);
// the rule now sees the part's sorted dims (dd) to tell steel shapes apart: every steel part of the ceiling set is one
// material "Steel Painted Black" (user 12 Nov 2026)
rep("const rule = (m, t) => {", `const rule = (m, t, dd = [0, 0, 0]) => {
  if (/Steel Painted Black/.test(m)) {
    const [a, b, c] = dd;
    if (c < 15) return [];                                                                 // nuts and washers: consumables
    if (a >= 38 && b <= 42) return [{ c: P.SHS40, q: (d) => len(d) / 6 * WASTE, note: "bar = 6 m" }];
    if (a <= 4.5 && b <= 4.5) return [{ c: N.MESH, q: (d) => len(d) / 20 * WASTE, note: "mesh m2 = wire length / 20" }];
    if (a <= 10.5 && b <= 10.5) return a >= 9 ? [{ c: N.M10, q: (d) => len(d) / 3 * WASTE }, { c: P.ANCH, q: () => 1 }] : [{ c: P.M8ROD, q: (d) => len(d) / 3 * WASTE, note: "3 m rod" }];
    if (a <= 4.5 && b <= 41 && c <= 60) return [{ c: N.ANG40, q: (d) => len(d) / 2 }];      // cleat leg, 2 legs per angle
    if (a <= 6.5 && b >= 39 && b <= 41) return [{ c: N.FB406, q: (d) => len(d) * WASTE }];
    if (a <= 8.5 && b >= 29 && b <= 31) return [{ c: N.FB308, q: (d) => len(d) * WASTE }];
    if (a <= 3.5 && b <= 26) return [{ c: N.ANG25, q: (d) => len(d) / 2 * WASTE }];          // 2 legs per angle
  }
  if (/^FR MDF \\d+ Oak Veneer/.test(m)) return [t <= 9 ? sheet(P.FR8) : sheet(P.FR18), { c: N.OVEN, q: (d) => area(d) * WASTE }];
  if (/EGGER 8 H1145/.test(m)) return [sheet(P.H1145_8, SHE)];
  if (/H1145/.test(m) && /EGGER/.test(m)) return [sheet(t <= 8 ? P.H1145_8 : P.H1145, SHE)];
  if (/^Plywood/.test(m)) return [sheet(P.PLY18)];`);
rep("const r = rule(p.m, Math.round(d[0]));", "const r = rule(p.m, Math.round(d[0]), d);");
// new item types (first match wins: put them first)
rep("const T = [[/East Counter/,", `const T = [[/Ceiling Steel Frame/, "STF", "Steel Frame SHS 40", "هيكل SHS 40", 231], [/Rattan Panel/, "CLD", "Cladding Panel", "تجاليد", 239],
  [/Flower Mesh/, "MSH", "Steel Mesh Panel", "لوح شبك حديد", 232], [/Tray Edge Lining/, "CLD", "Cladding Panel", "تجاليد", 239], [/East Counter/,`);
rep('const MAT = [[/H1113|Oak Frame/, "OAK", "Oak MFC", "MFC بلوط"],', 'const MAT = [[/Oak Veneer/, "OVN", "Oak Veneer", "قشرة بلوط"], [/H1145/, "BOK", "Bardolino Oak MFC", "MFC بلوط باردولينو"], [/Rattan/, "RAT", "Rattan", "راتان"], [/H1113|Oak Frame/, "OAK", "Oak MFC", "MFC بلوط"],');
// marks are item names since Rev 25 (12 Nov 2026): suffix digit without the dash, LF-C by family name
rep("const sfx = (a.mark.match(/-([0-9])$/) || [])[1];", "const sfx = (a.mark.match(/([0-9])$/) || [])[1];");
rep('(!sfx || i.mark.endsWith("-" + sfx))', "(!sfx || i.mark.endsWith(sfx))");
rep("(/LF-C-/.test(i.mark) && a.fam.includes(\"RA-B\"))", "(/LF-C-/.test(i.fam) && a.fam.includes(\"RA-B\"))");
rep('"Source", "Revit model Madina2_ARCH_01, 11 Nov 2026 (every part read from the families)"', '"Source", "Revit model Madina2_ARCH_01, 12 Nov 2026 (every part read from the families)"');
s = s.replace(/for_approval_v\d\.xlsx/, "for_approval_v8.xlsx");
fs.writeFileSync("bom.mjs", s);
console.log("patched");
// second pass (same day): unmapped materials and the E-C1 code
let t = fs.readFileSync("bom.mjs", "utf8");
const rp = (a, b) => { if (!t.includes(a)) throw new Error("patch2 target: " + a.slice(0, 60)); t = t.replace(a, b); };
rp('  if (/EGGER 8 H1145/.test(m))', `  if (/Threaded Rod M10/.test(m)) return [{ c: N.M10, q: (d) => len(d) / 3 * WASTE, note: "short bolts in the hanger" }];
  if (/Nut and Washer/.test(m)) return [];
  if (/Steel Angle 40x40x4/.test(m)) return [{ c: N.ANG40, q: (d) => len(d) / 2 * WASTE }];
  if (/^Paint (Rust|Green)/.test(m)) return [paint];
  if (/Cable Duct PVC/.test(m)) return [{ c: N.DUCT, q: (d) => len(d) * WASTE }];
  if (/Cable Tray/.test(m)) return [{ c: N.TRAY, q: (d) => len(d) * WASTE }];
  if (/EGGER 8 H1145/.test(m))`);
rp('MESH: NEW("Welded mesh 4 mm @ 100 x 100", "شبك ملحوم 4 مم فتحة 100x100", "m²") };', 'MESH: NEW("Welded mesh 4 mm @ 100 x 100", "شبك ملحوم 4 مم فتحة 100x100", "m²"),\n  DUCT: NEW("PVC cable duct 80x40 white", "مجرى كابلات PVC أبيض 80x40", "m"), TRAY: NEW("Cable tray perforated 100x50", "حامل كابلات مثقب 100x50", "m") };');
rp("const mat = MAT.find(([re]) => top.slice(0, 2).some((m) => re.test(m))) ?? [null, \"\", \"\", \"\"];",
   "// the east counter keeps its SS code (its carcass board now has more area than the steel skin, 12 Nov 2026)\n  const mat = /East Counter/.test(en) ? MAT.find((x) => x[1] === \"SS\") : MAT.find(([re]) => top.slice(0, 2).some((m) => re.test(m))) ?? [null, \"\", \"\", \"\"];");
fs.writeFileSync("bom.mjs", t);
console.log("patched 2");
