# 3D views on sheets

Read before making any 3D, isometric or exploded view for a sheet. Every rule here comes from a fault the user found on Madina 1.

## How to make one

Use `tools/view3d.mjs` (`unit3d`). It does all of the steps below; do not build 3D views by hand in sheet scripts.

1. **A fresh view.** Make it with `create_3d_view`. Never duplicate "3D all" or "{3D}": a duplicate carries that view's section box, hidden categories and overrides. On A-2102 the exploded copies sat outside "3D all"'s section box, so both views were empty.
2. **A section box round the subject**, the subject's box plus about 30 mm. It keeps out the shell, the neighbouring units and the ceiling.
3. **Isolate the subject**, then **hide `OST_RvtLinks`**. Isolation hides only host elements. Linked models stay, which is how the track lights from the linked ELEC model showed on A-2101. Also hide section boxes, levels, grids and reference lines.
   - Prefer `isolate_by_mark` (a view filter) where the unit has a Mark. A filter also hides elements added later.
   - `isolate_in_view` hides only what exists now, so re-isolate after any model change.
4. **A true isometric.** The view direction is one of (±1, ±1, −1). `front-left` is (1, 1, −1) for a unit whose front faces −y.
   - Pick the corner that shows the unit's open front. For units facing ±x, turn the direction with the unit.
5. **Work out the scale; do not guess it.**
   - Project the 8 corners of the box onto the view's right and up axes. The spread gives the width and height in mm.
   - scale = max(width / area width, height / (area height − title room)), rounded up.
   - The old isometric-box formula in `fit3d.mjs` is only right for the default 3D direction.
6. **Check the view is not empty before placing it.** Use `view_category_counts`. An empty view makes `place_view_on_sheet` fail with "Object reference not set".
7. **Render the sheet and look at it** before reporting. Check that:
   - there are no other units, no lights or ceiling, and no shell;
   - nothing is clipped by the section box;
   - the view does not run into the notes column, the title block or another view;
   - the title sits under the view, and the scale reads right.

## Exploded views

- The exploded copy is a separate family ("<Unit> Exploded"), placed well outside the shop.
- Each exploded view is a fresh `create_3d_view` aimed at its copy. The second view is the copy turned 180°, which shows the back.
- Rebuild the exploded family from the same parts every time the unit changes.

## Families feeding 3D views

- Build unit families from `Metric Furniture.rft`, then set the category with `set_family_category`.
- `Metric Casework.rft` contains a 3D view whose camera blows up every instance's bounding box: on Madina 1 a 920 × 590 arch read as 1325 × 1190. That breaks sections, crops and scale fits that read the box. The camera cannot be deleted through the bridge.

## Shading

- Fabrication 3D and exploded views are shaded with edges (`ShadingWithEdges`), Detail Level Fine.
- Technical sheets elsewhere stay hidden line (see `drawing-and-bim-standards.md`).

## Sources

- Revit API: [View3D.CreateIsometric, crop and section box](https://help.autodesk.com/cloudhelp/2017/ENU/Revit-API/files/GUID-A7FA8DBC-830E-482D-9B66-147399524442.htm).
- The Building Coder: [crop a 3D view to a box by projecting its corners into view coordinates](https://jeremytammik.github.io/tbc/a/1852_sect_box_2_view_crop.html) and [crop view to room](https://tbc-mirror-blog.pages.dev/blog/0259_crop_view_to_room).
- [Viewport.GetBoxOutline](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-API-MainReference/files/034750ce-be6c-456b-7f3f-ee0ab5b5e2c0.htm): it returns the placed size without the label. Use it to check a fit once the bridge exposes it.
- Hiding linked elements: per-element hides on a link persist and are hard to undo, so hide by category ([Autodesk forum](https://forums.autodesk.com/t5/revit-architecture-forum/unhide-elements-from-linked-revit-file/m-p/8876165/highlight/true)).
