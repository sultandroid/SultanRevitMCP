# Project setup and stakeholders

## Always ask before starting a project or sheet set

Ask for anything not already given. Do not guess and do not leave Revit placeholders ("Owner", "Project Name", "0001", "Designer").

| Item | Goes to |
|---|---|
| Client name | Project Information: Client Name |
| Project name | Project Information: Project Name |
| Project number | Project Information: Project Number |
| Project location or branch | Project Information: Project Address, shown on the title block under the project name. Knowledge Economic City shops (Madina 1, Madina 2, Makkah, Qahwatina): "Knowledge Economic City (KEC), Madinah". KEC is also the landlord. |
| Consultant | CONSULTANT panel |
| Issue date | Project Information: Project Issue Date |
| Designer on this project | Designed By |
| Approver on this project | Approved By |
| Current revision and its purpose | Revisions, see `revisions.md` |
| Sheet size, if not A1 | Title block choice |
| Site-measured clear height and slab soffit | `Clear Height` level; check the design fits before detailing |

## Stakeholders

| Name | Role | Default on sheets |
|---|---|---|
| Mohamed Sultan | Checker, sometimes designer | **Always Checked By.** Sometimes also Designed By, confirm per project. |
| Raouf Aldeeb | Production Manager | Production stakeholder. Sheet field not yet defined. |
| Anas Matter | Client side (Hadaya Teiba) | Approved By on HT-KEC-MAD01 only, as that client's engineer. Not a default approver. |
| Lorch | Drafter | Drawn By (Madina 1, DAS). |
| Tarek | Designer | Designed By on DAS. |

**Approved By is the client's engineer on each project** (user, 5 Nov 2026). Leave it blank until the client names their engineer; never fill it from another project.
| Insignia | External designer | Designed By on HT-KEC-MAD01. Confirm on other projects. |

Add other people here as the user names them. Spell names exactly as listed.

Not yet confirmed by the user:

- Whether Anas Matter approves all projects.
- Whether Insignia designs other projects, and who signs Designed By otherwise.
- Whether Raouf Aldeeb signs a field on the sheet.

Ask on the next project, then record the answer here.

Designed By, Checked By and Approved By are per-sheet parameters, so set them on every new sheet.

## Getting project data from Odoo

Samaya's Odoo holds the project code, name and client: `https://samayainv.odoo.com` (also reachable at erp.samayainvest.com). Read them with `tools/odoo_project.mjs` instead of asking, then ask only for what is missing. Odoo does not hold the consultant or the sheet sign-off.

- Ask the user for the login and API key each time. Pass them as environment variables. Never save a key in a file or in this repository.
- Search by project code. A name search also finds sister projects, such as Knowledge Economic City stores 1, 2 and 3.
- Odoo names read `<project name> - <client short name> - <code>`.

| Odoo | Revit Project Information |
|---|---|
| Customer | Client Name |
| Project name, without client and code | Project Name |
| Code at the end of the name | Project Number |

The label parameters take Arabic text. Render the sheet to check it.

**Project files from an Odoo task** (offers, award letter, specifications): `node tools/odoo_task_files.mjs <access file> <task id> <out dir>` downloads every attachment of the task through the API and checks each file size (KAC task 3594 -> `00_Source_DocumentsOdoo Task 3594 - Offers and Award`). The key is read from the user-supplied access file and never printed or saved. The task id is the number after `/tasks/` in the Odoo link.

**Client name and logo:** take both from the client's official website, never a logo aggregator. A site logo is often white for a dark header: make a print version (dark on opaque white) from the site's own SVG and save it as `RfaTitle Blockslogo-client.png`, keeping the originals in `client-logo-source`. KAC: مؤسسة الملك عبدالله الإنسانية / King Abdullah Humanitarian Foundation (kahf.org.sa).
