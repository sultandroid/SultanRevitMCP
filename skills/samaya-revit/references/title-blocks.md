# Title blocks

Families are in `title-blocks/` at the repository root.

| File | Sheet |
|---|---|
| `Samaya Factory A1.rfa` | A1, 1192 x 841 mm |
| `samaya-factory-logo-navy.png` | Logo panel used in the family, opaque |
| `samaya-factory-logo-white.png` | White logo with transparent background, source artwork |

Only A1 exists. Other sizes are still to be made.

## A1 layout

Strip on the right, x 1022 to 1182, from top to bottom: navy logo panel, CLIENT, CONSULTANT, NOTES, KEY PLAN, REVISIONS, PROJECT, DRAWING TITLE, blue DRAWING NO. and REV band, SCALE and DATE, DESIGNED BY and CHECKED BY, APPROVED BY and PROJECT NO., disclaimer, navy samaya-factory.com strip.

Colours: navy 15,47,82. Blue 30,90,158. Rules 184,199,214. Ink 25,35,45. Near-white 254,254,254.

`tools/tb_build.mjs` is the build script. It uses `build_title_block` and its paths point at the Madina 1 project, so change them before reuse.

## Lessons

- **White shows as black.** Revit draws pure white 255,255,255 as black. Use 254,254,254 for text on dark bands.
- **Do not put a transparent PNG on a filled region.** The white logo did not show over the navy band, and Revit gave no error. Use an opaque image that carries its own background and leave out the region behind it.
- **Thin regions fail.** Bands under about 1 mm stop with "Curve length is too small". Use at least 0.9 mm.
- **Rebuilding drops the revision schedule.** It lives in the family, so after `build_title_block` run `add_titleblock_revision_schedule` again.
- **Reloading is safe.** `build_title_block` over an existing family updates sheets already using it, and the type id stays the same.
- **Schedule title.** The schedule shows "Revision Schedule 2" above its columns. Clear it by hand in the family: schedule Appearance, untick Show Title.
- **Sheets open in Revit cannot be deleted.** `delete_elements` fails on the active view.
