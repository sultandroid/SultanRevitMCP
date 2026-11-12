import fs from "node:fs"; import ExcelJS from "exceljs"; import { kw } from "./odoo.mjs";
const U = JSON.parse(fs.readFileSync("units.json", "utf8"));
const PREF = "SIC-043-GEN-GSH2", WASTE = 1.10, SH = 1.22 * 2.44, SHE = 2.05 * 2.80;
const P = { FR8: 22597, FR12: 24432, FR18: 24433, MR18: 24430, U775: 27526, W8: 29477, H1113: 29377, H3710: 29397, H3710_8: 29398, U968: 29379, OAK: 24357, PINE: 24368,
  TRAV: 29219, GLASS: 21273, SHS40: 23670, MS5: 24153, MS6: 24928, MS10: 25933, SS15: 24157, EDGE: 21214, HINGE_H: 24543, HINGE_I: 21223, LED: 21215, GYP: 25326, NCPAINT: 23454, WBPAINT: 22184,
  H1145: 29380, H1145_8: 29476, PLY18: 24438, M8ROD: 27758, ANCH: 27759 };
const NEW = (en, ar, uom) => ({ new: true, en, ar, uom });
const N = { H1113_8: NEW("MFC Sheet 8 mm [Egger H1113-ST10]", "لوح MFC إيجر H1113 سماكة 8 مم", "Sheet [205X280]"), U775_8: NEW("MFC Sheet 8 mm [Egger U775-ST9 White Grey]", "لوح MFC إيجر U775 أبيض رمادي سماكة 8 مم", "Sheet [205X280]"), SINK: NEW("Stainless steel sink 304", "حوض ستانلس 304", "Units"),
  HSS: NEW("Bar handle stainless 304 brushed", "مقبض بار ستانلس 304 مصنفر", "Units"), HWD: NEW("Hardwood bar handle", "مقبض بار خشب صلب", "Units"), HISL: NEW("Wood baton handle (island)", "مقبض خشب (الجزيرة)", "Units"),
  GROM: NEW("Cable grommet 60 mm black", "فتحة كابلات 60 مم سوداء", "Units"), PIN: NEW("Shelf pin 5 mm nickel", "مسمار رف 5 مم نيكل", "Units"), LEG: NEW("Adjustable cabinet leg 50", "رجل خزانة قابلة للضبط 50", "Units"),
  PLAST: NEW("Earth plaster finish (as approved)", "تشطيب لياسة طينية (حسب المعتمد)", "m²"), VEN: NEW("Wood veneer finish (island, as approved)", "قشرة خشب (الجزيرة، حسب المعتمد)", "m²"),
  DTOP: NEW("Dark wood top 20 mm (as approved)", "سطح خشب داكن 20 مم (حسب المعتمد)", "m²"), RAT: NEW("Rattan cane webbing", "شبك راتان", "m²"), OVEN: NEW("Oak veneer (match Egger)", "قشرة بلوط (مطابقة لإيجر)", "m²"),
  GRILLE: NEW("Fridge vent grille grey", "شبكة تهوية ثلاجة رمادي", "Units"), DFRAME: NEW("Display frame white (aluminium)", "إطار عرض أبيض (ألومنيوم)", "m"),
  M10: NEW("Threaded rod M10 x 3 m", "قضيب مسنن M10 طول 3 م", "Units"), FB406: NEW("Flat bar 40x6 mm", "حديد مبسط 40x6 مم", "m"), FB308: NEW("Flat bar 30x8 mm", "حديد مبسط 30x8 مم", "m"),
  ANG25: NEW("Angle 25x25x3 mm", "زاوية حديد 25x25x3 مم", "m"), ANG40: NEW("Angle 40x40x4 mm", "زاوية حديد 40x40x4 مم", "m"), MESH: NEW("Welded mesh 4 mm @ 100 x 100", "شبك ملحوم 4 مم فتحة 100x100", "m²"),
  DUCT: NEW("PVC cable duct 80x40 white", "مجرى كابلات PVC أبيض 80x40", "m"), TRAY: NEW("Cable tray perforated 100x50", "حامل كابلات مثقب 100x50", "m") };
