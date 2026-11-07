# Madina 1 (HT-KEC-MAD01)

تنفيذ متجر مدينة المعرفة 1 (ستايل مديني). A shop fit-out in the Knowledge Economic City (KEC) mall, Madinah. The client is شركة هدايا طيبة, the designer is Insignia Design Group, and the builder is Samaya Factory. All project data is in [project.json](project.json): models, levels, colours, revisions, sheets and open items.

## Where it is on OneDrive

All paths are under `OneDrive - SAMAYA INVESTMENT/Samaya/`.

| What | Folder |
|---|---|
| Project folder | `Technical Office/Bim Unit/Knowledge Econmic City_ShopFit projects/Madina 1` |
| Revit models | `.../Madina 1/Revit Files/Rvt` (ARCH, MECH, ELEC, FIN EXISTING MODEL) |
| Designer files | `.../Madina 1/Design Files` (rev-01, rev-02) |
| BOQ | `.../Madina 1/B.O.Q` |
| Order folder | `Orders/2026/038 متجر المدينة 1` |
| Fabrication package | `Orders/2026/038 متجر المدينة 1/Final Fabrications Drawings` |

## Main decisions

- **Keel arch** on all arch units, replacing the five-centred arch (Rev 04).
- **Ceiling:** C01 gypsum at +3.07 with one 200 mm step up to the C02 tray at +3.27. Grilles are 150 mm and duct HV-SD2 went up 60 mm. The mechanical engineer confirmed (Rev 05).
- **Shadow gap:** joinery stops at least 20 mm under the ceiling (factory standard).
- **Strip cladding** is its own item, fitted after the units (A-2501, A-2502).
- **Skirting:** 50 mm black softwood, set back 50 mm, on all base units, the niche cabinets included.
- **Colours** (Rev 06): EGGER H1113 oak, U775 carcasses and F186 base cabinet doors. The black RAL and the cladding grey are still to confirm.

## Fabrication package

`Orders/2026/038 متجر المدينة 1/Final Fabrications Drawings`, Rev 06. The factory set covers wood and metal work only, 26 sheets:

- PDFs
- clean DWGs
- a carpentry 3D model in ACIS solids
- a CNC DXF for each curved or holed part, with CSV cut lists
- the approved colour swatches

The CNC scripts are in [scripts/cnc](scripts/cnc).

# Madina 1 scripts (snapshot)

Working scripts for Madina 1 (Knowledge Economic City), copied from the session on 3 Nov 2026. They run against the RevitMcp bridge with `rvt.mjs` from `tools/`, from a folder that also holds a `dwg/` data folder (logs and ids).

| Script | Does |
|---|---|
| `m_keel.mjs opt1\|opt2 typ\|exp` | Rebuilds the typical arch and its exploded copy as a keel arch, in place, under the same family name |
| `k_strips.mjs` | Strip cladding, backing and closure, cut round the keel arches |
| `j_gen.mjs <key>` | Fabrication sheet per unit type (front, side, sections, top, details, 3D, exploded) |
| `arr_units.mjs <no>` | Arrangement sheets per item, with size tables |
| `j_m.mjs`, `k_det.mjs` | Marble details A-2106, strip cladding details A-2501 |
| `kpmark.mjs`, `sheetno.mjs`, `fit3d.mjs`, `shelf_vol.mjs`, `m1_rev.mjs` | Key plan marks, ISO sheet numbers, 3D fit, shelf volumes, revision 04 |

**Regenerating sheets keeps later revisions:** set `REV_EXTRA=<revision ids>`. Without it, a regenerated sheet carries only the base revision.

The full rework into general tools is due at the end of Madina 1.
