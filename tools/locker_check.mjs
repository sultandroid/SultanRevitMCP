// Locker rule audit (references/lockers.md, rules L01-L12). Input: the result of locker_system.mjs buildLockers()
// (doors, comps, fittings, spec). Output: [{ id, rule, result: PASS|WARN|FAIL, detail }].
// Usage: node tools/locker_check.mjs <result.json> [<result2.json> ...]   (prints a table per item)
//        import { checkLockers } from "./locker_check.mjs"
import { BOARD_KINDS, hingeCount } from "./locker_system.mjs";

export function checkLockers(R) {
  const S = R.spec ?? {}, F = S.fittings ?? {}, out = [];
  const add = (id, rule, ok, detail, warnOnly = false) => out.push({ id, rule, result: ok ? "PASS" : warnOnly ? "WARN" : "FAIL", detail });
  const doors = R.doors ?? [], comps = R.comps ?? [];
  // L01 board thickness exists for its material
  const bad = Object.entries(S.materials ?? {}).filter(([, m]) => BOARD_KINDS[m.kind] && !BOARD_KINDS[m.kind].includes(m.t));
  add("L01", "Board thickness exists on the market", !bad.length, bad.length ? bad.map(([k, m]) => `${k}: ${m.kind} ${m.t} mm not made`).join("; ") : "all thicknesses available");
  // L02 hinge suits door thickness
  const t = doors[0]?.t ?? 0, hinge = doors[0]?.hinge ?? "cup35";
  const l02 = hinge === "cup35" ? t >= 16 : hinge === "thin35" ? t >= 10 && t <= 19 : hinge === "cup26" ? t >= 10 && t <= 13 : true;
  add("L02", "Hinge type suits door thickness", l02, `${hinge} on ${t} mm ${doors[0]?.kind ?? ""} door` + (l02 ? "" : hinge === "cup35" ? " (35 mm cup needs 16 mm or more)" : ""));
  // L03 hinge count by height and weight
  const short = doors.filter((d) => d.hinges < hingeCount(d.h, d.kg));
  const heavy = doors.reduce((a, d) => (d.kg > a.kg ? d : a), { kg: 0 });
  add("L03", "Hinges per door by height and weight", !short.length, short.length ? `${short.length} doors short of hinges` : `ok; heaviest door ${heavy.kg} kg (${heavy.h} high) has ${heavy.hinges}`);
  // L04 door gap
  const gap = S.door?.gap ?? 3;
  add("L04", "Door gap 2 to 4 mm", gap >= 2 && gap <= 4, `${gap} mm`, true);
  // L05 compartment size
  const ws = comps.map((c) => c.w), ds = comps.map((c) => c.d);
  const l05 = Math.min(...ws) >= 280 && Math.max(...ws) <= 380 && Math.min(...ds) >= 300;
  add("L05", "Clear inside 280-380 wide, 300+ deep", l05, `widths ${[...new Set(ws)].join("/")}, depth ${[...new Set(ds)].join("/")}`, true);
  // L06 coat rail where deep and tall
  const need = comps.filter((c) => c.d >= 450 && c.h >= 700), missing = need.filter((c) => !c.rail);
  add("L06", "Coat rail where 450+ deep and 700+ high", !missing.length, `${need.length - missing.length} of ${need.length} tall compartments have a rail`, true);
  // L07 ventilation
  const noVent = comps.filter((c) => !c.vents);
  add("L07", "Air in and out of every compartment", !noVent.length, noVent.length ? `${noVent.length} compartments with no vents (solid doors, 3 mm gaps only)` : `${comps.reduce((a, c) => a + c.vents, 0)} vent holes`, true);
  // L08 accessible lockers
  const acc = doors.filter((d) => d.lockZ >= 380 && d.lockZ <= 1220).length, needAcc = Math.max(1, Math.ceil(doors.length * 0.05));
  add("L08", "Accessible lockers: 5% and 1+, lock 380-1220", acc >= needAcc, `${acc} of ${doors.length} have the lock in reach (need ${needAcc})`);
  // L09 wall fixing
  const wf = (R.fittings ?? []).filter((f) => f.code === "WF").length;
  add("L09", "Tall units fixed to the wall (EN 16121)", wf > 0, wf ? `${wf} wall fixings` : "no wall fixing shown");
  // L10 inserts in cement board / MDF
  const soft = ["viroc", "mdf"].includes(doors[0]?.kind);
  add("L10", "Inserts for hinges and locks in cement board / MDF", !soft || F.inserts, soft ? (F.inserts ? "threaded inserts" : "screws straight into the board") : "n/a", true);
  // L11 number plates
  add("L11", "Number on every door", doors.every((d) => d.number), `${doors.filter((d) => d.number).length} of ${doors.length}`, true);
  // L12 repeat door sizes
  const sizes = [...new Set(doors.map((d) => `${d.w}x${d.h}`))];
  add("L12", "Few door sizes (3 or fewer)", sizes.length <= 3, `${sizes.length} sizes: ${sizes.join(", ")}`, true);
  return out;
}

if (process.argv[1]?.endsWith("locker_check.mjs") && process.argv.length > 2) {
  const { readFileSync } = await import("node:fs");
  for (const f of process.argv.slice(2)) {
    const R = JSON.parse(readFileSync(f, "utf8")), res = checkLockers(R);
    console.log(`\n${R.item} ${R.title ?? ""}  (${res.filter((r) => r.result === "FAIL").length} FAIL, ${res.filter((r) => r.result === "WARN").length} WARN)`);
    for (const r of res) console.log(`  ${r.id} ${r.result.padEnd(4)} ${r.rule} - ${r.detail}`);
  }
}

