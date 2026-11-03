// ISO 19650 sheet numbers for Madina 1: Project-Originator-Volume-Level-Type-Role-Number.
// Old three-digit numbers map here, so every script keeps working: sn(120) -> "MD1-SF-ZZ-GF-DR-A-2101", ss(120) -> "A-2101".
export const PREFIX = "MD1-SF-ZZ-GF-DR-";
export const MAP = {
  100: ["A-0001", "0 General"],
  101: ["A-1001", "1 Arch GA"], 102: ["A-1002", "1 Arch GA"],
  104: ["A-1101", "1 Arch GA"], 106: ["A-1102", "1 Arch GA"], 105: ["A-1103", "1 Arch GA"],
  108: ["A-1104", "1 Arch GA"], 107: ["A-1105", "1 Arch GA"], 109: ["A-1106", "1 Arch GA"],
  110: ["A-1201", "1 Arch GA"], 111: ["A-1202", "1 Arch GA"], 112: ["A-1203", "1 Arch GA"],
  113: ["A-1301", "1 Arch GA"], 152: ["A-1302", "1 Arch GA"],
  190: ["A-1901", "1 Arch GA"], 191: ["A-1902", "1 Arch GA"], 192: ["A-1903", "1 Arch GA"],
  114: ["A-2000", "2 Fab: Base Cabinets"], 122: ["A-2001", "2 Fab: Base Cabinets"], 123: ["A-2002", "2 Fab: Base Cabinets"],
  115: ["A-2100", "2 Fab: Arch Units"], 120: ["A-2101", "2 Fab: Arch Units"], 139: ["A-2102", "2 Fab: Arch Units"],
  136: ["A-2103", "2 Fab: Arch Units"], 137: ["A-2104", "2 Fab: Arch Units"], 138: ["A-2105", "2 Fab: Arch Units"], 134: ["A-2106", "2 Fab: Arch Units"],
  116: ["A-2200", "2 Fab: Low Bays"], 124: ["A-2201", "2 Fab: Low Bays"], 125: ["A-2202", "2 Fab: Low Bays"], 151: ["A-2203", "2 Fab: Low Bays"],
  117: ["A-2300", "2 Fab: Rear Centre"], 126: ["A-2301", "2 Fab: Rear Centre"], 135: ["A-2302", "2 Fab: Rear Centre"],
  128: ["A-2303", "2 Fab: Rear Centre"], 127: ["A-2304", "2 Fab: Rear Centre"], 129: ["A-2305", "2 Fab: Rear Centre"],
  130: ["A-2306", "2 Fab: Rear Centre"], 133: ["A-2307", "2 Fab: Rear Centre"],
  157: ["A-2500", "2 Fab: Wall Cladding"], 158: ["A-2501", "2 Fab: Wall Cladding"],
  131: ["A-2401", "2 Fab: Free-standing"], 132: ["A-2402", "2 Fab: Free-standing"], 153: ["M-1001", "4 Mechanical"], 154: ["Z-1001", "5 Coordination"], 155: ["Z-1002", "5 Coordination"], 156: ["Z-1101", "5 Coordination"],
  140: ["E-1001", "3 Electrical"], 141: ["E-1002", "3 Electrical"], 142: ["E-1003", "3 Electrical"], 143: ["E-1004", "3 Electrical"],
  144: ["E-1005", "3 Electrical"], 145: ["E-1006", "3 Electrical"], 146: ["E-1101", "3 Electrical"], 150: ["E-1102", "3 Electrical"],
  147: ["E-1201", "3 Electrical"], 148: ["E-1202", "3 Electrical"], 149: ["E-1901", "3 Electrical"],
};
const key = (no) => String(no).replace(/^MD1-ID-GF-/, "");
export const ss = (no) => { const m = MAP[key(no)]; if (!m) throw new Error("no ISO number for sheet " + no); return m[0]; };
export const sn = (no) => PREFIX + ss(no);
export const group = (no) => MAP[key(no)][1];
// "124, 125" -> "A-2201, A-2202" for sheet columns in tables.
export const refs = (s) => String(s).split(/\s*,\s*/).map((n) => (MAP[n] ? MAP[n][0] : n)).join(", ");
