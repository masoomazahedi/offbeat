"""
OFFBEAT - script 2: read all ten passes and build the stack.

AI acknowledgment: this file was written with the assistance of Claude, an AI
model made by Anthropic, and reviewed by the project author. See README.md.

Reads the Herat window from several NISAR dates, averages each one down to
50 m pixels (which also calms the radar speckle), saves the stack for later,
and makes a color picture where the color tells you WHEN the ground changed.

Run:
    python src/2_build_stack.py            the 3 dates for the color picture (June, August, October)
    python src/2_build_stack.py all        all 10 dates (the full season, for the app)
    python src/2_build_stack.py 3 7        just dates number 3 to 7 in the list, if you need to resume

Outputs (in the folder "data/season"):
    herat_50m_<date>.npz        one file per date: HH and HV at 50 m
    herat_color_jun_aug_oct.png the color picture
    herat_hhhv_<date>.png       a second color style, from HH and HV on one date
"""
import sys
import time
from pathlib import Path

import earthaccess
import h5py
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from pyproj import Transformer

# ----------------------------------------------------------------------------
# SETTINGS
# ----------------------------------------------------------------------------
BBOX = (61.9, 34.2, 62.6, 34.5)   # Herat farmland: west, south, east, north
BLOCK = 5                          # average 5x5 pixels: 10 m -> 50 m
GRID = "science/LSAR/GCOV/grids/frequencyA"
BANDS = {"HH": "HHHH", "HV": "HVHV"}
OUT = Path(__file__).resolve().parent.parent / "data" / "season"

# All 10 Herat dates, Path 70 Frame 19. Checked against NASA's catalog 11 Nov 2026.
BASE = ("https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/"
        "{g}/{g}.h5")
GRANULES = [
    ("2026-06-19", "NISAR_L2_PR_GCOV_023_070_A_019_4005_DHDH_A_20260619T010416_20260619T010451_P05023_N_F_J_001"),
    ("2026-07-01", "NISAR_L2_PR_GCOV_024_070_A_019_4005_DHDH_A_20260701T010416_20260701T010450_P05023_N_F_J_001"),
    ("2026-07-13", "NISAR_L2_PR_GCOV_025_070_A_019_4005_DHDH_A_20260713T010415_20260713T010450_P05023_N_F_J_001"),
    ("2026-07-25", "NISAR_L2_PR_GCOV_026_070_A_019_4005_DHDH_A_20260725T010414_20260725T010449_P05023_N_F_J_001"),
    ("2026-08-18", "NISAR_L2_PR_GCOV_028_070_A_019_4005_DHDH_A_20260818T010413_20260818T010448_P05023_N_F_J_001"),
    ("2026-08-30", "NISAR_L2_PR_GCOV_029_070_A_019_4005_DHDH_A_20260830T010413_20260830T010448_P05023_N_F_J_001"),
    ("2026-09-11", "NISAR_L2_PR_GCOV_030_070_A_019_4005_DHDH_A_20260911T010413_20260911T010448_P05023_N_F_J_001"),
    ("2026-09-23", "NISAR_L2_PR_GCOV_031_070_A_019_4005_DHDH_A_20260923T010413_20260923T010448_P05023_N_F_J_001"),
    ("2026-10-05", "NISAR_L2_PR_GCOV_032_070_A_019_4005_DHDH_A_20261005T010413_20261005T010448_P05023_N_F_J_001"),
    ("2026-10-17", "NISAR_L2_PR_GCOV_033_070_A_019_4005_DHDH_A_20261017T010413_20261017T010448_P05023_N_F_J_001"),
]
# For the quick colour run: early season, peak season, late season.
TRIO = ["2026-06-19", "2026-08-18", "2026-10-17"]
# ----------------------------------------------------------------------------


