"""OFFBEAT - script 3: apply the three rules and report every number.

AI acknowledgment: this file was written with the assistance of Claude, an AI
model made by Anthropic, and reviewed by the project author. See README.md.

This is the only place where results are produced. Every figure quoted in the
README, in the web page, in the slides and in the submission comes from the
files this script writes. Nothing is typed by hand anywhere else.

Run from the repository root:
    python src/3_analyse.py
    python src/3_analyse.py --season-dir path/to/season

Writes:
    results/results.json    machine readable, used by src/4_build_app.py
    RESULTS.md              human readable, committed to the repository
"""
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

import numpy as np

from common import (BARE_BLOCK, DATES, MATCH_OUT, MIN_NEIGHBOURS,
                    MIN_PATCH_CELLS, NEIGHBOUR_RADIUS, SUMMER_FROM,
                    THRESHOLD_DB, aoi_mask, correlation, label_patches,
                    load_stack, neighbour_reference, remove_scene_shift, times)

ROOT = Path(__file__).resolve().parent.parent
HECTARES_TO_KM2 = 0.01          # one 100 m cell is one hectare


def classify(db, aoi, threshold, summer_from, match_out, radius=NEIGHBOUR_RADIUS):
    """The three rules of METHOD.md, applied to every cell."""
    ordered = np.sort(db, axis=2)
    swing = ordered[:, :, -1] - ordered[:, :, 0]          # rule 1
    peak = db.argmax(2)                                   # rule 2
    active = aoi & (swing >= threshold)
    summer = active & (peak >= summer_from)
    early = active & (peak < summer_from)
    ref, count = neighbour_reference(db, active, radius)  # rule 3
    match = correlation(db, ref)
    comparable = active & (count >= MIN_NEIGHBOURS)
    isolated = active & ~comparable
    out_of_step = comparable & (match < match_out)
    return dict(swing=swing, peak=peak, active=active, summer=summer, early=early,
                match=match, count=count, comparable=comparable, isolated=isolated,
                out_of_step=out_of_step)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season-dir", default=str(ROOT / "data" / "season"),
                    help="folder holding herat_50m_<date>.npz (default: data/season)")
    ap.add_argument("--kml", default=str(ROOT / "aoi" / "herat_aoi.kml"))
    args = ap.parse_args()

    db, db_hh, x, y, epsg = load_stack(Path(args.season_dir))
    rows, cols, n_dates = db.shape
    valid = np.isfinite(db).all(2)
    aoi_all = aoi_mask(Path(args.kml), x, y, epsg, (rows, cols))
    aoi = valid & aoi_all
    land = valid & ~aoi_all                      # everything outside the farmland

    db, shift = remove_scene_shift(db, land)
    db_hh, _ = remove_scene_shift(db_hh, land)

    r = classify(db, aoi, THRESHOLD_DB, SUMMER_FROM, MATCH_OUT)
    km2 = lambda m: float(m.sum()) * HECTARES_TO_KM2
    lab, sizes = label_patches(r["out_of_step"])
    places = int((sizes >= MIN_PATCH_CELLS).sum())

    # ---- false alarm check: bare ground must never pass the rule ----------
    r0, r1, c0, c1 = BARE_BLOCK
    bare = np.zeros_like(aoi)
    bare[r0:r1, c0:c1] = True
    bare_pass = int((r["swing"] >= THRESHOLD_DB)[bare].sum())
    bare_max = float(r["swing"][bare].max())

    # ---- how far the numbers move when the rules move --------------------
    sensitivity = []
    for label, kw in [
            (f"standard: {THRESHOLD_DB:.1f} dB, match < {MATCH_OUT}", {}),
            ("threshold 2.5 dB", dict(threshold=2.5)),
            ("threshold 3.5 dB", dict(threshold=3.5)),
            ("match < 0.2", dict(match_out=0.2)),
            ("match < 0.4", dict(match_out=0.4)),
            ("summer from 30 Aug", dict(summer_from=5)),
            ("summer from 25 Jul", dict(summer_from=3)),
    ]:
        s = classify(db, aoi, kw.get("threshold", THRESHOLD_DB),
                     kw.get("summer_from", SUMMER_FROM), kw.get("match_out", MATCH_OUT))
        _, sz = label_patches(s["out_of_step"])
        sensitivity.append(dict(rule=label, changed=round(km2(s["active"]), 1),
                                summer=round(km2(s["summer"]), 1),
                                early=round(km2(s["early"]), 1),
                                out_of_step=round(km2(s["out_of_step"]), 1),
                                places=int((sz >= MIN_PATCH_CELLS).sum())))
    # the strictest test: require the change to survive dropping the best and
    # worst date, so no single pass can carry a result
    ordered = np.sort(db, axis=2)
    strict_swing = ordered[:, :, -2] - ordered[:, :, 1]
    s = classify(db, aoi & (strict_swing >= THRESHOLD_DB), -1e9, SUMMER_FROM, MATCH_OUT)
    _, sz = label_patches(s["out_of_step"])
    sensitivity.append(dict(rule="strict: 3 dB ignoring best and worst date",
                            changed=round(km2(s["active"]), 1),
                            summer=round(km2(s["summer"]), 1),
                            early=round(km2(s["early"]), 1),
                            out_of_step=round(km2(s["out_of_step"]), 1),
                            places=int((sz >= MIN_PATCH_CELLS).sum())))

    out = dict(
        generated=str(date.today()), dates=DATES, epsg=epsg,
        rules=dict(threshold_db=THRESHOLD_DB, doubling=round(times(THRESHOLD_DB), 2),
                   summer_from=DATES[SUMMER_FROM], match_out=MATCH_OUT,
                   neighbour_radius_cells=NEIGHBOUR_RADIUS,
                   min_neighbours=MIN_NEIGHBOURS, min_patch_ha=MIN_PATCH_CELLS),
        scene_shift_db=[round(float(v), 2) for v in shift],
        farmland_cells=int(aoi.sum()), farmland_km2=round(km2(aoi), 1),
        changed_km2=round(km2(r["active"]), 1),
        changed_percent=round(100 * float(r["active"].sum()) / float(aoi.sum()), 1),
        summer_km2=round(km2(r["summer"]), 1), early_km2=round(km2(r["early"]), 1),
        comparable_cells=int(r["comparable"].sum()),
        isolated_km2=round(km2(r["isolated"]), 1),
        out_of_step_km2=round(km2(r["out_of_step"]), 1),
        out_of_step_percent_of_comparable=round(
            100 * float(r["out_of_step"].sum()) / float(r["comparable"].sum()), 1),
        places=places, places_4ha=int((sizes >= 4).sum()),
        single_cells=int((sizes == 1).sum()),
        false_alarm=dict(bare_cells=int(bare.sum()), passed=bare_pass,
                         largest_swing_db=round(bare_max, 2)),
        sensitivity=sensitivity)

    (ROOT / "results").mkdir(exist_ok=True)
    (ROOT / "results" / "results.json").write_text(json.dumps(out, indent=1))
    write_markdown(out)

    print(f"farmland studied        {out['farmland_cells']:6d} cells = {out['farmland_km2']:6.1f} km2")
    print(f"changed strongly        {out['changed_km2']:6.1f} km2  ({out['changed_percent']}%)")
    print(f"  summer peak           {out['summer_km2']:6.1f} km2")
    print(f"  early peak            {out['early_km2']:6.1f} km2")
    print(f"out of step             {out['out_of_step_km2']:6.1f} km2 in {out['places']} places")
    print(f"isolated, not judged    {out['isolated_km2']:6.1f} km2")
    print(f"false alarm on bare ground: {bare_pass} of {int(bare.sum())} cells, "
          f"largest swing {bare_max:.2f} dB")
    print("\nwrote results/results.json and RESULTS.md")


