"""
OFFBEAT - script 1: read one NISAR scene over Herat.

AI acknowledgment: this file was written with the assistance of Claude, an AI
model made by Anthropic, and reviewed by the project author. See README.md.

Read ONLY the Herat window from one NISAR GCOV file, without downloading all 7 GB.

Run:
    python src/1_read_scene.py                   (reads the file from NASA over the internet)
    python src/1_read_scene.py myfile.h5    (reads a file you already downloaded)

Outputs (in the folder "data/scene"):
    herat_<date>_HH.png, herat_<date>_HV.png   pictures of the radar image
    herat_<date>.npz                           the numbers, for later steps
"""
import sys
import time
from pathlib import Path

import h5py
import matplotlib
matplotlib.use("Agg")  # save pictures to files, no window needed
import matplotlib.pyplot as plt
import numpy as np
from pyproj import Transformer

# ----------------------------------------------------------------------------
# SETTINGS - change these, nothing else
# ----------------------------------------------------------------------------
# One image from Path 70, Frame 19 (the track we chose), 17 October 2026.
GRANULE = ("NISAR_L2_PR_GCOV_033_070_A_019_4005_DHDH_A_"
           "20261017T010413_20261017T010448_P05023_N_F_J_001")
URL = ("https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/"
       f"{GRANULE}/{GRANULE}.h5")

# Herat farmland box: west, south, east, north (longitude / latitude in degrees)
BBOX = (61.9, 34.2, 62.6, 34.5)

# Where the images live inside the file
GRID = "science/LSAR/GCOV/grids/frequencyA"
BANDS = {"HH": "HHHH", "HV": "HVHV"}

OUT = Path(__file__).resolve().parent.parent / "data" / "scene"
# ----------------------------------------------------------------------------


def open_file(source):
    """Open a local .h5 file, or a remote one using your NASA Earthdata login."""
    if not source.startswith("http"):
        print(f"Opening local file: {source}")
        return h5py.File(source, "r")

    import earthaccess
    print("Logging in to NASA Earthdata (first time: type your username and password)...")
    earthaccess.login(persist=True)  # saves the login on your computer for next time
    fs = earthaccess.get_fsspec_https_session()
    print("Opening the remote file (only small pieces are fetched)...")
    # Big blocks + a block cache = far fewer round trips to NASA's server.
    remote = fs.open(source, mode="rb", block_size=8 * 1024 * 1024, cache_type="blockcache")
    return h5py.File(remote, "r")


def show_structure(f):
    """Print what is inside the grid group, so we can see the real names."""
    if GRID not in f:
        print(f"\nPROBLEM: '{GRID}' is not in this file. Top-level layout is:")
        f.visit(lambda name: print("   ", name) if name.count("/") <= 3 else None)
        sys.exit("Send this list to Claude so the script can be adjusted.")
    print(f"\nInside {GRID}:")
    for name, item in f[GRID].items():
        shape = getattr(item, "shape", "")
        print(f"    {name:28s} {shape}")


def get_epsg(grid):
    """Find the map projection code (EPSG) of the image grid."""
    proj = grid["projection"]
    if "epsg_code" in proj.attrs:
        return int(np.asarray(proj.attrs["epsg_code"]).ravel()[0])
    return int(np.asarray(proj[()]).ravel()[0])


def window_indexes(coords, low, high):
    """Positions in a coordinate array that fall between low and high.
    Works whether the array counts up or down."""
    inside = np.where((coords >= low) & (coords <= high))[0]
    if inside.size == 0:
        sys.exit("The box is outside this image. Check BBOX.")
    return int(inside.min()), int(inside.max()) + 1


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else URL
    start = time.time()
    OUT.mkdir(parents=True, exist_ok=True)

    with open_file(source) as f:
        show_structure(f)
        grid = f[GRID]

        # 1. The image grid is in metres (a UTM projection), not degrees.
        epsg = get_epsg(grid)
        x = grid["xCoordinates"][:]
        y = grid["yCoordinates"][:]
        print(f"\nProjection: EPSG:{epsg}   full image: {y.size} rows x {x.size} columns")

        # 2. Convert our lon/lat box into that projection.
        west, south, east, north = BBOX
        to_grid = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
        xs, ys = to_grid.transform([west, east, west, east], [south, south, north, north])
        c0, c1 = window_indexes(x, min(xs), max(xs))
        r0, r1 = window_indexes(y, min(ys), max(ys))
        print(f"Herat window: rows {r0}-{r1}, columns {c0}-{c1} "
              f"({r1 - r0} x {c1 - c0} pixels)")

        # 3. Read just that window for each polarization.
        data = {}
        for label, name in BANDS.items():
            if name not in grid:
                print(f"    {name} not in this file, skipping")
                continue
            print(f"Reading {label} window...")
            data[label] = grid[name][r0:r1, c0:c1].astype("float32")

        x_win, y_win = x[c0:c1], y[r0:r1]

    # 4. Radar brightness is stored as linear power. Convert to decibels (dB),
    #    which is how radar images are normally viewed.
    date = GRANULE.split("_")[11][:8] if source.startswith("http") else "local"
    extent = [x_win.min(), x_win.max(), y_win.min(), y_win.max()]
    flip = y_win[0] < y_win[-1]  # make north point up
    for label, power in data.items():
        with np.errstate(divide="ignore", invalid="ignore"):
            db = 10 * np.log10(np.where(power > 0, power, np.nan))
        lo, hi = np.nanpercentile(db, [2, 98])
        print(f"{label}: min {np.nanmin(db):.1f} dB, max {np.nanmax(db):.1f} dB, "
              f"empty pixels {np.isnan(db).mean():.1%}")
        fig, ax = plt.subplots(figsize=(10, 6))
        im = ax.imshow(db[::-1] if flip else db, cmap="gray", vmin=lo, vmax=hi, extent=extent)
        ax.set_title(f"NISAR L-band {label} over Herat, {date}")
        ax.set_xlabel(f"x (m, EPSG:{epsg})")
        ax.set_ylabel("y (m)")
        fig.colorbar(im, label="backscatter (dB)", shrink=0.8)
        png = OUT / f"herat_{date}_{label}.png"
        fig.savefig(png, dpi=150, bbox_inches="tight")
        plt.close(fig)
        print(f"    saved {png}")

    np.savez_compressed(OUT / f"herat_{date}.npz", x=x_win, y=y_win, epsg=epsg, **data)
    print(f"\nDone in {time.time() - start:.0f} seconds. Send Claude the PNG files and this printout.")


if __name__ == "__main__":
    main()