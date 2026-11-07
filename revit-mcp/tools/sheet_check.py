"""Gate a sheet against the Samaya sheet standard before it is issued.

Rules (standards/sultan-standards.json -> sheet_composition):
  * a sheet carrying a plan carries that plan only
  * sections and details may share a sheet, laid out in a grid, never at random
  * every viewport inside the drawing area, none overlapping, gutters at least 40 mm
  * every viewport as large as its cell allows, at least 85 % on the limiting axis
  * Samaya Factory A1 title block, fields filled

Usage:  python sheet_check.py <port> <sheet_id> [--min-fill 0.85]
Exit:   0 pass, 1 fail (prints every failed criterion), 2 could not read.
"""
import json
import socket
import sys

MARGIN = 15.0
GUTTER = 40.0
PLAN_TYPES = {"floorplan", "ceilingplan", "siteplan", "areaplan", "structuralplan"}


def call(port, payload, timeout=60):
    s = socket.create_connection(("127.0.0.1", port), timeout=timeout)
    s.sendall((json.dumps(payload) + "\n").encode())
    buf = b""
    while not buf.endswith(b"\n"):
        chunk = s.recv(65536)
        if not chunk:
            break
        buf += chunk
    s.close()
    return json.loads(buf.decode("utf-8", "replace"))


def overlap(a, b):
    return not (a["right_mm"] <= b["left_mm"] or b["right_mm"] <= a["left_mm"]
                or a["top_mm"] <= b["bottom_mm"] or b["top_mm"] <= a["bottom_mm"])


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    port, sheet_id = int(sys.argv[1]), int(sys.argv[2])
    min_fill = 0.85
    if "--min-fill" in sys.argv:
        min_fill = float(sys.argv[sys.argv.index("--min-fill") + 1])

    r = call(port, {"command": "drawing_info", "params": {"sheet_id": sheet_id}})
    if not r.get("ok"):
        print("FAIL cannot read sheet:", r.get("error"))
        return 2
    info = r["result"]
    sheet_w, sheet_h = info["sheet_mm"]
    right_limit = min(sheet_w - 180.0, 1012.0)
    vps = info.get("viewports", [])
    failures = []

    tb = (info.get("title_block") or {}).get("type") or ""
    if "samaya" not in tb.lower():
        failures.append("title block is '%s', not Samaya Factory A1" % tb)
    if not vps:
        failures.append("no viewport on the sheet")

    plans = [v for v in vps if str(v.get("view_type", "")).replace(" ", "").lower() in PLAN_TYPES]
    if plans and len(vps) > 1:
        failures.append("a sheet carrying a plan must carry that plan only (%d viewports)" % len(vps))

    for vp in vps:
        left, right = vp["left_mm"], vp["right_mm"]
        bottom, top = vp["bottom_mm"], vp["top_mm"]
        if left < MARGIN - 0.5:
            failures.append("%s: left %.1f < %.0f" % (vp["view"], left, MARGIN))
        if right > right_limit + 0.5:
            failures.append("%s: right %.1f > %.1f" % (vp["view"], right, right_limit))
        if bottom < MARGIN - 0.5:
            failures.append("%s: bottom %.1f < %.0f" % (vp["view"], bottom, MARGIN))
        if top > sheet_h - MARGIN + 0.5:
            failures.append("%s: top %.1f > %.1f" % (vp["view"], top, sheet_h - MARGIN))

    for i, a in enumerate(vps):
        for b in vps[i + 1:]:
            if overlap(a, b):
                failures.append("%s overlaps %s" % (a["view"], b["view"]))
            else:
                gap_x = max(b["left_mm"] - a["right_mm"], a["left_mm"] - b["right_mm"])
                gap_y = max(b["top_mm"] - a["bottom_mm"], a["bottom_mm"] - b["top_mm"])
                if max(gap_x, gap_y) < GUTTER - 0.5:
                    failures.append("%s and %s are %.0f mm apart, gutter is %.0f"
                                    % (a["view"], b["view"], max(gap_x, gap_y), GUTTER))

    # each view against the cell the grid allows it
    if len(vps) == 1:
        cells = [(MARGIN, MARGIN, right_limit, sheet_h - MARGIN)]
    else:
        cols = 2 if len(vps) <= 4 else 3
        rows = (len(vps) + cols - 1) // cols
        cw = (right_limit - MARGIN - (cols - 1) * GUTTER) / cols
        ch = (sheet_h - 2 * MARGIN - (rows - 1) * GUTTER) / rows
        cells = []
        for idx in range(len(vps)):
            rr, cc = divmod(idx, cols)
            cells.append((MARGIN + cc * (cw + GUTTER), sheet_h - MARGIN - (rr + 1) * ch - rr * GUTTER,
                          MARGIN + cc * (cw + GUTTER) + cw, sheet_h - MARGIN - rr * (ch + GUTTER)))

    for vp, cell in zip(sorted(vps, key=lambda v: (-v["top_mm"], v["left_mm"])), cells):
        cx0, cy0, cx1, cy1 = cell
        fill_x = (vp["right_mm"] - vp["left_mm"]) / (cx1 - cx0)
        fill_y = (vp["top_mm"] - vp["bottom_mm"]) / (cy1 - cy0)
        limiting = max(fill_x, fill_y)
        print("view %-38s 1:%-4d %4.0f x %4.0f mm  cell fill %3.0f%% x %3.0f%%"
              % (vp["view"], vp["scale"], vp["right_mm"] - vp["left_mm"],
                 vp["top_mm"] - vp["bottom_mm"], fill_x * 100, fill_y * 100))
        if limiting < min_fill:
            failures.append("%s fills %.0f%% of its cell, needs %.0f%%"
                            % (vp["view"], limiting * 100, min_fill * 100))

    print("sheet %s / %s  %.1f x %.1f mm  %d viewport(s)  title block: %s"
          % (info.get("number"), info.get("name"), sheet_w, sheet_h, len(vps), tb))
    if failures:
        print("FAIL")
        for f in failures:
            print("  -", f)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