const area = (d) => (d[1] * d[2]) / 1e6, len = (d) => d[2] / 1000, vol = (d) => (d[0] * d[1] * d[2]) / 1e9;
const sheet = (c, A = SH) => ({ c, q: (d) => area(d) / A * WASTE });
const paint = { c: P.NCPAINT, q: (d) => area(d) };
const rule = (m, t, dd = [0, 0, 0]) => {
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
  if (/^FR MDF \d+ Oak Veneer/.test(m)) return [t <= 9 ? sheet(P.FR8) : sheet(P.FR18), { c: N.OVEN, q: (d) => area(d) * WASTE }];
  if (/Threaded Rod M10/.test(m)) return [{ c: N.M10, q: (d) => len(d) / 3 * WASTE, note: "short bolts in the hanger" }];
  if (/Nut and Washer/.test(m)) return [];
  if (/Steel Angle 40x40x4/.test(m)) return [{ c: N.ANG40, q: (d) => len(d) / 2 * WASTE }];
  if (/^Paint (Rust|Green)/.test(m)) return [paint];
  if (/Cable Duct PVC/.test(m)) return [{ c: N.DUCT, q: (d) => len(d) * WASTE }];
  if (/Cable Tray/.test(m)) return [{ c: N.TRAY, q: (d) => len(d) * WASTE }];
  if (/EGGER 8 H1145/.test(m)) return [sheet(P.H1145_8, SHE)];
  if (/H1145/.test(m) && /EGGER/.test(m)) return [sheet(t <= 8 ? P.H1145_8 : P.H1145, SHE)];
  if (/^Plywood/.test(m)) return [sheet(P.PLY18)];
  if (/POS Terminal|Unassigned|Hinge Plate/.test(m)) return [];
  if (/^FR MDF Painted/.test(m)) return [t <= 9 ? sheet(P.FR8) : t <= 12 ? sheet(P.FR12) : t <= 18 ? sheet(P.FR18) : { ...sheet(P.FR8), note: "curved skin, area from bounding box" }, paint];
  if (/^FR MDF Packer/.test(m)) return [{ ...sheet(P.FR8), note: "4 mm packer, cut from FR 8" }];
  if (/^FR MDF/.test(m)) return [sheet(P.FR18)];
  if (/^MR MDF/.test(m)) return [{ ...sheet(P.MR18), note: "16 mm door core; MR 18 in Odoo" }];
  if (/Stainless Steel 304 Brushed Kick/.test(m)) return [sheet(P.SS15), sheet(P.MR18)];
  if (/Stainless Steel 304 Brushed/.test(m)) return [{ ...sheet(P.SS15), note: "1.2 mm drawn; 1.5 mm in Odoo - confirm" }];
  if (/White Carcass/.test(m)) return [sheet(P.U775, SHE)];
  if (/White Back 8|Pegboard Face White/.test(m)) return [sheet(N.U775_8, SHE)];
  if (/Oak Frame 18/.test(m)) return [{ c: P.H1145, q: (d) => area(d) / SHE * WASTE * (t > 30 ? 2 : 1) }];
  if (/Oak Back 8/.test(m)) return [sheet(P.H1145_8, SHE)];
  if (/Shelf 18 Approved Decor/.test(m)) return [sheet(P.H1145, SHE)];
  if (/H3710/.test(m)) return [{ ...sheet(t <= 8 ? P.H1145_8 : P.H1145, SHE), note: "model says H3710 walnut (Makkah copy): not approved for Madina 2, H1145" }];
  if (/Pegboard Face Approved Oak/.test(m)) return [sheet(P.H1145_8, SHE)];
  if (/U775/.test(m)) return [sheet(P.U775, SHE)];
  if (/U968/.test(m)) return [{ ...sheet(P.U775, SHE), note: "model says U968 (Makkah copy): not approved for Madina 2, U775 - confirm" }];
  if (/Solid Oak/.test(m)) return [{ c: P.OAK, q: (d) => vol(d) * WASTE }];
  if (/Softwood|Ceiling Wood Frame/.test(m)) return [{ c: P.PINE, q: (d) => vol(d) * WASTE }];
  if (/Travertine/.test(m)) return [{ c: P.TRAV, q: (d) => area(d) * WASTE, note: "Odoo item looks like a sale item - confirm raw slab" }];
  if (/Display Glass/.test(m)) return [{ c: P.GLASS, q: (d) => area(d) * WASTE }];
  if (/SHS 40x40x2/.test(m)) return [{ c: P.SHS40, q: (d) => len(d) / 6 * WASTE, note: "bar = 6 m" }];
  if (/Steel Plate 6/.test(m)) return [sheet(P.MS6)];
  if (/Steel Plate 10/.test(m)) return [sheet(P.MS10)];
  if (/Steel Base Plate 8/.test(m)) return [{ ...sheet(P.MS10), note: "8 mm drawn; nearest in Odoo 10 mm - confirm" }];
  if (/Steel Painted Black/.test(m)) return [sheet(t <= 5 ? P.MS5 : t <= 6 ? P.MS6 : P.MS10)];
  if (/Sink|Grommet/.test(m)) return []; // by the client (user, 11 Nov 2026)
  if (/PVC Edge/.test(m)) return [{ c: P.EDGE, q: (d) => len(d) * WASTE }];
  if (/Hinge 35 Half/.test(m)) return [{ c: P.HINGE_H, q: () => 1 }];
  if (/Hinge 35 Inset/.test(m)) return [{ c: P.HINGE_I, q: () => 1 }];
  if (/Bar Handle Stainless/.test(m)) return [{ c: N.HSS, q: () => 1 }];
  if (/Hardwood Bar Handle/.test(m)) return [{ c: N.HWD, q: () => 1 }];
  if (/Baton Handle/.test(m)) return [{ c: N.HISL, q: () => 1 }];
  if (/Grommet/.test(m)) return [{ c: N.GROM, q: () => 1 }];
  if (/Shelf Pin/.test(m)) return [{ c: N.PIN, q: () => 1 }];
  if (/Adjustable Leg/.test(m)) return [{ c: N.LEG, q: () => 1 }];
  if (/LED Strip/.test(m)) return [{ c: P.LED, q: (d) => len(d) * WASTE }];
  if (/Gypsum/.test(m)) return [{ c: P.GYP, q: (d) => area(d) / 2.88 * WASTE }, { c: P.WBPAINT, q: area }];
  if (/Earth Plaster/.test(m)) return [{ c: N.PLAST, q: (d) => area(d) * WASTE }];
  if (/Paint Pink/.test(m)) return [{ c: P.WBPAINT, q: area }];
  if (/Furniture MDF Painted|Island Plinth/.test(m)) return [sheet(P.FR18), paint];
  if (/Island Wood Veneer/.test(m)) return [{ c: N.VEN, q: (d) => area(d) * WASTE }];
  if (/Dark Wood Top/.test(m)) return [{ c: N.DTOP, q: (d) => area(d) * WASTE }];
  if (/Rattan/.test(m)) return [{ c: N.RAT, q: (d) => area(d) * WASTE }];
  if (/Oak Veneer/.test(m)) return [{ c: N.OVEN, q: (d) => area(d) * WASTE }];
  if (/Vent Grille/.test(m)) return [{ c: N.GRILLE, q: () => 1 }];
  if (/Display Frame White/.test(m)) return [{ c: N.DFRAME, q: (d) => len(d) * WASTE }];
  return null;
};
const od = Object.fromEntries((await kw("product.product", "read", [Object.values(P)], { fields: ["display_name", "default_code", "uom_id"] })).map((p) => [p.id, p]));
const AR = [[/East Counter E-C1/, "كاونتر شرقي ستانلس"], [/Base Cabinet/, "خزانة سفلية"], [/Open Shelf Base Top/, "سطح وحدة الأرفف السفلية"], [/Open Shelf Base Unit/, "وحدة أرفف سفلية"], [/Open Shelf Unit .*Pegboard/, "وحدة أرفف مع لوح مثقب"],
  [/Open Shelf Unit/, "وحدة أرفف مفتوحة"], [/Rear Arch Unit .*Back Legs/, "أرجل خلفية لوحدة القوس الخلفي"], [/Rear Arch Unit/, "وحدة قوس خلفية"], [/West Arch Unit/, "وحدة قوس غربية"], [/East Arch Unit/, "وحدة قوس شرقية"],
  [/Arch Spandrel Cladding/, "تكسية ما بين الارشات"], [/Arch Back Panel/, "لوح خلفي للقوس"], [/Column Cladding Pegboard/, "تجاليد عمود بلوح مثقب"], [/L Fascia .*Marble/, "رأس رخام على شكل L"], [/L Fascia .*(Soffit|Inside)/, "سقفية الواجهة (داخلي)"],
  [/L Fascia .*(Lunette|Outside)/, "واجهة هلالية (خارجي)"], [/Filler CL/, "حشوة عمود أمامي"], [/Corner Filler/, "حشوة ركن"], [/Pegboard Joint Filler/, "حشوة فاصل الألواح المثقبة"], [/Services Cabinet/, "خزانة خدمات"],
  [/Carpet Hanger/, "علاقة سجاد"], [/Continuous Shelf/, "رف متصل"], [/Back Cladding/, "تكسية خلفية"], [/Steel Structure/, "هيكل حديد"], [/Arch Hangers/, "علاقات حديد للأقواس"], [/Tray Wood Frame/, "إطار خشبي للسقف (تراي)"],
  [/Ceiling Wood Frame/, "إطار خشبي للسقف"], [/Cashier Counter/, "كاونتر كاشير"], [/Island Display/, "وحدة عرض جزيرة"], [/Display Fridge/, "قاعدة ثلاجة عرض"]];
