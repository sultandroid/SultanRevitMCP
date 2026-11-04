# BIM standards map

The standards that govern BIM and Revit work, by tier, most important for our work first (the user's list, 4 Nov 2026). The full list, with what we do about each one today, is `bim_standards` in `standards/sultan-standards.json`.

Editions are as given in that list. Confirm the current edition before quoting one on a deliverable.

## 1. Information management: ISO 19650 (the backbone)

- **Parts 1 and 2:** concepts (EIR, BEP, CDE, MIDP/TIDP) and the delivery phase.
- **Parts 3 to 6:** operation, information exchange, security, and health and safety.
- They replace BS 1192:2007 and PAS 1192-2/3/4. Do not cite those.
- **We do:** ISO 19650 container names for sheets, Revit revisions, private storage.
- **Gaps:** no BEP, no EIR response, no CDE states (WIP, Shared, Published, Archived), no MIDP/TIDP.

## 2. Level of information need

- ISO 7817-1:2024 replaces the old LOD idea. Before it came EN 17412-1, BIMForum LOD 2023 and AIA G202/E202.
- **We do:** model joinery at fabrication level (about LOD 400).
- **Gap:** we do not yet state the level of information need per item. Write it into each project's BEP: geometry, information and documentation.

## 3. Open data (buildingSMART and ISO)

- IFC 4.3 (ISO 16739-1:2024), classification (ISO 12006-2/-3), IDM (ISO 29481), properties and data templates (ISO 23386, 23387), and COBie.
- buildingSMART: IDS, bSDD and BCF.
- **We do:** IFC export on request.
- **Next steps that fit us:**
  - BCF for clash issues: our coordination findings become BCF topics.
  - IDS to check models automatically before issue.

## 4. Drawing and output (our daily work)

- ISO 7200 (title block fields), ISO 5457 (sheets), ISO 128 (lines and views), ISO 3098-1 (lettering), ISO 13567 (CAD layers).
- **We do:** all of these, through the template and `sultan-standards.json`. See `drawing-and-bim-standards.md`.

## 5. Regional and support

- BS 8536-1 (handover for operation), BS 8541 (object libraries), BS ISO 55000 (assets), NBIMS-US V4, and the Qatar, Dubai and Abu Dhabi BIM standards.
- **For Saudi projects:** ask the client or consultant for its BIM requirements; theirs win.

## Rule

When a client sets an EIR, BEP or standard, it overrides ours. Put it in the project config, not in `sultan-standards.json`.

## Tools that close two gaps (4 Nov 2026)

- **BEP:** `node tools/bep.mjs projects/<project>/project.json <out.html>` builds the factory BIM Execution Plan (ISO 19650-2) from the project data and `sultan-standards.json`. Print it to PDF with Edge headless.
  - Sections: project, roles, standards with how we apply them, models and federation, naming, level of information need (ISO 7817) per item, CDE states, coordination, checks before issue, MIDP series, software and security.
  - First one: `Makkah/Docs/BEP/Makkah BEP (draft).pdf`.
  - Every new project gets a `projects/<project>/project.json` and a BEP before modelling.
- **BCF:** `node tools/bcf.mjs issues.json out.bcfzip` writes coordination issues as BCF 2.1: title, type, status, priority, labels, assignee, the elements by IfcGUID, a camera, and an optional snapshot.
  - Read IfcGUIDs from each element's `IfcGUID` parameter.
  - Every clash or clearance under the flag (80 mm) found in coordination goes into it, beside the Z-series sheets.
