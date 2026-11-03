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
