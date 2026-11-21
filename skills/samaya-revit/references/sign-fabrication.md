# Sign fabrication and illuminated variants

Use this reference for fascia signs, letters, light boxes, wayfinding signs, logos and their support frames. It governs the fabrication model, shop drawings and factory handoff. Read [fabrication modeling](fabrication-modeling.md), [material hatching](material-hatching.md) and [views and sheets](views-and-sheets.md) with it.

## Start with verified inputs

For a reference walkaround, record the file and timestamps that show the face, return and base. Identify which dimensions are measured, quoted or proposed. When a thinner option changes the load path, compare it against the installed baseline in its own family and drawing. Record the approved artwork revision, location, finished overall size, fixing zone, face material, illumination intent, electrical supply point, access route and the design drawing that controls each item. Give every sign a unique mark.

For every bought illuminated component, attach a **manufacturer source record** to the sign schedule or sheet note:

| Record | Required evidence |
|---|---|
| Product identity | Manufacturer, product family, exact model / part number and finish |
| Technical source | Current manufacturer data sheet or installation manual, URL or controlled PDF name, revision/date and page reference |
| Performance | Voltage, wattage, IP rating, operating temperature, luminous output/spacing guidance, driver compatibility and warranty |
| Application check | Proposed face depth, return depth, diffuser/face material and service-access arrangement against that source |

Use the selected manufacturer’s controlled data for product geometry. Identify a supplier proposal as a candidate until the project approves it.

## Buildable sign model

1. Model each shop-made layer that controls fabrication: carrier or frame, back pan, returns, face, diffuser, internal rails, light modules, driver enclosure, access panel and cables where their route or clearance affects fit.
2. Split shop assemblies from field-installed parts. Shop welds, folded pans, letter returns, bonded faces and internal module rails belong in shop details. Site brackets, structural anchors, final electrical termination, sealing and alignment belong in field details unless the contract states otherwise.
3. Keep the sign body, support frame and anchor zone as separate marked assemblies. Show a service path to drivers and light modules; a sealed letter with no stated replacement path is not ready for issue.
4. Do not invent light-module pitch, driver loading, cable length, face depth or ventilation. Take them from the selected manufacturer's record and show the controlling value on the sign schedule or detail.

## Conditional anchors and support design

Anchor layout is conditional design information, not a universal fixing detail. On each detail state the support substrate, anchor type/diameter/embedment, edge distance, spacing, load path and installation tolerance **only when they are designed for the verified substrate and loads**.

Until that evidence is available, show an `ANCHOR DESIGN HOLD POINT` and identify the missing inputs: as-built substrate type/thickness/strength, reinforcement scan where applicable, sign and support dead weight, wind actions, eccentricity, anchor product approval, edge distances, corrosion environment and the responsible structural designer. Do not convert a preliminary screen into an issued anchor capacity.

Use a locating template for drilled anchors and show datum, centre lines, hole coordinates, permitted adjustment and field survey requirement. A site team must not drill from a rendered elevation.

## Lit-only variants

For every illuminated sign, issue a coordinated pair from the same geometry:

- **Day / unlit view:** finish, fabrication joints, returns, fixing points and overall dimensions.
- **Night / lit-only view:** illuminated faces, halos or light-box zones shown as the only active light elements; non-illuminated sign parts and adjacent architecture are halftone outlines. Label the circuit/driver reference, light colour requirement, dimming/control interface and intended lit zone.

The lit-only view is a communication and coordination view, not a photometric compliance calculation. Never simulate brightness or claim luminance, uniformity or energy performance unless the manufacturer's source and a project lighting calculation support it. Keep the fabrication and lit-only marks identical so the workshop, electrical team and installer are referring to the same item.

## Native Revit sheet content and QA

Create sign elevations, sections, location plans, key plans, schedules and legends as native Revit content. A manufacturer cut sheet may be a controlled reference attachment, but it must not replace a native fabrication detail.

At issue, inspect the sheet at printed scale:

- Sign mark, location plan and key plan agree; the key plan shows every sign covered by the sheet.
- The largest text is the sign title, then view titles, then dimensions/keynotes, then notes. Do not reduce type to solve a layout clash.
- Dimensions sit outside the sign; leaders do not cross the letter face, light zone or one another.
- Day/unlit and night/lit-only variants use the same orientation, scale and datum so differences are readable.
- Each material has the specified cut hatch in sections; light modules, LED tape and drivers are keyed rather than represented as a generic glow.
- The current manufacturer source, structural hold point or approved anchor detail, and shop/field boundary are visible in the issue package.

## Shop and field boundary

| Shop responsibility | Field responsibility |
|---|---|
| Fabricate marked sign body, frame, returns, faces, internal rails and approved factory wiring | Verify substrate, survey and set out locations / levels before drilling |
| Provide the approved locating template, labelled loose brackets and access instructions | Install approved anchors and brackets to the issued anchor detail / engineer instruction |
| Bench-test shop wiring where included and label drivers, circuits and connectors | Provide isolator, final power connection, earthing, controls connection, test and commissioning where included |
| Protect finished faces and issue lifting/handling instructions | Align, level, seal interfaces and record final installation condition |

The project contract and approved method statement allocate final responsibility. This table prevents gaps in the drawing package; it does not transfer design responsibility.

## Sources to record, not substitute

- Selected sign-lighting manufacturer's current product data sheet and installation instructions.
- Selected power-supply/driver manufacturer's current product data sheet and wiring instructions.
- Selected anchor manufacturer's current technical data, installation instructions and design software output where used.
- Approved project artwork, architectural detail, electrical drawing and structural design basis.

In an installation elevation, orient the view to the modeled approach. Show the sign face crisply and use halftone for buildings that actually project behind it. Record viewing direction and local grade. Where there is an open view, show the approach plan without introducing a fictitious background.
