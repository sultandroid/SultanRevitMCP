# Drawing and BIM standards

Samaya Factory work follows the ISO drawing and information standards below. Where a project's employer or consultant sets different requirements, theirs win: ask.

This is a working summary, not the text of the standards. Editions change, so check the current edition before quoting a clause number on a submission. Items marked *check* have not been confirmed against the standard.

## Standards map

| Topic | Standard |
|---|---|
| Lines | ISO 128-2 |
| Views, sections, cuts | ISO 128-3 |
| Projection methods | ISO 5456 |
| Dimensioning | ISO 129-1 |
| Sheet sizes and layout | ISO 5457 |
| Title block | ISO 7200 |
| Scales | ISO 5455 |
| Lettering | ISO 3098 |
| Electrical symbols | IEC 60617 |
| Safety signs | ISO 7010 |
| Information management | ISO 19650 parts 1 to 6 |
| Open model exchange | ISO 16739-1 (IFC) |
| Level of information need | ISO 7817 *check* |
| Construction classification | ISO 12006-2 |
| CAD layers | ISO 13567 |

## ISO 128 on sheets

- **Black on white.** Drawings do not rely on colour to carry meaning. Use line type, line weight and hatching. Technical sheets, including MEP, use hidden line views, not shaded ones. The exceptions are 3D and exploded views on fabrication sheets, which are for understanding, not measuring. The user asked for them shaded.
- **Line widths** come from one series with a ratio of about 1 to 1.4: 0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4, 2.0 mm. Use a thick to thin ratio of at least 2 to 1 on a sheet.
- **Line types and meaning:**
  - Continuous thick: cut outlines and visible edges.
  - Continuous thin: dimension lines, leaders, hatching.
  - Dashed: hidden edges, door swings, concealed services.
  - Long dash dot thin: centre lines, grid lines.
  - Long dash dot with thick ends: cutting planes.
- **Hatching:** thin lines, normally at 45 degrees. Neighbouring parts run opposite ways or at different spacing. See `material-hatching.md`.
- **Sections:** a cutting plane with its reference at each end, and a matching section title on the view.
- **Same scale, projected views:** front, plan and side line up. See the layout guide in `views-and-sheets.md`.
- **Lettering:** one upright sans serif font, with no overlap on lines or other text. Minimum printed height is 2.5 mm; our sheet standard uses 5 mm.
- **Dimensions** in mm without the unit, with one consistent style and terminator. Do not repeat a dimension without reason.

## Electrical symbols

Use IEC 60617 symbols, never invented marks: luminaire as a circle with a cross, socket outlet as a semicircle with a stub, earth contact with a bar. Show a graphic symbol legend on every electrical sheet. Check any project-specific symbol against the CAD legend and the published standard before issue.

## Circuit colours

Circuit layouts are the exception to black only: colour lines by phase using IEC 60445 conductor colours, L1 brown, L2 black, L3 grey, neutral blue, earth green and yellow. Line type shows the system. Label each circuit with its number, phase and system, and show the key in the legend. No ISO standard assigns colours by circuit type.

## ISO 19650 on projects

- **Common data environment:** information moves through work in progress, shared, published and archived.
- **Status and revision:** each issued container carries a suitability status and a revision. Typical codes: S0 work in progress, S1 coordination, S2 information, S3 review and comment, S4 stage approval, A published. These come from national annex guidance, such as the UK's, so confirm the set on each project.
- **File naming:** fields separated by hyphens: project, originator, volume or system, level, type, role, number. Status and revision can be in the name or held as metadata, depending on the annex. Agree this in the project's information standard.
- **Discipline models:** separate files by discipline, linked and not merged. Each discipline owns its model.
- **Level of information need:** define for each deliverable the geometry, data and documents required. Do not model more than that.
- **Responsibility:** every element and sheet has an owner, and sign-off is recorded.

Today's Madina 1 sheet numbers, such as `MD1-ID-GF-131`, are a project convention and not a full ISO 19650 name. Agree the naming before applying it to an existing project, and do not rename sheets without the user's approval.

## IFC

- Export with the agreed IFC version and model view, and record them on the transmittal.
- Every element needs the correct IFC class. Check the mapping for custom families, because direct shapes and generic models export with weak classes. Casework, lights and electrical items should map to their real classes.
- Materials, levels and property sets must be correct before export. Use `Pset_` properties where they apply and keep the same marks and names in the model and schedules.
- Check an export in a separate viewer before sending it.
- IFC is the exchange file. The native Revit model stays the source.

## Check before issue

1. Lines, hatches and text follow the rules above, with no colour carrying meaning on technical sheets.
2. Status, revision and sign-off are filled in.
3. Sheet and file names follow the project's agreed format.
4. The key plan is correct.
5. Quantities agree with the model.
6. Assumptions are labelled, and nothing unverified is presented as measured.

## Sources

- ISO 128-3 scope: https://www.iso.org/standard/69130.html
- BSI on the ISO 128 revision: https://www.bsigroup.com/en-VN/blog/manufacturing-blog/when-six-became-one--in-the-presentation-of-lines
- UK national annex guidance: https://www.cdbb.cam.ac.uk/files/national_annex_guidance.pdf
- Status codes: https://help.autodesk.com/cloudhelp/ENU/Docs-Files/files/file-naming-standard/Status_Codes.html
