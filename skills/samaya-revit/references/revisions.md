# Revision system

**Always use Revit revisions on our work.** Sheet Issues/Revisions is the only record of what was issued. Never type a revision into a title block by hand.

## Confirmed

- Project folders and source files carry the revision, such as `Rev-01`, `rev-02` and `elmadina-rev02.dwg`.
- Every title block has a REV field for the current revision and a REVISIONS panel listing the history (REV, DESCRIPTION, DATE).
- Use the latest revision of a source drawing unless the user says otherwise, and record which file each element came from.

## Proposed, to confirm with the user

- Numbering is two digits matching the folders: 01, 02, 03. Revit's Numeric sequence with a minimum of 2 digits does this. What the first issue is called is not confirmed.
- Numbering is Per Project, so one revision has one number on every sheet.
- Sheets take a revision only when they changed. The REV field then differs between sheets, and the drawing index shows each sheet's current one.

## Procedure

1. Ask what the issue is for and its date, if not given.
2. Add the revision with `create_revision` or in Sheet Issues/Revisions, with date, description, Issued To and Issued By.
3. Draw revision clouds in the view that changed, so they follow the view onto the sheet. Use a cloud on the sheet only for sheet notes. Tag each cloud.
4. Assign the revision to changed sheets. A sheet with a cloud gets it automatically. Use `set_sheet_revisions` for changes without a cloud.
5. Render one changed sheet, and confirm the REV field and the REVISIONS panel.
6. Mohamed Sultan checks, the approver signs, and then mark the revision **Issued**. This locks its record.
7. Save the file as issued, with the issued PDF in the project's revision folder.

## Rules

- Decide Per Project or Per Sheet before the first cloud. Changing it later can renumber clouds, including issued ones.
- Never edit or delete an issued revision. Make a new one.
- Clouds of earlier revisions stay or hide according to Show in the revision settings. Agree this per project, and keep the history in the schedule either way.
- The REV field and schedule are empty until a revision is on the sheet. This is normal.
- A new project already holds a default Revision 1, which takes the first number. To issue as Rev 03, use `set_revision_numbering` with start 2, then check the REV field on a rendered sheet.
- In a model saved as a copy (an option file), `create_revision` can come out as "1" instead of the next number. Run `set_revision_numbering` with start 2 and min 2 digits, then read each revision's number back (Madina 1 Keel Option 2, 4 Nov 2026).
- The title block DATE reads Project Information "Project Issue Date", not the sheet's Sheet Issue Date. Update it with each issue.
- If the client or project sets ISO 19650 codes, such as S2 with P01, or C01 for construction, use those. They vary between organisations, so take them from the project's requirements.

## Sources

- [Autodesk: revision cloud numbering](https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-182323BA-8A69-4167-AD92-573079BA9D09.htm)
- [Autodesk: custom revision numbering](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-HaveYouTried/files/GUID-97114780-F7A1-4685-BDDB-6C409F5624C0.htm)
- [Novedge: revision workflow](https://novedge.com/blogs/design-news/revit-tip-revit-revision-workflow-numbering-clouds-and-schedules)
- [Novedge: standard revision workflow](https://novedge.com/blogs/design-news/revit-tip-standardize-revit-revision-workflow)
- [Autodesk Docs: status codes](https://help.autodesk.com/cloudhelp/ENU/Docs-Files/files/file-naming-standard/Status_Codes.html)
- [Autodesk Docs: revision codes](https://help.autodesk.com/cloudhelp/ENU/Docs-Files/files/file-naming-standard/Revision_Codes.html)

## Default revision in a new project (Aseer, 4 Nov 2026)

- KAC (5 Nov 2026): the default revision’s Description and Date are read-only through `set_parameter`, and `set_sheet_revisions` with it failed. Make a new revision with `create_revision`, delete the default one, then `set_revision_numbering` start 1, min 2 digits: REV reads 01.

- **A project made from the template already holds "Revision 1" (Date 1).** A new revision then numbers second (01, not 00) even on a sequence starting at 0. `list_revisions` now lists every revision (id, sequence, number, date, description, issued, numbering sequence); delete the default one if it is on no sheet, then check the number reads as intended.
- `set_revision_numbering` applies the new sequence to the revisions that exist when it runs; a revision made after it needs `set_revision_sequence`.
