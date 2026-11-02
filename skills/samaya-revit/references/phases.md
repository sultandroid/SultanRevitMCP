# Phases

**Always use phases on Samaya Factory work.** Every element and every view has a phase. Do not show existing or demolished work by manual overrides alone.

## Standard phases

| Phase | Use |
|---|---|
| Existing | What is on site before our work |
| New Construction | Everything we build, and what we demolish |

Keep to these two unless the job really has stages. Extra phases complicate coordination and schedules. Demolition is not its own phase: it is the first activity of New Construction, and Revit's filters assume this. Temporary work gets a Temporary phase between the two, and is demolished in New Construction.

## Elements

- Existing element: Phase Created = Existing.
- New element: Phase Created = New Construction.
- Removed existing element: Phase Created = Existing, Phase Demolished = New Construction. Do not delete it.

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

No command creates phases or edits their graphic overrides, so the user does those in Revit, or add a command. Element and view phases can be set with `set_parameter`: Phase Created, Phase Demolished, Phase, Phase Filter. Check values and render the view.

## Sources

- [Autodesk Revit help](https://help.autodesk.com/view/RVT/2026/ENU/)
- [The CAD Masters: phasing](https://thecadmasters.com/revit-phasing-demolition-new-construction/)
- [Novedge: phasing for renovation](https://novedge.com/blogs/design-news/revit-tip-revit-phasing-best-practices-for-renovation-documentation)
- [Novedge: phase filters](https://novedge.com/blogs/design-news/revit-tip-revit-phase-filters-for-clear-renovation-and-demolition-documentation)
- [Arkance: phasing guidelines](https://emea.support.arkance.world/hc/lb/articles/36463461995026-Revit-Architecture-2013-Guidelines-on-Phasing)

These are mostly vendor guides. Check behaviour in the model.