// Standard products (company rule, 11 Nov 2026): no project name in the product; type + main material + size in cm, so one
// product serves many projects and BOMs. Code JN-<type>-<W>x<D>x<H>[-<material>]. Project goes on the MO, not the product.
const T = [[/Ceiling Steel Frame/, "STF", "Steel Frame SHS 40", "هيكل SHS 40", 231], [/Rattan Panel/, "CLD", "Cladding Panel", "تجاليد", 239],
  [/Flower Mesh/, "MSH", "Steel Mesh Panel", "لوح شبك حديد", 232], [/Tray Edge Lining/, "CLD", "Cladding Panel", "تجاليد", 239], [/Pegboard Joint Strip/, "FL", "Filler Panel", "حشوة", 236], [/East Counter/, "CT", "Stainless Steel Counter", "كاونتر ستانلس ستيل", 237], [/Cashier Counter/, "CT", "Counter", "كاونتر", 237], [/Base Cabinet/, "BC", "Base Cabinet", "خزانة سفلية", 238], [/Open Shelf Base Top/, "OBT", "Open Shelf Base Top", "سطح وحدة أرفف سفلية", 237],
  [/Open Shelf Base Unit/, "OSB", "Open Shelf Base Unit", "وحدة أرفف سفلية", 237], [/Open Shelf Unit .*Pegboard/, "OSP", "Open Shelf Unit with Pegboard", "وحدة أرفف مع لوح مثقب", 237], [/Open Shelf Unit/, "OS", "Open Shelf Unit", "وحدة أرفف مفتوحة", 237],
  [/Back Legs/, "ARL", "Arch Back Legs", "أرجل خلفية لارش", 236], [/Arch Unit/, "AR", "Keel Arch Unit complete with Soffit and Marble Head", "وحدة ارش", 236], [/Spandrel/, "CLD", "Cladding Panel", "تجاليد", 239],
  [/Arch Back Panel/, "ABP", "Arch Back Panel", "لوح خلفي لارش", 239], [/Column Cladding Pegboard/, "CCP", "Column Cladding with Pegboard", "تجاليد عمود بلوح مثقب", 239], [/L Fascia .*Marble/, "MLH", "Marble L Head 20 mm", "رأس رخام L سماكة 20 مم", 228],
  [/L Fascia .*(Soffit|Inside)/, "FSO", "Fascia Soffit", "سقفية واجهة", 236], [/L Fascia .*(Lunette|Outside)/, "FLU", "Fascia Lunette", "واجهة هلالية", 236], [/Filler/, "FL", "Filler Panel", "حشوة", 236],
  [/Services Cabinet/, "FS", "Services Cabinet", "خزانة خدمات", 238], [/Carpet Hanger/, "CH", "Carpet Hanger", "علاقة سجاد", 232], [/Continuous Shelf/, "SH", "Wall Shelf", "رف حائطي", 236], [/Back Cladding/, "CLD", "Cladding Panel", "تجاليد", 239],
  [/Steel Structure/, "STF", "Steel Frame SHS 40", "هيكل SHS 40", 231], [/Arch Hangers/, "HG", "Steel Arch Hanger Set", "طقم علاقات للارشات", 232], [/Tray Wood Frame|Ceiling Wood Frame/, "CF", "Ceiling Wood Frame", "إطار خشبي للسقف", 611],
  [/Island Display/, "ID", "Island Display Unit", "وحدة عرض جزيرة", 237], [/Display Fridge/, "FP", "Display Fridge Plinth", "قاعدة ثلاجة عرض", 236]];
