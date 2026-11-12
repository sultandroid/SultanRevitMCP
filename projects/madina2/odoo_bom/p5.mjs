// 12 Nov 2026, user: "in new odoo names please follow the rules, English-Arabic standardize, use proper existing units, no new
// units, don't repeat the sizes in the names, only English has the sizes".
// Odoo house pattern (RAW-... products): "[CODE] English name with size – Arabic name without size", existing UOMs only.
//  - existing stock items reused: L Steel 25x25x3 / 40x40x4 and FB Steel 40x5 in Bar [6 LM], natural oak veneer in m2;
//    the dark wood top is built from existing FR MDF 18 + oak veneer + NC paint (stained as approved)
//  - new components: English (size) – Arabic (no size), a proposed code in the house pattern, an existing UOM
//  - manufactured products: "English – Arabic", no size (the size is on the BOM / MO)
import fs from "node:fs";
let t = fs.readFileSync("bom.mjs", "utf8");
const rp = (a, b) => { if (!t.includes(a)) throw new Error("p5: " + a.slice(0, 70)); t = t.split(a).join(b); };
// after the N table: existing products + renamed new components
rp("const area = (d) =>", `Object.assign(P, { L25: 24223, L40: 24225, FB405: 24208, VNOAK: 24317 });
const NEWC = (code, en, ar, uom) => ({ new: true, code, en, ar, uom });
Object.assign(N, {
  U775_8: NEWC("RAW-MFC-EGGER-U775-8", "MFC Sheet 8 mm [Egger U775 ST9 White Grey]", "لوح إم إف سي إيجر أبيض رمادي", "Sheet [205X280]"),
  M10: NEWC("RAW-ROD-THREAD-M10-3M", "Threaded Rod M10 × 3 m", "قضيب مسنن", "Units"),
  MESH: NEWC("RAW-MESH-WELD-4-100", "Welded Mesh 4 mm @ 100×100 mm", "شبك حديد ملحوم", "m2"),
  RAT: NEWC("MAT-RATTAN-CANE", "Rattan Cane Webbing", "شبك راتان", "m2"),
  HSS: NEWC("MAT-HANDLE-BAR-SS304", "Bar Handle Stainless Steel 304 Brushed", "مقبض ستانلس ستيل", "Units"),
  HWD: NEWC("MAT-HANDLE-BAR-WOOD", "Bar Handle Hardwood", "مقبض خشب طبيعي", "Units"),
  LEG: NEWC("MAT-LEG-ADJ-50", "Adjustable Cabinet Leg 50 mm", "رجل خزانة قابلة للتعديل", "Units"),
  PIN: NEWC("MAT-SHELF-PIN-5", "Shelf Pin 5 mm Nickel", "مسمار رف", "Units"),
  DUCT: NEWC("MAT-DUCT-PVC-80x40", "PVC Cable Duct 80×40 mm White", "مجرى كابلات بلاستيك", "m"),
  TRAY: NEWC("MAT-TRAY-CABLE-100x50", "Cable Tray Perforated 100×50 mm", "حامل كابلات مثقب", "m"),
  DFRAME: NEWC("MAT-ALU-FRAME-WHT", "Aluminium Display Frame White", "إطار عرض ألمنيوم أبيض", "m"),
  GRILLE: NEWC("MAT-GRILLE-VENT-GRY", "Ventilation Grille Grey", "شبكة تهوية رمادي", "Units") });
const area = (d) =>`);
// steel shapes onto existing stock bars (6 m)
rp("[{ c: N.ANG40, q: (d) => len(d) / 2 }];      // cleat leg, 2 legs per angle", "[{ c: P.L40, q: (d) => len(d) / 2 / 6 * WASTE, note: \"cleats; bar = 6 m\" }];      // cleat leg, 2 legs per angle");
rp("[{ c: N.FB406, q: (d) => len(d) * WASTE }];", "[{ c: P.FB405, q: (d) => len(d) / 6 * WASTE, note: \"drawn 40x6: stock FB 40x5; bar = 6 m\" }];");
rp("[{ c: N.FB308, q: (d) => len(d) * WASTE }];", "[{ c: P.FB405, q: (d) => len(d) / 6 * WASTE, note: \"drawn 30x8 on edge: stock FB 40x5; bar = 6 m\" }];");
rp("[{ c: N.ANG25, q: (d) => len(d) / 2 * WASTE }];", "[{ c: P.L25, q: (d) => len(d) / 2 / 6 * WASTE, note: \"bar = 6 m\" }];");
rp("[{ c: N.ANG40, q: (d) => len(d) / 2 * WASTE }];", "[{ c: P.L40, q: (d) => len(d) / 2 / 6 * WASTE, note: \"bar = 6 m\" }];");
// veneers and the dark wood top from existing stock
rp("{ c: N.OVEN, q: (d) => area(d) * WASTE }", "{ c: P.VNOAK, q: (d) => area(d) * WASTE, note: \"natural oak veneer to match EGGER H1145\" }");
rp("[{ c: N.VEN, q: (d) => area(d) * WASTE }];", "[{ c: P.VNOAK, q: (d) => area(d) * WASTE, note: \"island veneer as approved\" }];");
rp("[{ c: N.DTOP, q: (d) => area(d) * WASTE }];", "[sheet(P.FR18), { c: P.VNOAK, q: (d) => area(d) * WASTE }, { ...paint, note: \"dark stain + lacquer as approved\" }];");
rp("[{ c: N.HISL, q: () => 1 }];", "[{ c: N.HWD, q: () => 1 }];");
// names: products English – Arabic, no size; new components English – Arabic with the proposed code
rp("const odooName = `${arN} | ${enN} - ${W} x ${D} x ${h} cm`;", "const odooName = `${enN} – ${arN}`;");
rp("ccode: e?.default_code || \"\", cname: a.c.new ? `${a.c.en} | ${a.c.ar}` : e.display_name,", "ccode: a.c.new ? (a.c.code ?? \"\") : (e?.default_code || \"\"), cname: a.c.new ? `${a.c.en} – ${a.c.ar}` : e.display_name,");
fs.writeFileSync("bom.mjs", t); console.log("patched 5");

// + Arabic of the steel frame product: "هيكل حديد" (was "هيكل SHS 40": size repeated in Arabic)
