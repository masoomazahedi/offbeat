"""Shared helpers for the OFFBEAT pipeline.

AI acknowledgment: this file was written with the assistance of Claude, an AI
model made by Anthropic, and reviewed by the project author. See README.md.

Nothing here is specific to Herat. Every function is small on purpose, so that
a reader can check the arithmetic against METHOD.md by hand.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------------------
# The ten NISAR passes. Path 70, frame 19, ascending.
# 6 August is missing from the archive; we do not interpolate it.
# ---------------------------------------------------------------------------
DATES = ["2026-06-19", "2026-07-01", "2026-07-13", "2026-07-25", "2026-08-18",
         "2026-08-30", "2026-09-11", "2026-09-23", "2026-10-05", "2026-10-17"]

# The rules. Changing a number here changes every result; that is the point.
THRESHOLD_DB = 3.0      # "the echo must at least double" (3 dB = 2.0 times)
SUMMER_FROM = 4         # index into DATES: 4 is 18 August
MATCH_IN_STEP = 0.7     # correlation at or above this: clearly in step
MATCH_OUT = 0.3         # correlation below this: out of step
NEIGHBOUR_RADIUS = 5    # cells each way, so an 11x11 box: about 0.5 km
MIN_NEIGHBOURS = 4      # fewer active neighbours than this: do not judge
MIN_PATCH_CELLS = 2     # a "place" is at least this many connected hectares

# A block of bare ground outside the farmland, in 100 m cell coordinates.
# Used as a false alarm check: nothing here should ever pass the rule.
BARE_BLOCK = (255, 285, 30, 60)   # row0, row1, col0, col1


def block_mean(a: np.ndarray, k: int) -> np.ndarray:
    """Average k x k blocks of a 2-D array.

    Always applied to radar POWER, never to decibels. Decibels are logarithms,
    and the average of logarithms is not the logarithm of the average; mixing
    the two is a real and easy mistake.
    """
    r, c = a.shape[0] // k * k, a.shape[1] // k * k
    return a[:r, :c].reshape(r // k, k, c // k, k).mean(axis=(1, 3))


def to_db(power: np.ndarray) -> np.ndarray:
    """Radar power to decibels. Zero or negative power becomes NaN."""
    with np.errstate(divide="ignore", invalid="ignore"):
        return 10 * np.log10(np.where(power > 0, power, np.nan))


def times(db: float) -> float:
    """Decibels to a plain multiplier: 3 dB -> 2.0 times."""
    return float(10 ** (db / 10))


def load_stack(season_dir: Path, block: int = 2):
    """Load the ten 50 m files and return a 100 m decibel stack.

    Returns (db, x, y, epsg) where db has shape (rows, cols, 10).
    """
    files = [season_dir / f"herat_50m_{d}.npz" for d in DATES]
    missing = [f.name for f in files if not f.exists()]
    if missing:
        raise SystemExit(
            "Missing input files in %s:\n  %s\n"
            "Run src/2_build_stack.py first." % (season_dir, "\n  ".join(missing)))
    zs = [np.load(f) for f in files]
    power = np.dstack([block_mean(z["HV"].astype("float64"), block) for z in zs])
    power_hh = np.dstack([block_mean(z["HH"].astype("float64"), block) for z in zs])
    x, y, epsg = zs[0]["x"], zs[0]["y"], int(zs[0]["epsg"])
    return to_db(power), to_db(power_hh), x, y, epsg


def aoi_mask(kml_path: Path, x: np.ndarray, y: np.ndarray, epsg: int,
             shape: tuple[int, int], block: int = 2) -> np.ndarray:
    """Which 100 m cells fall inside the farmland outline in the KML file."""
    from matplotlib.path import Path as MplPath
    from pyproj import Transformer

    fwd = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    # cell centres at the 50 m grid, then averaged down with the same block size
    h50, w50 = shape[0] * block, shape[1] * block
    xx, yy = np.meshgrid(x[:w50], y[:h50])
    pts = np.column_stack([xx.ravel(), yy.ravel()])
    inside = np.zeros(len(pts), bool)
    ns = "{http://www.opengis.net/kml/2.2}coordinates"
    for node in ET.parse(kml_path).getroot().iter(ns):
        pairs = [p.split(",") for p in node.text.split()]
        px, py = fwd.transform([float(p[0]) for p in pairs], [float(p[1]) for p in pairs])
        inside |= MplPath(np.column_stack([px, py])).contains_points(pts)
    return block_mean(inside.reshape(h50, w50).astype("float32"), block) > 0.5


def remove_scene_shift(db: np.ndarray, land: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Remove the brightness shift that affects a whole pass.

    Some passes come back brighter overall for reasons that have nothing to do
    with farming. We measure each date's median over land OUTSIDE the farmland
    and subtract the part that differs from the average date. Without this, a
    uniformly bright pass is mistaken for a growing season.
    """
    med = np.array([np.nanmedian(db[:, :, t][land]) for t in range(db.shape[2])])
    shift = med - med.mean()
    return db - shift[None, None, :], shift


def box_sum(a: np.ndarray, k: int) -> np.ndarray:
    """Sum of each (2k+1) x (2k+1) neighbourhood, with zero padding."""
    p = np.pad(a, k, mode="constant")
    c = np.pad(np.cumsum(np.cumsum(p, 0), 1), ((1, 0), (1, 0)))
    s = 2 * k + 1
    return c[s:, s:] - c[:-s, s:] - c[s:, :-s] + c[:-s, :-s]


def neighbour_reference(db: np.ndarray, active: np.ndarray, radius: int):
    """Average curve of the ACTIVE cells around each cell, itself excluded.

    Unchanged neighbours are deliberately left out. An earlier version averaged
    every neighbour, which flattened the reference curve for nearly half the
    active cells and made ordinary fields look unusual.
    """
    t = db.shape[2]
    count = box_sum(active.astype("float64"), radius) - active
    ref = np.dstack([
        (box_sum(np.where(active, db[:, :, i], 0.0), radius)
         - np.where(active, db[:, :, i], 0.0)) / np.maximum(count, 1)
        for i in range(t)])
    return ref, count


def correlation(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Pearson correlation of two stacks along the time axis, cell by cell.

    This compares SHAPE only. A patch that always sits lower than its
    surroundings but rises and falls with them scores close to +1.
    """
    da = a - a.mean(2, keepdims=True)
    dbb = b - b.mean(2, keepdims=True)
    den = np.sqrt((da * da).sum(2) * (dbb * dbb).sum(2))
    return np.where(den > 1e-9, (da * dbb).sum(2) / np.maximum(den, 1e-9), 0.0)


def label_patches(mask: np.ndarray):
    """8-connected groups of True cells. Returns (labels, sizes)."""
    from scipy import ndimage as ndi
    lab, n = ndi.label(mask, structure=np.ones((3, 3)))
    sizes = ndi.sum(mask, lab, range(1, n + 1)) if n else np.array([])
    return lab, np.asarray(sizes)
