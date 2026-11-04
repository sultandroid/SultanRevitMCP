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

## ISO 5457 frame

Filing margin 20 mm on the left, 10 mm elsewhere, centring marks and lettered and numbered reference zones. Note: the family named A1 is 1192 x 841 mm, which is close to ISO A0 (1189 x 841), not A1 (841 x 594).

## Logos

The title block carries the client, designer and consultant logos as well as Samaya Factory's. Each has a panel under the Samaya Factory logo: name on the left, logo on the right. Take logos only from sources the user names, on opaque white, as the project's Rfa/Title Blocks/logo-client, logo-consultant and logo-designer.png files; they are project data and stay out of this repository's family defaults.

**A text note and a label cannot share a size and weight in build_title_block**: it fails with "The type typeId is not valid". Use a slightly different size for the text.

## Sign-off

The title block says DRAWN BY, not DESIGNED BY. Madina 1: Lorch. The designer has its own logo panel.

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

## Template files in this repo

`template/Samaya Factory.rte` and `template/Title Blocks/Samaya Factory A0..A3.rfa` (with the logo) are built by `tools/samaya_template.mjs` and copied here after each rebuild. Rebuilt and checked on 3 Nov 2026: A1 renders clean.

Known fault on A3, still open:
- The REVISIONS heading sits on the revision schedule's header row.
- The website line touches the bottom border.

The schedule text does not scale with the sheet. Fix it in the builder's A2 and A3 specs before using those sizes on an issued sheet.

## NOTES panel: fabrication notes and standards on every sheet

The user's rule (4 Nov 2026): every sheet shows, in small text:
- the factory's short general fabrication notes;
- the standards it applies.

They are printed in the title block's NOTES panel, so they are on every sheet with no extra work. The text is `sheet_notes` in `standards/sultan-standards.json`: 2.2 mm on A0 to A2, shrinking to fit on A3.
- Edit the wording there, then rebuild the title blocks with `tools/samaya_template.mjs`, and load them into each project.
- Project-specific notes stay in the sheet's own notes column.
- **The bridge cannot add a label to a family.** The Revit API has no way to create a label, and `build_title_block` only moves labels the source family already has. For a value that is the same on every sheet, use `add_family_text` (element_id of a title block instance, text, at in family mm, like_text to copy a text type, replace_text to rerun safely, save_path to write the .rfa). The Knowledge Economic City address went in this way under the project name at x 1027, y 252, in the samaya-factory.com text type (4 Nov 2026). A per-project value still needs a label added by hand in the Family Editor.

## Labels that show blank, and swapping logos (Aseer, 4 Nov 2026)

- **A label tied to a shared parameter shows blank** until the project has that parameter bound. A title block keeps such parameters as `SharedParameterElement`s, not family parameters, and loading the family brings them in **unbound**. `list_family_parameters` lists them with GUIDs under `label_shared_parameters`; `bind_shared_parameters` binds them (to OST_Sheets by default) under the same GUIDs. A name can be odd: the Aseer "Samaya Checked By" one is named `Samaya Checked By:` with a colon.
- **Built-in labels need only Project Information**: Project Name and Project Number fill from it, nothing to bind.
- **Swap a logo without rebuilding**: `list_family_images`, then `replace_family_image` (match on the type or file name). Pad the new file first, on opaque white, to the old image's width/height ratio, so the box stays the same; the command keeps centre and width.
- `set_family_text` changes a heading in place. Check the render after: a longer word can run past its cell line ("Submission Date:" did; it became "Subm. Date:").
- Do not pass `save_path` to a family command if the family should keep its name: the family takes the new file's name when it reloads.
