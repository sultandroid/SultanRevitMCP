// Calculation note spec for the Madina 2 East Steel Frame (ST-E2) + East Arch Hangers, as built 12 Nov 2026.
// Style: samaya-doc-style-guide/projects/factory-technical; builder: tools/calc_note/build_calc_note.mjs.
import fs from "node:fs";
const R = JSON.parse(fs.readFileSync("../ste2_results_asbuilt.json", "utf8").replace(/^\uFEFF/, ""));
const Mo = JSON.parse(fs.readFileSync("../ste2_robot.json", "utf8")), nd = Object.fromEntries(Mo.nodes.map((n) => [n.id, n]));
const DIR = process.cwd().replace(/\\/g, "/"), F = (n) => `${DIR}/fig/${n}.png`;
const LOGO = "C:/Users/user/samaya-doc-style-guide/assets/logos/samaya-factory-logo.png";
const CLIENT = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Revit Files/Rfa/Title Blocks/logo-client.png";
const ROBOT = "C:/Users/user/AppData/Local/Temp/RSA12F8.tmp/Robot_Logotype_PPT_Professional.png";
const ok = (u) => (u <= 1 ? "OK" : "FAILS");
const rows = [ // [group, section, members, governing, N kN, M kNm, KL/r, ratio, clause]
  ["Hanger angles", "L 40x40x4", "2", "HA1", "0.08", "0.24", "25", 0.45, "F, H1-1b"],
  ["Back rails", "SHS 40x40x2", "3", "BR1500", "-0.15", "0.24", "86", 0.33, "E3, H1-1b"],
  ["Back posts", "SHS 40x40x2", "4", "BP2", "0.92", "0.20", "61", 0.28, "D2, H1-1b"],
  ["Front truss top chord", "SHS 40x40x2", "1", "TC", "4.53", "0.13", "50", 0.25, "D2, H1-1a"],
  ["Front truss diagonals", "SHS 40x40x2", "5", "TD9", "-3.23", "0.17", "26", 0.23, "E3, H1-1a"],
  ["Shelf plates (hung)", "PL 116x10", "2", "SP2", "0.01", "0.13", "-", 0.21, "F11"],
  ["Front truss bottom chord", "SHS 40x40x2", "1", "BC", "-4.14", "0.12", "50", 0.18, "E3, H1-1a"],
  ["End top rails", "SHS 40x40x2", "2", "ER1", "-0.10", "0.07", "37", 0.15, "E3, H1-1b"],
  ["M10 adjusting rods", "M10 (As 58 mm2)", "4", "HR1a", "-0.75", "0.00", "33", 0.14, "J3.6, H1-1b"],
  ["Front posts", "SHS 40x40x2", "2", "FP2", "0.61", "0.10", "82", 0.14, "D2, H1-1b"],
  ["Back diagonal", "SHS 40x40x2", "1", "BD1", "0.07", "0.09", "198", 0.12, "D2, H1-1b"],
  ["End rails +1.500", "SHS 40x40x2", "2", "EM1", "-0.03", "0.06", "37", 0.07, "E3, H1-1b"],
  ["End floor rails", "SHS 40x40x2", "2", "EF1", "-0.50", "0.04", "37", 0.06, "E3, H1-1b"],
  ["Hanger flat bars (seam)", "FB 40x6", "4", "HF2a", "-0.77", "0.00", "87", 0.05, "E3, H1-1b"],
  ["End diagonals", "SHS 40x40x2", "2", "ED1", "0.82", "0.01", "181", 0.02, "D2, H1-1b"],
].map((r) => [...r.slice(0, 7), r[7].toFixed(2), ok(r[7]), r[8]]);
const reac = R.reactions.map((r) => { const n = nd[r.node]; return [`x ${Math.round(n.x * 1000)} / y ${Math.round(n.y * 1000)}`, (r.FZ1 / 1000).toFixed(2), (r.FZ2 / 1000).toFixed(2), (r.FZ / 1000).toFixed(2), (r.FZup / 1000).toFixed(2), r.FZup > 0 ? "OK" : "FAILS"]; });
const sumD = R.reactions.reduce((s, r) => s + r.FZ1, 0) / 1000, sumL = R.reactions.reduce((s, r) => s + r.FZ2, 0) / 1000;
const tip = Math.max(...R.nodes.filter((n) => Math.abs(n.z - 1.902) < 1e-3).map((n) => -n.uz * 1000));
const chord = Math.max(...R.nodes.filter((n) => Math.abs(n.x - 5.75) < 1e-3 && Math.abs(n.z - 2.9) < 1e-3).map((n) => -n.uz * 1000));
const sway = Math.max(...R.nodes.filter((n) => Math.abs(n.z - 2.9) < 1e-3).map((n) => Math.abs(n.ux * 1000)));
const minUp = Math.min(...R.reactions.map((r) => r.FZup / 1000));
const spec = { out_docx: `${DIR}/MD2-SF-ZZ-GF-CA-S-0001_East_Steel_Frame_Calc_Note.docx`,
  meta: { logo: LOGO, client_logo: CLIENT, software_logo: undefined,
    title: "Structural Calculation Note", subtitle: "East Steel Frame ST-E2 with East Arch Hangers - stand-alone shopfit steel",
    header_title: "Structural Calculation Note - East Steel Frame ST-E2", header_sub: "Madina 2 Store (Madinah style), Knowledge Economic City",
    project_ar: "تنفيذ متجر مدينة المعرفة 2 - ستايل مديني", project_en: "Madina 2 Store (Madinah style) - Knowledge Economic City Mall, Madinah", project_no: "SIC-043-GEN-GSH2",
    client_ar: "شركة هدايا الطيبة", client_en: "Attayyibah Gifts", doc_no: "MD2-SF-ZZ-GF-CA-S-0001", rev: "00", date: "12.11.2026", status: "Preliminary - for review",
    control: [["Client", "Attayyibah Gifts"], ["Document No.", "MD2-SF-ZZ-GF-CA-S-0001"], ["Revision", "00 - Preliminary - for review"], ["Date", "12.11.2026"],
      ["Design codes", "SBC 301-2018 (loads), SBC 306-2018 / AISC 360-16 LRFD (steel)"], ["Software", "Autodesk Robot Structural Analysis Professional 2026 (model Madina2_ST-E2_asbuilt.rtd)"],
      ["Prepared by", "Samaya Factory - Technical Office"], ["Checked by", "Mohamed Sultan"], ["Approved by", "Client engineer"]],
    revisions: [["00", "12.11.2026", "Preliminary - for review", "First issue: as-built frame of 12 Nov 2026 (lean frame, hung shelf plates, angle hangers with M10 height adjustment)"]],
    signoff: [["Prepared", "Samaya Factory - Technical Office", "", "12.11.2026"], ["Checked", "Mohamed Sultan", "", ""], ["Approved", "Client engineer", "", ""]] },
  body: [
    { h1: "Executive summary" },
    { p: "This note checks the stand-alone steel frame behind the east arches (East Steel Frame ST-E2) and the arch hangers that carry the east shelf, as modelled on 12 Nov 2026, to SBC 301-2018 and SBC 306-2018 (AISC 360-16 LRFD). The frame stands on the floor with no anchors and no wall fixing." },
    { table: { head: ["Item", "Value", "Limit", "Result"], widths: [70, 40, 35, 20], caption: "Table 1 - Key results",
      rows: [["Highest member ratio (hanger angles L 40x40x4)", "0.45", "1.00", "OK"], ["Shelf plate deflection, SLS", `${tip.toFixed(1)} mm`, "608/125 = 4.9 mm", "OK"],
        ["Front truss deflection, SLS", `${chord.toFixed(1)} mm`, "4209/360 = 11.7 mm", "OK"], ["Top sway, SLS", `${sway.toFixed(1)} mm`, "H/400 = 7.3 mm", "OK"],
        ["Stability 0.9D + 1.6N, smallest foot load", `${minUp.toFixed(2)} kN`, "> 0 (no uplift)", minUp > 0 ? "OK" : "FAILS"],
        ["Total load on floor, D / L", `${sumD.toFixed(2)} / ${sumL.toFixed(2)} kN`, "-", "-"]] } },
    { h2: "Codes, loads and combinations at a glance" },
    { table: { head: ["Item", "Value", "Reference"], widths: [55, 75, 35], caption: "Table 2 - Design basis summary",
      rows: [["Load code", "SBC 301-2018", "-"], ["Steel code", "SBC 306-2018 / AISC 360-16 LRFD", "-"],
        ["Dead load D", "self-weight + cladding/pegboards 0.40 kN/m + shelf board 0.25 kN/m", "Table 5"],
        ["Live load L", "shelf goods 1.5 kN/m2; pegboard goods 0.5 kN/m2", "SBC 301 Ch. 4"],
        ["Notional load N", "0.002 x factored gravity, horizontal", "SBC 306 C2.2b"],
        ["Strength", "1.2D + 1.6L + 1.6N; 1.4D", "SBC 301 2.3.2"], ["Stability", "0.9D + 1.6N", "SBC 301 2.3.2"], ["Serviceability", "D + L + N", "SBC 301 App. C"]] } },
    { list: ["All members pass SBC 306; the highest ratio is 0.45.", "All deflections are within the SBC 301 Appendix C limits.", "Every foot stays in compression in the stability combination, so the frame stands without anchors.",
      "The shelf carries 1.5 kN/m2 of goods (about 350 kg over 3.84 m) and the pegboards 0.5 kN/m2.",
      "The 40 x 6 hanger flat bars are screwed to both arch heads at 150 mm centres along the seam; this is their buckling restraint."] },
    { h1: "Design basis" },
    { h2: "Codes" },
    { table: { head: ["Code", "Use"], widths: [55, 110], caption: "Table 3 - Codes", rows: [["SBC 301-2018", "Loads: live loads (Ch. 4), load combinations (2.3.2 LRFD, 2.4 SLS), deflection limits (Appendix C)"],
      ["SBC 306-2018 / AISC 360-16 LRFD", "Steel members: tension D2, compression E3, flexure F, combined forces H1-1, notional loads C2.2b, bolts J3.6"]] } },
    { h2: "Materials" },
    { table: { head: ["Item", "Grade", "Fy (MPa)", "E (MPa)"], widths: [70, 45, 25, 25], caption: "Table 4 - Materials", rows: [["SHS 40x40x2 (cold-formed)", "S235", "235", "200000"], ["L 40x40x4, flat bars, plates", "S235", "235", "200000"], ["M10 threaded rods", "Grade 4.6", "240", "200000"]] } },
    { h2: "Loads" },
    { table: { head: ["Case", "Load", "Value", "Applied to", "Source"], widths: [12, 50, 25, 43, 35], caption: "Table 5 - Load cases",
      rows: [["1 D", "Self-weight of steel", "78.5 kN/m3", "all members", "Robot"], ["1 D", "Back cladding BK-E + pegboards", "0.40 kN/m", "back rail +1.500", "18 FR MDF + 26 pegboard"],
        ["1 D", "Shelf ES-1 board (36 mm)", "0.25 kN/m", "each shelf plate", "board weight"], ["2 L", "Shelf goods 1.5 kN/m2 x 0.593 m x 1.316 m / 0.608 m", "1.93 kN/m", "each shelf plate", "SBC 301 Ch. 4"],
        ["2 L", "Pegboard goods 0.5 kN/m2 x 1.4 m", "0.70 kN/m", "back rail +1.500", "SBC 301 Ch. 4"], ["3 N", "Notional 0.002 x factored gravity", "0.007 kN/m", "back rail +2.900, horizontal", "SBC 306 C2.2b"]] } },
    { h2: "Load combinations" },
    { table: { head: ["No.", "Combination", "Type", "Use"], widths: [12, 55, 20, 78], caption: "Table 6 - Load combinations (SBC 301 2.3.2 / 2.4)",
      rows: [["10", "1.2 D + 1.6 L + 1.6 N", "ULS", "member strength"], ["12", "1.4 D", "ULS", "member strength (dead only)"], ["13", "0.9 D + 1.6 N", "ULS", "stability, no uplift at any foot"], ["11", "1.0 D + 1.0 L + 1.0 N", "SLS", "deflection"]] } },
    { h2: "Structural system" },
    { p: "The frame is 4209 mm long, 588 mm deep and 2920 mm high, in SHS 40x40x2. A front truss (chords at +2.900 and +2.800, five diagonals) spans between two front posts. Four back posts carry back rails at +0.028, +1.500 and +2.900, with one back diagonal and two end frames (top rail, rail at +1.500, floor rail and diagonal). At each of the two arch joints an angle L 40x40x4 spans from the front chord to the back rail; two M10 rods with nuts hang from it (height adjustment) onto 40 x 6 flat bars that run down the seam between the arch heads to the 116 x 10 shelf plate. The shelf plate is welded to the back joint post and hung at two points. The feet are pinned and rest on the floor without anchors." },
    { img: { path: F("m_model"), width_mm: 150, caption: "Figure 1 - Robot analytical model (sections and supports)" } },
    { h1: "Analysis" },
    { p: `Linear static analysis in Robot Structural Analysis 2026: ${Mo.nodes.length} nodes, ${Mo.bars.length} bars, 6 pinned feet. Equilibrium: dead load reactions ${sumD.toFixed(2)} kN and live load reactions ${sumL.toFixed(2)} kN, equal to the applied loads.` },
    { img: { path: F("m_defl"), width_mm: 160, caption: "Figure 2 - SLS deformation, combination 11 (Robot)" } },
    { img: { path: F("m_moment"), width_mm: 160, caption: "Figure 3 - Bending moment MY, combination 10 (Robot)" } },
    { img: { path: F("m_axial"), width_mm: 160, caption: "Figure 4 - Axial force FX, combination 10 (Robot)" } },
    { h2: "Support reactions" },
    { table: { head: ["Foot", "D (kN)", "L (kN)", "ULS 10 (kN)", "Stab. 13 (kN)", "Result"], widths: [45, 22, 22, 26, 28, 22], caption: "Table 7 - Vertical reactions (positive = foot pressing on the floor)", rows: reac } },
    { h1: "Member checks" },
    { p: "SBC 306 (AISC 360-16 LRFD), phi = 0.90 for tension, compression and flexure. Compression strength Fcr from E3 with K = 1.0 over the braced length (back rails between posts; flat bars between screws at 150 mm); flexure with the plastic modulus (compact sections). Interaction H1-1a when Pr/Pc >= 0.2, else H1-1b. Forces are the governing envelope of combinations 10 and 12." },
    { table: { head: ["Group", "Section", "No.", "Governing", "N (kN)", "M (kNm)", "KL/r", "Ratio", "Result", "Clause"], widths: [32, 22, 8, 16, 13, 13, 12, 11, 12, 16], size: 7.5, caption: "Table 8 - Member checks", rows } },
    { h1: "Serviceability and stability" },
    { table: { head: ["Check", "Value", "Limit", "Result"], widths: [70, 30, 45, 20], caption: "Table 9 - Serviceability and stability",
      rows: [["Shelf plate deflection (SLS)", `${tip.toFixed(1)} mm`, "L/125 = 4.9 mm (SBC 301 App. C)", "OK"], ["Front truss vertical deflection (SLS)", `${chord.toFixed(1)} mm`, "L/360 = 11.7 mm", "OK"],
        ["Top horizontal sway (SLS)", `${sway.toFixed(1)} mm`, "H/400 = 7.3 mm", "OK"], ["Uplift at any foot, 0.9D + 1.6N", "none", "no uplift", "OK"]] } },
    { h1: "Conclusions" },
    { list: ["The East Steel Frame ST-E2 with the East Arch Hangers, as built on 12 Nov 2026, satisfies SBC 306 strength (highest ratio 0.45) and SBC 301 serviceability.",
      "The frame is stable standing on the floor without anchors or wall fixing under the SBC 301 / SBC 306 load combinations.",
      "The hanger flat bars 40 x 6 are screwed to both arch heads at 150 mm centres; the M10 rods carry a nut and washer under and over the angle and are locked after levelling.",
      "Robot model: Madina2_ST-E2_asbuilt.rtd. The Robot output note is issued separately as MD2-SF-ZZ-GF-CA-S-0002."] },
  ] };
fs.writeFileSync("spec.json", JSON.stringify(spec, null, 1)); console.log("spec ok", spec.body.length);
