// Coordination issues as BCF 2.1 (buildingSMART), so any BIM viewer (Revit with a BCF add-in, Navisworks, Solibri, BIMcollab, Trimble Connect) opens them.
// Usage: node tools/bcf.mjs issues.json out.bcfzip
// issues.json: { "project": "HT-KEC-MAK01", "author": "Mohamed Sultan", "issues": [ { "title", "description", "type": "Clash|Clearance|Question",
//   "status": "Open|Closed", "priority": "High|Normal|Low", "assigned_to", "labels": [], "elements": [ { "ifc_guid", "revit_id", "model" } ],
//   "camera": { "eye": {x,y,z}, "target": {x,y,z} }   (model mm; written in metres as BCF wants), "snapshot": "path.png" } ] }
// IfcGUIDs come from each element's "IfcGUID" parameter (get_element). No dependencies: the zip is written by hand (stored, CRC-32).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** A zip with no compression: enough for BCF and readable by every viewer. files: [{ name, data: Buffer }] */
export function zip(files) {
  const locals = [], centrals = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"), data = f.data, crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
    h.writeUInt32LE(0, 10); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
    locals.push(h, name, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
    c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42); centrals.push(c, name);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const x = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const m = (v) => (v / 1000).toFixed(4);
const pt = (tag, p) => `<${tag}><X>${m(p.x)}</X><Y>${m(p.y)}</Y><Z>${m(p.z)}</Z></${tag}>`;
const dir = (tag, a, b) => { const d = [b.x - a.x, b.y - a.y, b.z - a.z], l = Math.hypot(...d) || 1; return `<${tag}><X>${(d[0] / l).toFixed(6)}</X><Y>${(d[1] / l).toFixed(6)}</Y><Z>${(d[2] / l).toFixed(6)}</Z></${tag}>`; };

/** Builds the .bcfzip buffer from the issues object. */
export function bcf(data) {
  const now = new Date().toISOString(), projectId = randomUUID(), files = [];
  files.push({ name: "bcf.version", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="2.1"><DetailedVersion>2.1</DetailedVersion></Version>`) });
  files.push({ name: "project.bcfp", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n<ProjectExtension><Project ProjectId="${projectId}"><Name>${x(data.project)}</Name></Project><ExtensionSchema></ExtensionSchema></ProjectExtension>`) });
  for (const it of data.issues) {
    const g = randomUUID(), vp = randomUUID();
    const comps = (it.elements ?? []).map((e) => `<Component IfcGuid="${x(e.ifc_guid ?? "")}"${e.model ? ` OriginatingSystem="${x(e.model)}"` : ""}${e.revit_id ? ` AuthoringToolId="${x(e.revit_id)}"` : ""}/>`).join("");
    const hasShot = it.snapshot && existsSync(it.snapshot);
    files.push({ name: `${g}/markup.bcf`, data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Markup><Topic Guid="${g}" TopicType="${x(it.type ?? "Clash")}" TopicStatus="${x(it.status ?? "Open")}">
<Title>${x(it.title)}</Title><Priority>${x(it.priority ?? "Normal")}</Priority>${(it.labels ?? []).map((l) => `<Labels>${x(l)}</Labels>`).join("")}
<CreationDate>${now}</CreationDate><CreationAuthor>${x(data.author)}</CreationAuthor>${it.assigned_to ? `<AssignedTo>${x(it.assigned_to)}</AssignedTo>` : ""}
<Description>${x(it.description)}</Description></Topic>
<Viewpoints Guid="${vp}"><Viewpoint>viewpoint.bcfv</Viewpoint>${hasShot ? "<Snapshot>snapshot.png</Snapshot>" : ""}</Viewpoints></Markup>`) });
    const cam = it.camera ? `<PerspectiveCamera>${pt("CameraViewPoint", it.camera.eye)}${dir("CameraDirection", it.camera.eye, it.camera.target)}<CameraUpVector><X>0</X><Y>0</Y><Z>1</Z></CameraUpVector><FieldOfView>60</FieldOfView></PerspectiveCamera>` : "";
    files.push({ name: `${g}/viewpoint.bcfv`, data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<VisualizationInfo Guid="${vp}"><Components><Selection>${comps}</Selection><Visibility DefaultVisibility="true"/></Components>${cam}</VisualizationInfo>`) });
    if (hasShot) files.push({ name: `${g}/snapshot.png`, data: readFileSync(it.snapshot) });
  }
  return zip(files);
}

if (process.argv[1]?.endsWith("bcf.mjs")) {
  const [inp, out] = process.argv.slice(2);
  if (!inp || !out) { console.log("usage: node tools/bcf.mjs issues.json out.bcfzip"); process.exit(1); }
  const data = JSON.parse(readFileSync(inp, "utf8"));
  writeFileSync(out, bcf(data));
  console.log(`BCF 2.1 written: ${out} (${data.issues.length} issues)`);
}