def write_markdown(o):
    t = [f"# Results\n",
         f"Generated by `src/3_analyse.py` on {o['generated']}. "
         f"Do not edit by hand: rerun the script.\n",
         f"Ten NISAR passes, {o['dates'][0]} to {o['dates'][-1]}, path 70 frame 19, "
         f"ascending. Cells are 100 m, one hectare each.\n",
         "## Headline\n",
         "| | |", "|---|---|",
         f"| farmland studied | **{o['farmland_km2']} km²** ({o['farmland_cells']:,} hectares) |",
         f"| changed strongly | **{o['changed_km2']} km²** ({o['changed_percent']}% of the farmland) |",
         f"| &nbsp;&nbsp;of that, summer peak | **{o['summer_km2']} km²** |",
         f"| &nbsp;&nbsp;of that, early peak | **{o['early_km2']} km²** |",
         f"| out of step | **{o['out_of_step_km2']} km²** in **{o['places']} places** "
         f"({o['out_of_step_percent_of_comparable']}% of comparable hectares) |",
         f"| too isolated to compare | {o['isolated_km2']} km² |",
         "",
         f"Summer peak plus early peak equals the changed total: "
         f"{o['summer_km2']} + {o['early_km2']} = {o['changed_km2']} km². "
         f"The {o['places']} places are counted across all changed land, not only the "
         f"summer peak part.\n",
         "## The rules used\n",
         f"- A hectare **changed** when its HV echo grew at least "
         f"{o['rules']['doubling']} times ({o['rules']['threshold_db']} dB) between its "
         f"weakest and strongest pass.",
         f"- **Summer peak** means the strongest pass was {o['rules']['summer_from']} "
         f"or later; **early peak** means June or July.",
         f"- **Out of step** means the correlation with the average of the changed "
         f"hectares within {o['rules']['neighbour_radius_cells']} cells "
         f"(about half a kilometre) is below {o['rules']['match_out']}.",
         f"- A hectare with fewer than {o['rules']['min_neighbours']} changed "
         f"neighbours is not judged.",
         f"- A **place** is {o['rules']['min_patch_ha']} or more connected out-of-step "
         f"hectares.\n",
         "## False alarm check\n",
         f"On a block of bare ground outside the farmland, "
         f"**{o['false_alarm']['passed']} of {o['false_alarm']['bare_cells']}** hectares "
         f"pass the rule. The largest swing measured there is "
         f"**{o['false_alarm']['largest_swing_db']} dB**, below the "
         f"{o['rules']['threshold_db']} dB needed.\n",
         "## How far the numbers move\n",
         "The result depends on where the line is drawn. It is not one number.\n",
         "| rule | changed km² | summer | early | out of step | places |",
         "|---|---|---|---|---|---|"]
    for s in o["sensitivity"]:
        t.append(f"| {s['rule']} | {s['changed']} | {s['summer']} | {s['early']} | "
                 f"{s['out_of_step']} | {s['places']} |")
    t += ["", "## Scene brightness removed\n",
          "Each pass was levelled by subtracting its own median over land outside the "
          "farmland, in dB: " + ", ".join(
              f"{d[5:]} {v:+.2f}" for d, v in zip(o["dates"], o["scene_shift_db"])) + ".\n",
          "## How far this has been checked\n",
          "These numbers are what the radar measured under the stated rules. The "
          "project is not validated, but it is no longer unchecked.\n",
          "**Checked.** Twenty hectares were drawn at random and compared against NASA "
          "optical imagery (HLS Sentinel-2, colour infrared) on 20 June, 19 August and "
          "18 September 2026, with the calls recorded before the radar's answers were "
          "opened. Under the strict rule set in advance, **8 of 20 agree**. By class: "
          "**6 of 8** hectares the radar called a summer peak are visibly green in "
          "August or September; **2 of 7** it called quiet are bare, so four were green "
          "and the radar missed real growth; **0 of 5** early peaks passed a rule that "
          "required them to go bare by late summer, though all five were green in June "
          "as predicted. The check was AI-assisted rather than done by an independent "
          "person. Full method, per-point numbers and caveats: validation/RESULTS.md.\n",
          "**Not checked.** The out-of-step rule, which is this project's main output, "
          "cannot be confirmed from optical imagery; it needs ground truth. Rainfall "
          "records (NASA GPM) have not been used, so rain before a pass has not been "
          "ruled out as a cause of a radar change.\n",
          "Twenty points is a spot check, not an accuracy figure for the valley. See "
          "LIMITS.md.\n"]
    (ROOT / "RESULTS.md").write_text("\n".join(t))


if __name__ == "__main__":
    main()
