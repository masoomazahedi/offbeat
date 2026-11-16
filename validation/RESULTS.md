# Validation results

A blind spot check of the OFFBEAT radar result against NASA optical imagery,
completed 15 November 2026. The method is described in `README.md` and the
twenty points are in `points.csv`.

**Headline: 8 of 20 points agree with the radar under the strict rule set in
advance. The check is more useful for what it shows about each class than for
that single number.**

## How the check was done

Twenty hectares were drawn at random by script (fixed seed 20261114), at least
1.5 km apart. For each one, NASA Worldview was opened at three dates in the
HLS Sentinel-2 colour infrared layer (20 June, 19 August and 18 September 2026)
with a pin on the exact hectare. Greenness was measured, not eyeballed:
`(NIR − red) / (NIR + red)` averaged over a 100 m box at the pin, with the
surrounding 1.4 km measured for comparison. Above about +0.25, with at least
60% of the box vegetated, counts as green; at or below +0.12, or under 25%
vegetated, counts as not green; between the two is unclear.

The calls were recorded in `points.csv` before the radar's answers were opened.
They were made by Claude, an AI model made by Anthropic, from screenshots taken
by the project author. This is weaker than an independent human checker, because
the same assistant helped build the method; it is recorded here as a limitation,
not glossed over.

## What agrees, by class

| radar said | points | agree | what the imagery shows |
|---|---|---|---|
| summer peak | 8 | **6** | mostly right: 6 of 8 are visibly green in August or September |
| no clear season | 7 | **2** | 4 of the 7 are visibly green: the radar missed real growth |
| early peak | 5 | **0** | all five are green in June as predicted, but still green later |
| **total** | **20** | **8** | |

## What this means

- **A summer peak flagged by OFFBEAT is usually real.** Six of eight such
  hectares are green in the optical imagery when the radar says they should be.
  This is the claim the project leans on, and it mostly holds.
- **OFFBEAT under-detects.** Four of the seven hectares it called "no clear
  season" were plainly green. Grey on the map does not mean bare ground. The
  radar swing at those points was small (1.2 to 2.2 dB), below the 3 dB rule,
  so the fields changed too little in L-band HV for the rule to fire.
- **The early-peak test failed as written, not necessarily in substance.** The
  rule required a point to be green in June and *not* green in August or
  September. All five were green in June, so the first half held every time; but
  none went fully bare afterwards. Points 12 and 19 did fade markedly
  (+0.36 → +0.24, +0.49 → +0.35) while their neighbours held or rose, which is
  the shape of an early crop. A threshold written as "fades relative to its
  neighbours" rather than "goes bare" would likely pass several of these. The
  rule was fixed before the check and has not been changed afterwards; it is
  reported as it was.
- **Two points are informative beyond the score.** Point 15 is 84–85% vegetated
  on every date while its surroundings sit at +0.18, which looks perennial, an
  orchard or vineyard. `LIMITS.md` predicts exactly this case: an orchard holds
  steady and so never passes a change rule. Point 20 is bare in the imagery but
  carries the largest radar swing in the sample (7.46 dB), a reminder that a
  radar echo can grow for reasons other than a crop.

## What this check cannot say

- It does not test the "out of step" rule, which is the project's main output.
  No optical image can confirm whether a field's timing differed from its
  neighbours; that needs ground truth.
- Twenty points is a spot check, not an accuracy figure for the valley.
- One hectare is roughly three Sentinel-2 pixels across, so a reading can be
  pulled by a field boundary inside the box.
- Dates were the nearest cloud-free pass to each target date, not the radar
  pass dates, so a fast-changing field can be caught at a different moment.

## Honest summary for the project

OFFBEAT finds real summer growing seasons more often than not, and misses a
meaningful share of growth that is visible from space. It should be read as a
tool for deciding where to look first, not as a map of which fields are farmed.
