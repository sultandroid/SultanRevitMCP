// Re-export PHOTO views in Shaded (material colours) when Realistic shows grey: materials made by the bridge have a
// shading colour but no render appearance (12 Nov 2026). usage: node photo_shaded.mjs <product codes...>
import { call as raw } from "file:///C:/Users/user/samaya-revit-standards/tools/rvt.mjs"; import fs from "node:fs";
const call = (n, a = {}) => raw(n, { document: "Madina2_ARCH_01", ...a });
const OUT = "C:/Users/user/OneDrive - SAMAYA INVESTMENT/Samaya/Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 2/Odoo BOM/Photos";
for (const v of (await call("list_views", {})).views.filter((v) => /^PHOTO /.test(v.name) && process.argv.slice(2).includes(v.name.slice(6)))) {
  await call("set_view_display", { view_id: v.id, style: "ShadingWithEdges" }).catch(() => call("set_view_display", { view_id: v.id, style: "Shaded" }));
  const im = await call("export_view_image", { view_id: v.id, pixel_size: 1600 });
  fs.writeFileSync(`${OUT}/${v.name.slice(6)}.png`, Buffer.from(im.data_base64, "base64")); console.log(v.name);
}
