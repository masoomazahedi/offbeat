# Validation

A blind spot check of the radar result against optical imagery.

## How

1. Twenty hectares were drawn at random by script (fixed seed 20261114), at least 1.5 km apart: 8 summer peak, 5 early peak, 7 no clear season. The order was shuffled.
2. A team member who had **not** seen the radar verdicts opened each point in Sentinel-2 imagery near 20 June and near 20 August or September 2026 (`check_links.html`) and recorded *green*, *not green* or *unclear*.
3. Only then were the answers compared.

`points.csv` holds the coordinates. The answer key is kept out of the repository until the check is finished.

## What counts as agreement

| radar verdict | optical imagery should show |
|---|---|
| summer peak | green in August or September |
| early peak | green in late June, not green in August or September |
| no clear season | not green in either window (orchards are an expected exception) |

Twenty points is a spot check, not an accuracy figure for the valley. Results are in `RESULTS.md` in this folder.
