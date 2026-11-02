# Title blocks

Families are in `title-blocks/` at the repository root.

| File | Sheet |
|---|---|
| `Samaya Factory A1.rfa` | A1, 1192 x 841 mm |
| `samaya-factory-logo-black.png` | Black logo on white, used in the family |
| `samaya-factory-logo-white.png` | White logo with transparent background, source artwork |

Only A1 exists. Other sizes are still to be made.

## Style

**No filled backgrounds.** Black text and thin black lines on white, like an AutoCAD drawing. The user rejected coloured bands.

## A1 layout

Strip on the right, x 1022 to 1182, from top to bottom: logo, CLIENT, CONSULTANT, NOTES, KEY PLAN, REVISIONS, PROJECT, DRAWING TITLE, DRAWING NO. and REV, SCALE and DATE, DESIGNED BY and CHECKED BY, APPROVED BY and PROJECT NO., disclaimer, samaya-factory.com.

`tools/tb_build.mjs` is the build script. It uses `build_title_block` and its paths point at the Madina 1 project, so change them before reuse.

## Logos

The title block carries the client, designer and consultant logos as well as Samaya Factory's. Each has a panel under the Samaya Factory logo: name on the left, logo on the right. Take logos only from sources the user names, on opaque white, as the project's Rfa/Title Blocks/logo-client, logo-consultant and logo-designer.png files; they are project data and stay out of this repository's family defaults.

**A text note and a label cannot share a size and weight in build_title_block**: it fails with "The type typeId is not valid". Use a slightly different size for the text.

## Consultant

The CONSULTANT panel has no label. Add the name as a text note on each sheet, at x 1027, y 672, not in the family. The name comes from the project.

## Lessons

- **White shows as black.** Revit draws pure white 255,255,255 as black.
- **Do not put a transparent PNG on a filled region.** The white logo did not show over the navy band, and Revit gave no error. Use an opaque image that carries its own background and leave out the region behind it.
- **Use real lines, not thin regions.** Bands under about 1 mm stop with "Curve length is too small". Use `lines` in `build_title_block`.
- **Rebuilding drops the revision schedule.** It lives in the family, so after `build_title_block` run `add_titleblock_revision_schedule` again.
- **Reloading is safe.** `build_title_block` over an existing family updates sheets already using it, and the type id stays the same.
- **Schedule title.** The schedule shows "Revision Schedule 2" above its columns. Clear it by hand in the family: schedule Appearance, untick Show Title.
- **Sheets open in Revit cannot be deleted.** `delete_elements` fails on the active view.
