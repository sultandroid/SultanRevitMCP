# Pipeline (copy from the side table)

Copy `indora-furniture/revit/sample-side-table/` to the new piece's folder and change the data, not the method.

| File | What it does | Change for a new piece |
|---|---|---|
| `parts.mjs` | One list: parts (solids or `pieces` to fuse), assembly `STEPS` + `STEPS_AR`, `JUNCTIONS`. Helpers `box`, `ring`, `mring` (mitred frame), `trayRails` (one-piece rebated mitred rails), `xz`/`yz` boards on edge, `xzM`/`yzM` mitred trims | All geometry and texts |
| `materials.mjs` | Material names (with "to confirm" until approved), colours, cut hatches | Names and colours |
| `build_model.mjs` | New project from `template/Samaya Factory.rte`, loads the client title blocks, project info, one direct shape per piece (fused), `make_unit_family` (Casework), ray-probe and move to the true place; glass as its own family | Project data, probe points |
| `prep_sheet.mjs` | Second instance (QTY), template clean-up, a 3D view for probes, revision 01, writes `fab_config.json` (bilingual note, `noteTail`, `keynotes3d`, `placementAxes`, `location: false`, `details: false`, `scale: 5`) | Unit note text, marks |
| `fab_sheet.mjs` (SultanRevitMCP tool) | Sheet 2101: views, dimensions, legend, quantities, notes, key plan, numbered 3D | Nothing |
| `finish_sheet.mjs` | 2101 finishing: designer set-out dimensions, arrangement on the grid, crop borders off, glass see-through, coloured 3D with overall sizes, reference render, INPUT REQUIRED, title block extras | Set-out points, questions |
| `exploded.mjs` | Sheet 2102: parts pulled apart (two shaded views), number columns, parts list and steps, coloured 3D | Nothing (reads `parts.mjs`) |
| `junctions.mjs` | Sheet 2103: one 1:1 section per junction (`kind: "section"` looks +y, `"secx"` looks +x), dimensions, screws as lines, bilingual labels | The junction list |
| `finishes.mjs` | Sheet 2104: finishes table with photos, notes, red questions, coloured 3D | The finish rows |
| `product3d.mjs` | Clean coloured 3D for any sheet: `dir` (angle), `margin` | Box of the piece |
| `tb_extras.mjs` | Designer name and logo, Arabic project name | Names, logo file |
| `render_sheet.mjs` | Renders each sheet to `check-NNNN.png` (read them) | Sheet numbers |

Run order: `build_model` (only when parts change) -> `prep_sheet` -> `exploded` -> `fab_sheet.mjs fab_config.json ST` -> `finish_sheet` -> `junctions` -> `finishes` -> `render_sheet` -> export PDF with `export_sheets_pdf`.

Title blocks for a new client factory: `node tools/brand_title_blocks.mjs <brand.json>` (logo laid out wide, about 2.75 : 1, opaque white). The revision table lives in the `.rvt`, not the `.rfa`; `finish_sheet.mjs` adds it.