def block_mean(a, k):
    """Average k x k blocks. Shrinks the image and calms the speckle."""
    r, c = a.shape[0] // k * k, a.shape[1] // k * k
    return a[:r, :c].reshape(r // k, k, c // k, k).mean(axis=(1, 3))


def read_one(url, date, session):
    """Read the Herat window from one file and return it at 50 m."""
    print(f"  {date}: opening...", flush=True)
    t0 = time.time()
    remote = session.open(url, mode="rb", block_size=8 * 1024 * 1024, cache_type="blockcache")
    with h5py.File(remote, "r") as f:
        g = f[GRID]
        epsg = int(np.asarray(g["projection"].attrs.get(
            "epsg_code", np.asarray(g["projection"][()]))).ravel()[0])
        x, y = g["xCoordinates"][:], g["yCoordinates"][:]

        west, south, east, north = BBOX
        to_grid = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
        xs, ys = to_grid.transform([west, east, west, east], [south, south, north, north])
        cols = np.where((x >= min(xs)) & (x <= max(xs)))[0]
        rows = np.where((y >= min(ys)) & (y <= max(ys)))[0]
        if cols.size == 0 or rows.size == 0:
            raise SystemExit(f"{date}: the box is outside this image")
        r0, r1 = int(rows.min()), int(rows.max()) + 1
        c0, c1 = int(cols.min()), int(cols.max()) + 1

        out = {"x": block_mean(x[c0:c1].reshape(1, -1), 1)[0][: (c1 - c0) // BLOCK * BLOCK]
                    .reshape(-1, BLOCK).mean(axis=1),
               "y": y[r0:r1][: (r1 - r0) // BLOCK * BLOCK].reshape(-1, BLOCK).mean(axis=1),
               "epsg": epsg}
        for label, name in BANDS.items():
            print(f"    reading {label}...", flush=True)
            power = g[name][r0:r1, c0:c1].astype("float32")
            out[label] = block_mean(power, BLOCK).astype("float32")
    print(f"  {date}: done in {time.time() - t0:.0f}s, "
          f"size {out['HV'].shape[0]} x {out['HV'].shape[1]}", flush=True)
    return out


def to_db(power):
    with np.errstate(divide="ignore", invalid="ignore"):
        return 10 * np.log10(np.where(power > 0, power, np.nan))


def stretch(db, lo, hi):
    """Scale a dB image to 0..1 for display, using a GIVEN range.

    For a colour picture of several dates, every date must use the SAME range.
    Scaling each date to its own range would cancel out the very differences
    between dates that we are trying to show.
    """
    return np.clip((db - lo) / (hi - lo), 0, 1)


def common_range(layers, lo_pct=2, hi_pct=98):
    """One dB range that covers all the dates together."""
    allv = np.concatenate([l[np.isfinite(l)].ravel() for l in layers])
    return np.percentile(allv, [lo_pct, hi_pct])


def save_rgb(rgb, path, title, caption, extent, flip):
    rgb = np.nan_to_num(rgb, nan=0.0)
    if flip:
        rgb = rgb[::-1]
    fig, ax = plt.subplots(figsize=(13, 7))
    ax.imshow(rgb, extent=extent)
    ax.set_title(title, fontsize=13)
    ax.set_xlabel("x (m)")
    ax.set_ylabel("y (m)")
    fig.text(0.5, 0.015, caption, ha="center", fontsize=9.5)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  saved {path}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    arg = sys.argv[1:]
    if arg and arg[0] == "all":
        wanted = GRANULES
    elif len(arg) == 2:
        wanted = GRANULES[int(arg[0]) - 1:int(arg[1])]
    else:
        wanted = [g for g in GRANULES if g[0] in TRIO]
    print(f"Dates to read: {', '.join(d for d, _ in wanted)}\n")

    print("Logging in to NASA Earthdata...")
    earthaccess.login(persist=True)
    session = earthaccess.get_fsspec_https_session()

    for date, granule in wanted:
        npz = OUT / f"herat_50m_{date}.npz"
        if npz.exists():
            print(f"  {date}: already have it, skipping")
            continue
        data = read_one(BASE.format(g=granule), date, session)
        np.savez_compressed(npz, **data)
        print(f"  saved {npz} ({npz.stat().st_size / 1e6:.0f} MB)\n")

    # ---- colour pictures -------------------------------------------------
    have = {d: OUT / f"herat_50m_{d}.npz" for d, _ in GRANULES}
    have = {d: p for d, p in have.items() if p.exists()}
    print(f"\nDates on disk: {', '.join(sorted(have))}")

    if all(d in have for d in TRIO):
        print("\nMaking the June / August / October colour picture...")
        layers, meta = [], None
        for d in TRIO:
            z = np.load(have[d])
            if meta is None:
                meta = (z["x"], z["y"], int(z["epsg"]))
            layers.append(to_db(z["HV"]))
        lo, hi = common_range(layers)
        print(f"  shared scale: {lo:.1f} to {hi:.1f} dB")
        shape = min(l.shape[0] for l in layers), min(l.shape[1] for l in layers)
        rgb = np.dstack([stretch(l[:shape[0], :shape[1]], lo, hi) for l in layers])
        x, y, epsg = meta
        extent = [x.min(), x.max(), y.min(), y.max()]
        save_rgb(rgb, OUT / "herat_color_jun_aug_oct.png",
                 "NISAR HV over Herat: colour shows WHEN the ground was bright",
                 "red = 19 Jun   green = 18 Aug   blue = 17 Oct    "
                 "grey = unchanged all season    EPSG:" + str(epsg),
                 extent, y[0] < y[-1])

    # HH/HV false colour from the latest date we have
    d = sorted(have)[-1]
    z = np.load(have[d])
    hh_db, hv_db = to_db(z["HH"]), to_db(z["HV"])
    hh = stretch(hh_db, *np.nanpercentile(hh_db, [2, 98]))
    hv = stretch(hv_db, *np.nanpercentile(hv_db, [2, 98]))
    rgb = np.dstack([hv, hh, hh * 0.6 + hv * 0.4])
    x, y = z["x"], z["y"]
    save_rgb(rgb, OUT / f"herat_hhhv_{d}.png",
             f"NISAR HH and HV over Herat, {d}",
             "green/blue = smooth or bare ground    red/orange = vegetation and rough surfaces",
             [x.min(), x.max(), y.min(), y.max()], y[0] < y[-1])

    print("\nDone. Next: python src/3_analyse.py")


if __name__ == "__main__":
    main()
