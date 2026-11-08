# Working with SultanRevitMCP

This skill lives in the SultanRevitMCP repository (`skills/technical-drafting-ksa/`) next to `samaya-revit`. Use it together with that skill: `samaya-revit` owns Revit modelling, sheets, title blocks and Samaya house rules; this skill owns AutoCAD/DWG/DXF drafting, Saudi standards and release checks.

## House Standards First

On Samaya Factory work, read `standards/sultan-standards.json` (through `tools/standards.mjs`) before choosing line widths, text types, fonts, scales or sheet numbers. It already follows ISO 128, 129, 3098, 5455, 5457 and 7200 and sets:

- Fonts: Arial for Latin text, Cairo for Arabic (Tahoma when Cairo is not installed).
- Text types, minimum printed height, line styles and weights, dimension style, scales by content, sheet grid and numbering.

Where `ksa-drafting.md` gives a default and the house file gives a value, use the house value. Where the project's consultant or employer sets something else, theirs wins.

## Bridge Tools for the KSA Gates

Use only tools the running bridge actually exposes; check the tool list first. Typical mapping:

| Gate or task | SultanRevitMCP tool |
|---|---|
| Bring a DWG into Revit for setting-out or checking | `import_cad`, then `inspect_link` / `get_view_geometry` to read it back |
| Link the architectural or structural model as the source | `link_revit_model`, `inspect_link`, `acquire_coordinates` |
| Title block from the project template | `build_title_block`, `list_family_text`, `set_family_text`, `set_family_text_size` |
| Bilingual text and notes | `ensure_text_type` (Cairo/Tahoma for Arabic), `create_text_note`, `create_text_notes` |
| Line hierarchy | `ensure_line_style`, `create_detail_lines`, `set_view_display` |
| Dimensions from datums | `create_dimension_string` |
| Sheets, views and revisions | `create_sheet`, `place_view_on_sheet`, `create_drafting_view`, `create_revision`, `set_sheet_revisions` |
| Plot and scale truth | `export_sheets_pdf`, then check the PDF page size and scale against the title block |
| Visual check | `export_view_image` |

Every mutation through the bridge follows the mutation gates in `SKILL.md`: check the active document, read back the result, and stop on an unexplained difference.

## AutoCAD Helper Scripts (in the repository's `tools/`)

- `acad_check.ps1 -Files <dxf/dwg>`: opens each file in AutoCAD core console and reports polylines (and how many are closed), circles, lines, texts and extents. Use it as the read-back step after writing a DXF.
- `clean_sheet_dwg.ps1 -Files <dwg>`: audit, purge, overkill and join for Revit sheet DWGs before they go to the workshop; reports counts before and after.
- `acad_solids_check.ps1`: solid checks for 3D DWG output.
- `cnc_dxf.mjs`, `fab_sheet.mjs`: fabrication DXF and sheet builders; run their output through `acad_check.ps1`.

These scripts expect AutoCAD 2026 at `C:\Program Files\Autodesk\AutoCAD 2026\accoreconsole.exe`. Check the path first and report if it is missing.

## SBC Code Library

`knowledge/codes/` holds the clause index and our own notes for the SBC parts we design to (so far `sbc-301-2018`). Search it before quoting a clause:

```bash
cd tools/code_rag && node search.mjs "guard horizontal load" --code sbc-301
```

The code text itself is copyright and stays only on the user's machine; never commit or upload it. When a check in `ksa-building-code.md` needs a clause, add a note line to the matching `notes.jsonl` after reading the clause, as `knowledge/codes/README.md` describes.

## AutoCAD to Revit Handover

1. Draft or clean the DWG to this skill's rules (layers, mm units, one datum, Arabic in TrueType MTEXT).
2. Run `acad_check.ps1` and keep the report.
3. Import or link it through the bridge, read it back, and check grid and level alignment against the Revit model.
4. Place it on sheets with the project title block, export the PDF, and check scale and Arabic text in the PDF.
5. Record the round in a JSON report (`scripts/build_release_manifest.py`).
