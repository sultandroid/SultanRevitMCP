# Project setup and stakeholders

## Always ask before starting a project or sheet set

Ask for anything not already given. Do not guess and do not leave Revit placeholders ("Owner", "Project Name", "0001", "Designer").

| Item | Goes to |
|---|---|
| Client name | Project Information: Client Name |
| Project name | Project Information: Project Name |
| Project number | Project Information: Project Number |
| Project location or branch | Project Information: Address, if used |
| Consultant | CONSULTANT panel |
| Issue date | Project Information: Project Issue Date |
| Designer on this project | Designed By |
| Approver on this project | Approved By |
| Current revision and its purpose | Revisions, see `revisions.md` |
| Sheet size, if not A1 | Title block choice |

## Stakeholders

| Name | Role | Default on sheets |
|---|---|---|
| Mohamed Sultan | Checker, sometimes designer | **Always Checked By.** Sometimes also Designed By, confirm per project. |
| Raouf Aldeeb | Production Manager | Production stakeholder. Sheet field not yet defined. |

Add other people here as the user names them. Spell names exactly as listed.

Not yet confirmed by the user:

- Who normally signs Approved By.
- Who normally signs Designed By when it is not Mohamed Sultan.
- Whether Raouf Aldeeb signs a field on the sheet.

Ask on the next project, then record the answer here.

## Getting project data from Odoo

Samaya's Odoo holds the project code, name and client: `https://erp.samayainvest.com`. Read them with `tools/odoo_project.mjs` instead of asking, then ask only for what is missing. Odoo does not hold the consultant or the sheet sign-off.

- Ask the user for the login and API key each time. Pass them as environment variables. Never save a key in a file or in this repository.
- Search by project code. A name search also finds sister projects, such as Knowledge Economic City stores 1, 2 and 3.
- Odoo names read `<project name> - <client short name> - <code>`.

| Odoo | Revit Project Information |
|---|---|
| Customer | Client Name |
| Project name, without client and code | Project Name |
| Code at the end of the name | Project Number |

The label parameters take Arabic text. Render the sheet to check it.