const MAT = [[/Rattan/, "RAT", "Rattan", "راتان"], [/Oak Veneer/, "OVN", "Oak Veneer", "قشرة بلوط"], [/H1145/, "BOK", "Bardolino Oak MFC", "MFC بلوط باردولينو"], [/H1113|Oak Frame/, "OAK", "Oak MFC", "MFC بلوط"], [/H3710/, "BOK", "Bardolino Oak MFC", "MFC بلوط باردولينو"], [/U775/, "WG", "White Grey MFC", "MFC أبيض رمادي"], 
  [/Stainless/, "SS", "Stainless Steel", "ستانلس ستيل"], [/SHS|Steel/, "STL", "Steel", "حديد"], [/FR MDF Painted|Painted/, "PNT", "Painted FR MDF", "MDF مقاوم حريق مدهون"], [/Travertine/, "TRV", "Travertine", "ترافرتين"], [/Plaster/, "PLS", "Earth Plaster", "لياسة طينية"], [/Softwood|Wood Frame/, "SW", "Softwood", "خشب صنوبر"]];
// Arch assembly (user, 11 Nov 2026): one arch product holds its back panel, back legs, fascia lunette + soffit and marble L
// head; only cabinets and shelf units stay apart. Children by name: LF-B -> AW-A, LF-E -> AW-B, LF-D -> RA-A, LF-C -> RA-B,
// LF-A-2 -> AR, LF-A-1/3 -> AR-E-R, Arch Back Panel X -> arch X. Child parts are weighted child qty / arch qty.
const parentOf = (f) => /LF-B-/.test(f) ? "West Arch Unit AW-A" : /LF-E-/.test(f) ? "West Arch Unit AW-B" : /LF-D-/.test(f) ? "Rear Arch Unit RA-A" : /LF-C-|RA-B Back Legs/.test(f) ? "Rear Arch Unit RA-B"
  : /LF-A-2-/.test(f) ? "East Arch Unit AR" : /LF-A-[13]-/.test(f) ? "East Arch Unit AR-E-R" : /Arch Back Panel (\S+)/.test(f) ? ({ "RA-A": "Rear Arch Unit RA-A", "AW-A": "West Arch Unit AW-A", "AW-B": "West Arch Unit AW-B" })[f.match(/Arch Back Panel (\S+)/)[1]] : null;
