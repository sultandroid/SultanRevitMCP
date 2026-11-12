---
name: samaya-structural-calc
description: Samaya Factory structural calculation reports (calc notes) for steel frames, hoardings, showcases and fixings, analysed in Robot. Use whenever the user asks for a structural calculation, Robot calculation, structural check report or calc note, even if they only say "make the report" or "send me the Robot report".
---
# Samaya structural calculation report

Owner rule (Mohamed Sultan, 12 Nov 2026, after a wrong report): a structural report is NEVER Robot's raw "Data"/"Results"
export. Robot's report templates carry the cover of an old job (King Abdullah site hoarding) and imperial units. Always build
the Samaya calc note.

## Steps
1. Model and solve in Robot from a script (`projects/<job>/steel/*_robot.ps1` pattern; `$app.Interactive = 0`, no dialogs).
   Check equilibrium first: sum of dead reactions = self-weight + applied dead loads. A wrong section (zero or wrong unit weight)
   shows up as huge reactions.
2. Member checks to the code the user names (Saudi jobs: SBC 301 loads, SBC 306 / AISC 360-16 LRFD steel only).
   Compression members: use the real braced length (between posts, between screws), not the analysis bar length.
3. Figures: `tools/robot/robot_views.ps1` captures; LOOK at every picture before using it (captures can shift by one).
4. Spec JSON -> `tools/calc_note/build_calc_note.mjs` -> `tools/calc_note/docx_to_pdf.ps1`.
5. Read the PDF pages before sending.

## Content and order (style guide `samaya-doc-style-guide/projects/factory-technical`, section 10, plus owner additions)
- Cover: Samaya Factory logo (`samaya-doc-style-guide/assets/logos/samaya-factory-logo.png`), title, subject, project Arabic + English,
  project no., CLIENT + the client logo from the job's title-block folder (`Revit Files/Rfa/Title Blocks/logo-client.png`), never a
  guessed client name; control table; Robot logo.
- Document control: revision history, sign-off, contents.
- 1 EXECUTIVE SUMMARY (first section): key results table (highest ratio, deflections, stability, total floor load) and a
  "codes, loads and combinations at a glance" table, then numbered conclusions.
- 2 Design basis: codes table, materials table, load case table (value, where applied, source clause), load combination table.
- 3 Analysis: model summary, equilibrium, Robot figures, reaction table.
- 4 Member checks: one table, demand, KL/r, ratio, OK / FAILS, clause.
- 5 Serviceability and stability. 6 Conclusions.
- Robot's own output is a separate document number (CA-S-0002) with the same header and logo, never the main report.
- No cost or saving content; no "ASSUMED" / open items wording; tables never split.
