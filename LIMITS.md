# Limits

What this project cannot tell you, stated plainly.

- **Not validated, but spot-checked.** Twenty random hectares were compared against NASA optical imagery (HLS Sentinel-2), blind: 8 of 20 agree with the radar under the strict rule set in advance. Summer peaks hold up best (6 of 8 are visibly green), while 4 of the 7 hectares the radar called quiet were in fact green, so the method misses real growth. The out-of-step rule itself cannot be checked this way and remains unverified, and rainfall records have not been used. Full method and per-point numbers: `validation/RESULTS.md`.
- **A radar change says something changed, not why.** "Water was brought to this field" is a hypothesis. The page labels it as one.
- **The numbers move with the rule.** 53.7 km² at the standard threshold, 34.2 km² at 3.5 dB, 84.8 km² at 2.5 dB, and 22.4 km² if the single best and worst passes are ignored.
- **Grey does not mean no farming.** Orchards and vineyards look much the same to the radar all summer and stay grey; the spot check caught exactly this case at one point, 84% vegetated on every date with almost no seasonal change. Land harvested before the first pass on 19 June is grey because the crop was never seen.
- **An area that fails together is invisible.** If every field in a district lost its water, none would differ from its neighbours and nothing would be flagged.
- **One season.** There is no earlier year to compare with, so "normal" is unknown.
- **No ground data exists for Herat.**
- **Provisional data.** The NISAR products used are marked provisional by NASA.
- **Hectares are not independent.** The radar's true resolution is coarser than its 10 m pixel spacing, so neighbouring cells share some signal.
- **One pass is missing.** 6 August is not in the archive and is not interpolated.
- **The onboard version is a design.** It runs in a browser. NISAR does not host outside software.
- **No individual farms or people.** The smallest unit shown is one hectare.
