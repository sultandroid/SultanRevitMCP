# Phases

**Always use phases on Samaya Factory work.** Every element and every view has a phase. Do not show existing or demolished work by manual overrides alone.

## Standard phases

| Phase | Use |
|---|---|
| Existing | What is on site before our work |
| New Construction | Everything we build, and what we demolish |

Keep to these two unless the job really has stages. Extra phases complicate coordination and schedules. Demolition is not its own phase: it is the first activity of New Construction, and Revit's filters assume this. Temporary work gets a Temporary phase between the two, and is demolished in New Construction.

## Who owns existing elements

- **Each discipline file owns its own existing elements.** Existing ducts and fan coils go in MECH, existing sockets in ELEC, existing sprinklers in the fire file, all on phase Existing.
- **The EXT model holds the building shell only:** slab, walls, columns, beams, openings, ceilings. Every element in EXT is on phase Existing. Run `phase_audit.mjs --ext` to check.
- Never model existing services in EXT and again in the discipline file.

## Elements

- Existing element: Phase Created = Existing.
- New element: Phase Created = New Construction.
- Removed existing element: Phase Created = Existing, Phase Demolished = New Construction. Do not delete it.

## Status, source and maturity (shared parameters)

Phase says *when*. Three text parameters say the rest. They have fixed GUIDs in `sultan-standards.json` (`phases`) and are bound with `node tools/standards.mjs phase-params`.

| Parameter | Values | Rule |
|---|---|---|
| `SF_PhaseStatus` | Existing-Retain, Existing-Remove, Existing-Relocate, New, New-Relocated, Temporary | Must agree with the phases. Remove and Relocate need Phase Demolished = New Construction. |
| `SF_ExistingSource` | Survey, Site-Verified, Record-Drawing, Assumed | Every existing element records how we know it. Record-Drawing is not verified. |
| `SF_Maturity` | Reservation, Gross, Design, Fabrication, As-Built | Reservation: a space or position only, not a product. Gross: overall envelope, build-up not split. |

**Relocated items** (for example "fan coil units relocated" on RCRC CR08) are two elements:
- The old position: Existing, demolished in New Construction, status Existing-Relocate.
- The new position: New Construction, status New-Relocated, with Comments naming the original.

Do not move the existing element.

**Replaced finishes** (for example "existing carpet to be replaced") follow the same pattern:
- The old finish: Existing-Remove.
- The new finish: New.

## Audit before every issue

`node tools/phase_audit.mjs "<model.rvt>" [--ext] [--out report.json]` is read-only. It opens the model if needed, closes it again, and never saves. It reports:
- elements with no phase;
- New elements in an EXT model;
- existing elements without status or source;
- status that disagrees with the phases;
- views without a phase filter.

Fix every finding, or record it as an open issue, before a model is shared.

## Views

| View | Phase | Phase Filter |
|---|---|---|
| Existing conditions | Existing | Show Complete |
| Demolition plan | New Construction | Show Previous + Demo |
| New work plan | New Construction | Show Previous + New |
| Finished or coordination | New Construction | Show Complete |
| New only, such as shop drawings | New Construction | Show New |

Lock Phase Filter in the view template.

## Graphics

Set these once in Phasing > Graphic Overrides, not per view:

| Status | Look |
|---|---|
| Existing | **Halftone**, always |
| Demolished | Dashed, red |
| New | Solid, by object style |
| Temporary | Dashed, a distinct colour |

## Linked discipline files

- Each file uses the same phase names, so mapping is direct.
- In the link's Type Properties, check Phase Mapping: Existing to Existing, New Construction to New Construction.
- With mapping and a Show Previous + New filter, a linked existing model turns halftone through the phase override. Use `set_element_overrides` on a link instance only as a fallback, when the linked elements are not phased.
- Check that every element in the existing model has Phase Created = Existing.

## Bridge

- `list_phases` gives the phase ids.
- `set_parameter` sets Phase Created and Phase Demolished by **phase id**, not by name. The name gives "input string was not in a correct format".
- `set_phase_filter` sets a view's phase filter by name.
- No command creates phases or edits Phasing > Graphic Overrides (the API does not expose them). Set those once in the template.
- `ensure_view_filter` builds rule filters on text parameters, for example the SF_ ones.
- Check values with `phase_audit.mjs` and render the view.

## Sources

- [The CAD Masters: phasing](https://thecadmasters.com/revit-phasing-demolition-new-construction/)
- [Novedge: phasing for renovation](https://novedge.com/blogs/design-news/revit-tip-revit-phasing-best-practices-for-renovation-documentation)
- [Novedge: phase filters](https://novedge.com/blogs/design-news/revit-tip-revit-phase-filters-for-clear-renovation-and-demolition-documentation)
- [Arkance: phasing guidelines](https://emea.support.arkance.world/hc/lb/articles/36463461995026-Revit-Architecture-2013-Guidelines-on-Phasing)

These are mostly vendor guides. Check behaviour in the model.