const ASGF = JSON.parse(fs.readFileSync("assign.json", "utf8")), ASG = ASGF.inst;
for (const u of U) { const en = u.family.replace(/^Madina2 /, ""), par = parentOf(en); if (!par) continue;
  const pu = U.find((x) => x.family === "Madina2 " + par); u.child = true;
  for (const p of u.parts) pu.parts.push({ ...p, w: u.qty / pu.qty });
  (pu.kids ??= []).push(u.mark || en); }
// assembly size: union of the first arch instance and the children over it
for (const u of U.filter((x) => x.kids)) { const fam = u.family.replace(/^Madina2 /, ""); const a = ASG.find((i) => i.fam === fam); const fams = U.filter((x) => parentOf(x.family.replace(/^Madina2 /, "")) === fam).map((x) => x.family.replace(/^Madina2 /, ""));
  const sfx = (a.mark.match(/([0-9])$/) || [])[1]; const bs = [a.b, ...ASG.filter((i) => fams.includes(i.fam) && (i.fam.includes("Back Panel") ? (!sfx || i.mark.endsWith(sfx)) : ASGF.out[i.id] === a.id || (/LF-C-/.test(i.fam) && a.fam.includes("RA-B")))).map((i) => i.b)];
  u.size = ["x", "y", "z"].map((k) => Math.max(...bs.map((b) => b.max[k])) - Math.min(...bs.map((b) => b.min[k]))); }
