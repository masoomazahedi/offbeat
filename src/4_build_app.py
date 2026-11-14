"""OFFBEAT - script 4: build the data file the web page reads.

AI acknowledgment: this file was written with the assistance of Claude, an AI
model made by Anthropic, and reviewed by the project author. See README.md.

Writes docs/data.js, which docs/index.html loads. Values are stored as 16-bit
integers of decibels times 100, base64 encoded, which keeps the file a few
megabytes instead of a few tens of megabytes. The page divides by 100 again.

Run from the repository root, after src/3_analyse.py:
    python src/4_build_app.py
"""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

import numpy as np

from common import (DATES, MATCH_OUT, MIN_NEIGHBOURS, MIN_PATCH_CELLS,
                    NEIGHBOUR_RADIUS,
                    THRESHOLD_DB, aoi_mask, correlation, label_patches,
                    load_stack, neighbour_reference, remove_scene_shift)

ROOT = Path(__file__).resolve().parent.parent
BARE = (255, 285, 30, 60)
CITY_LON, CITY_LAT = 62.2011, 34.3529      # Herat city centre


def b64(a: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(a, dtype="<i2").tobytes()).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season-dir", default=str(ROOT / "data" / "season"))
    ap.add_argument("--kml", default=str(ROOT / "aoi" / "herat_aoi.kml"))
    args = ap.parse_args()

    db, db_hh, x, y, epsg = load_stack(Path(args.season_dir))
    rows, cols, T = db.shape
    valid = np.isfinite(db).all(2)
    aoi_all = aoi_mask(Path(args.kml), x, y, epsg, (rows, cols))
    aoi = valid & aoi_all
    land = valid & ~aoi_all
    db, _ = remove_scene_shift(db, land)
    db_hh, _ = remove_scene_shift(db_hh, land)

    swing = db.max(2) - db.min(2)
    active = aoi & (swing >= THRESHOLD_DB)
    ref, count = neighbour_reference(db, active, NEIGHBOUR_RADIUS)
    # Cells with too few active neighbours have nothing fair to compare against.
    # The page still draws a line for them, labelled "too isolated to compare",
    # so fall back to the average of all nearby farmland rather than leaving the
    # reference at zero, which would plot as a nonsense flat line at 0 dB.
    all_ref, all_count = neighbour_reference(db, aoi, NEIGHBOUR_RADIUS)
    thin = count < MIN_NEIGHBOURS
    ref[thin] = np.where(all_count[thin, None] > 0, all_ref[thin], db[thin])
    match = correlation(db, ref)

    # --- how steady is bare ground? the page quotes this as its noise floor --
    r0, r1, c0, c1 = BARE
    noise = float(np.median(db[r0:r1, c0:c1, :].std(axis=2)))

    # --- cell positions and a bilinear map from (row, col) to lat/lon -------
    rr, cc = np.nonzero(aoi)
    from pyproj import Transformer
    inv = Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True)
    # centre of each 100 m cell in projected metres
    cx = (x[: cols * 2].reshape(-1, 2).mean(1))[cc]
    cy = (y[: rows * 2].reshape(-1, 2).mean(1))[rr]
    lon, lat = inv.transform(cx, cy)
    G = np.column_stack([np.ones_like(rr, float), rr, cc, rr * cc])
    clon = np.linalg.lstsq(G, lon, rcond=None)[0]
    clat = np.linalg.lstsq(G, lat, rcond=None)[0]
    err = np.hypot((G @ clat - lat) * 111000, (G @ clon - lon) * 91000).max()
    print(f"bilinear position fit: largest error {err:.1f} m")

    idx = -np.ones((rows, cols), int)
    idx[rr, cc] = np.arange(len(rr))

    # --- the out-of-step places, largest first ------------------------------
    out = active & (count >= 4) & (match < MATCH_OUT)
    lab, sizes = label_patches(out)
    places = []
    for j in np.argsort(-sizes)[: int((sizes >= MIN_PATCH_CELLS).sum())]:
        m = lab == (j + 1)
        pr, pc = np.nonzero(m)
        mid = len(pr) // 2
        i = int(idx[pr[mid], pc[mid]])
        places.append(dict(i=i, ha=int(m.sum()),
                           lat=round(float(G[i] @ clat), 4),
                           lon=round(float(G[i] @ clon), 4),
                           k=round(float(match[m].mean()), 2)))

    data = dict(
        dates=DATES, n=int(len(rr)), rows=int(rows), cols=int(cols),
        noise=round(noise, 2),
        city=[0, 0],            # filled in below
        clon=list(clon), clat=list(clat),
        pos=b64(np.column_stack([rr, cc]).ravel()),
        hv=b64(np.round(db[rr, cc, :] * 100).ravel()),
        hh=b64(np.round(db_hh[rr, cc, :] * 100).ravel()),
        nb=b64(np.round(ref[rr, cc, :] * 100).ravel()),
        places=places)
    # the page writes distances from the city centre, so give it that grid position.
    # The city itself is not farmland, so locate it on the full grid, not among the cells.
    fwd = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    city_x, city_y = fwd.transform(CITY_LON, CITY_LAT)
    col_x = x[: cols * 2].reshape(-1, 2).mean(1)
    row_y = y[: rows * 2].reshape(-1, 2).mean(1)
    data["city"] = [int(np.abs(row_y - city_y).argmin()), int(np.abs(col_x - city_x).argmin())]

    # The page shows how the headline moves under other rules. Those numbers are
    # produced by src/3_analyse.py, so copy them rather than recompute them here.
    res = ROOT / "results" / "results.json"
    if not res.exists():
        raise SystemExit("Run src/3_analyse.py first: results/results.json is missing.")
    res = json.loads(res.read_text())
    data["sensitivity"] = res["sensitivity"]
    data["false_alarm"] = res["false_alarm"]

    target = ROOT / "docs" / "data.js"
    target.write_text("window.OFFBEAT_DATA = " + json.dumps(data) + ";\n")
    print(f"wrote {target} ({target.stat().st_size / 1e6:.1f} MB), "
          f"{data['n']:,} hectares, {len(places)} places")


if __name__ == "__main__":
    main()
