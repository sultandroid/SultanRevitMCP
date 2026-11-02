# Joinery practice

Use this to detail how a unit is really built. Sizes here are normal shop practice, not project requirements. Note them as assumed until the workshop confirms them.

## Boards

- EGGER decor boards are usually 18 mm melamine faced board, commonly 2800 x 2070 mm. Check the grade, FR or MR, against the project.
- Use one piece wherever the size fits. Plan any joint on a centre line or behind a unit.
- Grain direction is set by the sheet. Keep it the same on panels that are seen together.
- Cut edges that show get matching ABS or PVC edge, 1 to 2 mm. Hidden edges still get sealed in damp locations.
- Painted work is FR MDF, sanded and sealed before paint. Prime cut edges twice, because MDF edges absorb paint.

## Cladding existing structure

Never fix a finished sheet straight onto a column or wall. It is not flat or square.

1. Survey the structure on site: size, plumb and flatness. Modelled sizes are not enough.
2. Fix FR treated battens to the structure, about 40 x 20 mm at up to 600 mm centres, using plugs and screws. Pack them with shims to one true plane.
3. Where the structure is out of line with neighbouring surfaces, pack those battens to the same plane.
4. Hang the sheet on a French cleat or panel clips, so no screw shows and it can be removed.
5. Allow 2 to 3 mm at each edge to scribe to the frame, or use a deliberate shadow gap.
6. Keep access to any services behind, and seal against damp walls.

## Fitting between units

- Fit cladding before the cabinet or trim that covers its edge.
- A modelled clash with structure means the unit must change. Report it instead of hiding it.
- Check that a sheet can get through the doors and be lifted into place. Split it if it can't.

## Modelling for shop drawings

- **Revit does not cut the Furniture category in sections.** A section through a furniture family only shows an outside view. Build fixed joinery as Casework, so sections show real cuts through carcass, shelves and backs.
- Check any new section on a render: if you can see parts beyond the far clip, or no cut faces, the category is the cause.
- Fabrication sheets also need part sizes and a cutting list per unit, not just overall dimensions.

## Pegboard and cable management

- Metal pegboard: 25 mm hole pitch is the common metric standard, 25.4 mm imperial. Holes are 4 to 6 mm. Confirm the accessories first, because hooks must match hole size, pitch and panel thickness.
- Perforated metal sheets are flat with no bends, and have a solid 50 mm border with no holes all round. Centre the hole grid in the sheet.
- Every counter needs wire management: grommets in the top, usually 60 or 80 mm, a cable tray under the worktop, and a **double back**: a removable inner back with a cable void, about 80 mm, running from the worktop to the floor. Shelves stop at the inner back. Coordinate with the power and data drawings.

## Dimension style

On A1 shop drawings: Arial 5 mm black text, Diagonal 3mm ticks at weight 3, lines at weight 1, text offset 1.5 mm, witness gap 2 mm, witness extension 3 mm, dimension line extension 2 mm, opaque text background. Stack strings 12 mm apart on paper. Keynote numbers 6 mm bold, keynote legend and sheet notes 5 mm, headings 5.5 mm bold. Don't dimension parts under about 25 mm in a chain, because the text won't fit: give them in a note or a larger detail. These values are practice-based judgement; 3.5 and 5 mm are ISO 3098 nominal sizes.

Set the type with `set_parameter`. Tick Mark takes an element id: scan low ids with `get_element`. Hide the reference ticks from `create_dimension_string` with a near-white line style.