const DEN = [[/Steel|SHS|Stainless|Hinge|Handle Stainless|Leg|Pin/, 7850], [/Marble|Travertine/, 2700], [/Glass/, 2500], [/Plaster/, 1600], [/Gypsum/, 900], [/MDF|EGGER|Filler|Plinth|Display Bars|Island/, 750], [/Oak/, 720], [/Softwood|Wood Frame|Hardwood|Rattan|Veneer|Dark Wood/, 550]];
const kg = (parts) => parts.reduce((t, p) => { const d = DEN.find(([re]) => re.test(p.m)); if (!d || /POS|Sink|Grommet|Unassigned/.test(p.m)) return t; const [a, b, c] = [...p.d].sort((x, y) => x - y); const v = /Hinge|Handle|Leg|Pin|LED|Edge/.test(p.m) ? a * b * c * 0.3 : a * b * c; return t + v / 1e9 * d[1] * (p.w ?? 1); }, 0);
const KGU = { 29476: 30, 29380: 67, 24438: 32, 27758: 1.2, 27759: 0.1, 22597: 17.9, 24432: 26.8, 24433: 40.2, 24430: 40.2, 27526: 67, 29477: 30, 29377: 67, 29397: 67, 29398: 30, 29379: 67, 24357: 720, 24368: 550, 29219: 54, 21273: 20, 23670: 13.9, 24153: 116.8, 24928: 140, 25933: 233.7, 24157: 35.4, 21214: 0.02, 24543: 0.1, 21223: 0.1, 21215: 0.05, 25326: 25, 23454: 0.3, 22184: 0.3 };
const KGN = (c) => /Threaded rod M10/.test(c.en) ? 1.8 : /Flat bar/.test(c.en) ? 1.9 : /Angle 25/.test(c.en) ? 1.1 : /Angle 40/.test(c.en) ? 2.4 : /Welded mesh/.test(c.en) ? 2 : /cable duct/i.test(c.en) ? 0.3 : /Cable tray/.test(c.en) ? 1.5 : /MFC Sheet 8/.test(c.en) ? 30 : /handle|leg/i.test(c.en) ? 0.3 : /pin/i.test(c.en) ? 0.005 : /plaster/i.test(c.en) ? 3 : /veneer/i.test(c.en) ? 0.5 : /Dark wood/.test(c.en) ? 12 : /Rattan/.test(c.en) ? 1 : /grille/i.test(c.en) ? 1 : /frame/i.test(c.en) ? 0.5 : 0;
const prods = new Map(), items = [], lines = [], unmapped = new Set();
for (const u of U) {
  if (u.child) continue;
  const en = u.family.replace(/^Madina2 /, "");
  const [, ab, ten, tar, categ] = T.find(([re]) => re.test(en)) ?? [null, "JU", en, en, 236];
  const area = new Map(); for (const p of u.parts) { const d = [...p.d].sort((a, b) => a - b); area.set(p.m, (area.get(p.m) ?? 0) + d[1] * d[2]); }
  const top = [...area.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  // the east counter keeps its SS code (its carcass board now has more area than the steel skin, 12 Nov 2026)
  const mat = /East Counter/.test(en) ? MAT.find((x) => x[1] === "SS") : MAT.find(([re]) => top.slice(0, 2).some((m) => re.test(m))) ?? [null, "", "", ""];
  const [w, d0, h] = u.size.map((v) => Math.round(v / 10)); const [W, D] = w >= d0 ? [w, d0] : [d0, w];
  const code = `JN-${ab}-${W}x${D}x${h}${mat[1] ? "-" + mat[1] : ""}`;
  const arN = tar, enN = `${ten}${mat[2] && !ten.includes(mat[2]) ? " " + mat[2] : ""}`;
  const odooName = `${arN} | ${enN} - ${W} x ${D} x ${h} cm`;
  const known = prods.get(code); if (known) { known.qty += u.qty; known.marks.push([u.mark || en, ...(u.kids ?? [])].join(" + ")); continue; }
  const agg = new Map();
  for (const p of u.parts) { const d = [...p.d].sort((a, b) => a - b); const r = rule(p.m, Math.round(d[0]), d); if (r === null) { unmapped.add(p.m); continue; }
    for (const l of r) { const key = l.c.new ? "NEW:" + l.c.en : l.c; const a = agg.get(key) ?? { c: l.c, q: 0, notes: new Set(), from: new Set() }; a.q += l.q(d) * (p.w ?? 1); if (l.note) a.notes.add(l.note); a.from.add(p.m); agg.set(key, a); } }
  const it = { code, en: enN, ar: arN, odooName, qty: u.qty, size: `${W} x ${D} x ${h} cm`, categ, marks: [[u.mark || en, ...(u.kids ?? [])].join(" + ")], lines: agg.size, inOdoo: "NEW", agg, route: "Manufacture", weight: +[...agg.values()].reduce((t, a) => t + a.q * (a.c.new ? KGN(a.c) : (KGU[a.c] ?? 0)), 0).toFixed(1), volume: +((W * D * h) / 1e6).toFixed(3) };
  prods.set(code, it); items.push(it);
}
for (const it of items) { it.marksTxt = it.marks.join(", ");
  for (const a of it.agg.values()) { const e = a.c.new ? null : od[a.c];
    lines.push({ code: it.code, item: it.en, status: a.c.new ? "NEW - to create" : "Exists", id: e?.id ?? "", ccode: e?.default_code || "", cname: a.c.new ? `${a.c.en} | ${a.c.ar}` : e.display_name, qty: +a.q.toFixed(4), uom: a.c.new ? a.c.uom : e.uom_id[1], total: +(a.q * it.qty).toFixed(3), from: [...a.from].join("; "), note: [...a.notes].join("; ") }); } }
// check the standard products against Odoo (same code or same name already there)
for (const it of items) { const r = await kw("product.template", "search_read", [["|", ["default_code", "=", it.code], ["name", "=", it.odooName]]], { fields: ["id"], limit: 1 }); if (r.length) it.inOdoo = "Exists #" + r[0].id; }
fs.writeFileSync("items.json", JSON.stringify(items.map(({ agg, ...i }) => i), null, 1)); fs.writeFileSync("lines.json", JSON.stringify(lines, null, 1));
const tot = new Map(); for (const l of lines) { const t = tot.get(l.cname) ?? { ...l, total: 0, items: 0 }; t.total += l.total; t.items++; tot.set(l.cname, t); }
const wb = new ExcelJS.Workbook(); wb.creator = "Samaya Factory";
const readme = wb.addWorksheet("0 Read me");
[["Rule", "Standard products: no project name in the product, type + main material + size in cm, so one product serves many projects and BOMs. Same type and size = one product. The project goes on the MO. Name = one line: Arabic | English - size (size written once), saved the same in both Odoo languages."], ["Project", "تنفيذ متجر مدينة المعرفة 2 (ستايل مديني) - هدايا طيبة - HT-KEC-MAD02 | Odoo project 342 | code SIC-043-GEN-GSH2"], ["Source", "Revit model Madina2_ARCH_01, 12 Nov 2026 (every part read from the families)"],
 ["Quantities", "Per unit in Odoo purchase UOM. Boards in sheets (122x244 or Egger 205x280); +10% waste on boards, m2, m and m3; hardware by count."], ["Yellow rows", "Component not in Odoo yet: created as a new product on approval"],
 ["Notes column", "Points to confirm (decor, nearest size in Odoo)"], ["Not included", "Labour, glue, screws, consumables; POS terminal and fridge (by others)"], ["Next", "After approval: create products and BOMs in Odoo (nothing created yet)"]].forEach((r) => readme.addRow(r));
readme.getColumn(1).width = 16; readme.getColumn(2).width = 120; readme.getColumn(1).font = { bold: true };
const add = (name, cols, rows) => { const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] }); ws.columns = cols.map(([h, k, w]) => ({ header: h, key: k, width: w })); rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F4F4F" } }; ws.autoFilter = { from: "A1", to: { row: 1, column: cols.length } };
  const sc = cols.findIndex((c) => c[1] === "status" || c[1] === "inOdoo") + 1;
  ws.eachRow((row, i) => { if (i > 1 && sc && /NEW/.test(String(row.getCell(sc).value))) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } }; }); };
