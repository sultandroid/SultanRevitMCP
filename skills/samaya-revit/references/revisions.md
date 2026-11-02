# Revision system

## Status

The user asked for the revision system to be part of these standards but has not yet described the company's rules. Sections marked **Proposed** are a working default, not a confirmed standard. Confirm them with the user, then remove the mark.

## Confirmed

- Client and source drawings carry the revision in the file name, for example `elmadina-rev02.dwg`.
- Every title block has a REV field for the current revision and a REVISIONS panel listing the history (REV, DESCRIPTION, DATE).
- Use the latest revision of a source drawing unless the user says otherwise, and record which file each element came from.

## Proposed

- Numbering is two digits starting at `00` for first issue: 00, 01, 02.
- Each issue is a Revit Revision with sequence, date, description and issued-by, entered through Sheet Issues/Revisions, so the title block fills itself.
- Assign revisions to sheets with `set_sheet_revisions`. Only sheets that changed take the new revision.
- Mark changes with revision clouds on the sheet.
- Before issuing: Mohamed Sultan checks, then the approver signs.

## Procedure

1. Ask what the revision is for and its date, if not given.
2. Create the revision in the project.
3. Assign it to the changed sheets only.
4. Render one changed sheet and confirm the REV field and the REVISIONS panel both show it.

## Notes

- The REV field and the schedule stay empty until a revision is assigned to the sheet. This is normal.
