// Extract the pictures of an RTF file (pngblip / jpegblip) in order.
// Usage: node rtf_images.mjs <file.rtf> <outDir> [name1,name2,...]
import fs from "node:fs";
import path from "node:path";
const [src, out, names = ""] = process.argv.slice(2);
const s = fs.readFileSync(src, "latin1");
const N = names ? names.split(",") : [];
fs.mkdirSync(out, { recursive: true });
const re = /\{\\pict([^{}]*?)\\(pngblip|jpegblip)([^{}]*?)\s([0-9a-fA-F\s]+)\}/g;
let m, i = 0; const res = [];
while ((m = re.exec(s))) {
  const hex = m[4].replace(/\s+/g, ""), buf = Buffer.from(hex, "hex"), ext = m[2] === "pngblip" ? "png" : "jpg";
  const w = /\\picw(\d+)/.exec(m[1] + m[3]), h = /\\pich(\d+)/.exec(m[1] + m[3]);
  const f = path.join(out, (N[i] || `img_${String(i + 1).padStart(2, "0")}`) + "." + ext);
  fs.writeFileSync(f, buf); res.push({ f: path.basename(f), bytes: buf.length, picw: w && +w[1], pich: h && +h[1] }); i++;
}
console.log(JSON.stringify(res, null, 1));