add("1 Items (MO products)", [["Product code", "code", 26], ["Odoo product name (same in Arabic and English)", "odooName", 90], ["Name EN", "en", 46], ["الاسم بالعربي", "ar", 46], ["Size", "size", 18], ["Qty (Madina 2 MO)", "qty", 10], ["Madina 2 marks", "marksTxt", 34], ["BOM lines", "lines", 9], ["In Odoo", "inOdoo", 12]], items);
add("2 BOM lines", [["Product code", "code", 44], ["Item", "item", 34], ["Status", "status", 16], ["Odoo id", "id", 8], ["Component code", "ccode", 18], ["Component", "cname", 64], ["Qty per unit", "qty", 12], ["UOM", "uom", 16], ["Qty x units", "total", 12], ["From model material", "from", 50], ["Note", "note", 46]], lines);
add("3 Materials total", [["Status", "status", 16], ["Odoo id", "id", 8], ["Component code", "ccode", 18], ["Component", "cname", 64], ["Total qty (project)", "total", 16], ["UOM", "uom", 16], ["Used in items", "items", 12], ["Note", "note", 46]],
  [...tot.values()].map((t) => ({ ...t, total: +t.total.toFixed(2) })).sort((a, b) => a.status.localeCompare(b.status) || a.cname.localeCompare(b.cname)));
const out = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Odoo BOM/Madina2_Odoo_MO_BOM_for_approval_v8.xlsx";
fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true }); await wb.xlsx.writeFile(out);
console.log("items", items.length, "lines", lines.length, "components", tot.size, "new", [...tot.values()].filter((t) => /NEW/.test(t.status)).length, "unmapped:", [...unmapped].join(", ") || "none");
for (const t of [...tot.values()].sort((a, b) => a.cname.localeCompare(b.cname))) console.log(t.status.padEnd(16), t.total.toFixed(2).padStart(9), t.uom.padEnd(16), t.cname.slice(0, 70));
console.log(items.slice(0, 5).map((i) => i.code + " | " + i.odooName).join("\n"));
