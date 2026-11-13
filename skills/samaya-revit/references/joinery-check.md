# Joinery check (tools/joinery_check.mjs)

Run it on every joinery item before sheets and before the factory issue. Input is the parts list that builds the Revit
family and the BOM (`{ item, title, parts: [{ code, name, mat, min, max, module? }], hardware: [{ item, qty, unit }] }`, mm).
A project config (`--config`) overrides any default: board sizes, E values, shelf load, site door size.

```
node tools/joinery_check.mjs [--config project.json] [--json out.json] <item>_parts.json ...
```

Bonded layers with the same footprint count as one panel (a 43 mm Viroc + plywood + Viroc sandwich is one panel).

| Rule | Checks | Fails when |
|---|---|---|
| J01 | Every part fits a stock board (or softwood length) of its material | Bigger than every sheet: needs a joint. WARN if it only fits the larger sheet (confirm supply) |
| J02 | Thickness is made for that material | A thickness not on the market |
| J03 | Shelf and top sag under a uniform load (default 1.5 kN/m2), bonded section, clear span between supports | Sag more than span/300 (WARN span/400) |
| J04 | Hinge type against the door thickness: 10-15 thin-door, 16-26 standard 35 cup, 27-32 thick-door | Under 10, over 32, or the hardware line names another door thickness |
| J05 | Hinges per door by height and weight (hingeCount, lockers.md) | Fewer hinges than the rule |
| J06 | Each module (part field `module`, else the whole item) passes the site door on edge; weight for two men | Does not pass the door. WARN over 100 kg |
| J07 | Units over 1200 high fixed to the wall (EN 16121); free units H/D up to 2 | Tall and not fixed |
| J08 | Threaded inserts listed where hardware screws into Viroc or MDF | WARN when missing |
| J09 | Parts do not clash. Corner zones (overlap no bigger than the boards) are joint zones: set mitre or butt before CNC | A real clash. WARN for joint zones |
| J10 | No joint in a visible Viroc face | A Viroc part longer than any sheet |

Defaults to confirm per project: Viroc 2600 x 1250 normal, 3000 x 1250 larger; MR plywood 2440 x 1220; solid surface
3660 x 760; softwood 4800. E (MPa): Viroc 4500, plywood 5000, MDF 2500, solid surface 8000. Site door 1000 x 2100.

First use (Aseer retail V-01, 13 Nov 2026): plywood cores of the 2800 plinth tops and the 2785 RT.01 uprights are longer
than 2440 plywood; RT.01 (4003 long, 1335 kg) must be split into modules; its 30 mm doors need thick-door hinges and
3 per door at 10.6 kg; the till's 12 mm solid surface upstand top spans 866 with no support.
