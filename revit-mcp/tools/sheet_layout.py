"""Lay several views out on one sheet as a grid, as large as they fit, never overlapping.

Implements the standard in standards/sultan-standards.json -> sheet_composition:
plans go one per sheet; sections and details may share a sheet in an aligned grid.

Usage:
    python sheet_layout.py <port> <sheet_id> <view_id> [<view_id> ...] \
        [--cols N] [--gutter 40] [--margin 15] [--drawing-area 1012]

It sets each viewport's scale to the largest that fits its cell, places it in a
regular grid (equal gutters, aligned edges, reading order left to right, top to
bottom) and prints the resulting boxes. It does not export; run sheet_check.py
afterwards and only then export.
"""
import json
import math
import socket
import sys

ISO_SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2500]


def call(port, payload, timeout=120):
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


def main():
    args = sys.argv[1:]
    if len(args) < 3:
        print(__doc__)
        return 2
    port, sheet_id = int(args[0]), int(args[1])
    view_ids = []
    opts = {"cols": None, "gutter": 40.0, "margin": 15.0, "right": 1012.0}
    i = 2
    while i < len(args):
        a = args[i]
        if a == "--cols":
            opts["cols"] = int(args[i + 1]); i += 2
        elif a == "--gutter":
            opts["gutter"] = float(args[i + 1]); i += 2
        elif a == "--margin":
            opts["margin"] = float(args[i + 1]); i += 2
        elif a == "--drawing-area":
            opts["right"] = float(args[i + 1]); i += 2
        else:
            view_ids.append(int(a)); i += 1

    info = call(port, {"command": "drawing_info", "params": {"sheet_id": sheet_id}})
    if not info.get("ok"):
        print("FAIL cannot read sheet:", info.get("error"))
        return 2
    sheet_w, sheet_h = info["result"]["sheet_mm"]
    right = min(sheet_w - 180.0, opts["right"])
    avail_w = right - opts["margin"]
    avail_h = (sheet_h - opts["margin"]) - opts["margin"]

    cols = opts["cols"] or (1 if len(view_ids) == 1 else 2 if len(view_ids) <= 4 else 3)
    rows = int(math.ceil(len(view_ids) / float(cols)))
    cell_w = (avail_w - (cols - 1) * opts["gutter"]) / cols
    cell_h = (avail_h - (rows - 1) * opts["gutter"]) / rows

    # a view's own aspect ratio decides which side of the cell limits it
    placed = []
    for idx, vid in enumerate(view_ids):
        vinfo = call(port, {"command": "drawing_info", "params": {"sheet_id": sheet_id}})
        shape = None
        for vp in vinfo["result"]["viewports"]:
            pass
        r = call(port, {"command": "get_element", "params": {"element_id": vid}})
        name = (r.get("result") or {}).get("name") or str(vid)
        # scale so the view's crop box fits the cell: use current viewport as the yardstick
        cur = None
        for vp in info["result"]["viewports"]:
            if vp.get("view") == name:
                cur = vp
        if cur is None:
            print("cannot size %s from the sheet: place it once first, then re-run" % name)
            return 3
        shape = (cur["right_mm"] - cur["left_mm"], cur["top_mm"] - cur["bottom_mm"])
        factor = min(cell_w / shape[0], cell_h / shape[1])
        target_scale = cur["scale"] / factor
        # snap to a preferred scale that is not larger than what fits
        snapped = max([s for s in ISO_SCALES if s >= target_scale] or [ISO_SCALES[-1]])
        call(port, {"command": "set_view_scale", "params": {"view_id": vid, "scale": snapped}})
        placed.append((vid, name, snapped))

    # re-place in reading order using the boxes just measured
    refreshed = call(port, {"command": "drawing_info", "params": {"sheet_id": sheet_id}})["result"]["viewports"]
    sizes = {vp["view"]: (vp["right_mm"] - vp["left_mm"], vp["top_mm"] - vp["bottom_mm"]) for vp in refreshed}
    for idx, (vid, name, scale) in enumerate(placed):
        w, h = sizes.get(name, (cell_w, cell_h))
        rr, cc = divmod(idx, cols)
        cx0 = opts["margin"] + cc * (cell_w + opts["gutter"])
        cy1 = sheet_h - opts["margin"] - rr * (cell_h + opts["gutter"])
        # centres the view in its cell
        cx = cx0 + cell_w / 2.0
        cy = cy1 - cell_h / 2.0
        call(port, {"command": "place_view_on_sheet",
                    "params": {"sheet_id": sheet_id, "view_id": vid,
                               "location": {"x": cx, "y": cy, "z": 0}}})
        print("%-38s 1:%-4d %5.0f x %5.0f mm  cell r%dc%d" % (name, scale, w, h, rr + 1, cc + 1))
    print("grid %d x %d, cell %.0f x %.0f mm, gutter %.0f mm" % (cols, rows, cell_w, cell_h, opts["gutter"]))
    print("now run sheet_check.py %d %d" % (port, sheet_id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
