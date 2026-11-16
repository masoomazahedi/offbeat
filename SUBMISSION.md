# Submission text

Draft text for each field of the Space Apps project form. Numbers come from `RESULTS.md`; update them here if the script is rerun.

## Project name

OFFBEAT

## High-level project summary

Around Herat, Afghanistan it does not rain in summer, so farmland only has a summer growing season if someone brings water to it. OFFBEAT reads ten NISAR L-band radar passes from June to October 2026 and shows, hectare by hectare, where a season happened and which patches grew on a different timetable from the fields beside them. Of 435 km² of farmland, 54 km² changed strongly, 33 km² of it with a summer peak, and 163 places moved differently from their neighbours. The result is a short list of places to look at first, for survey teams who today collect this information household by household. The page shows every measurement behind every verdict and states its own limits.

## Link to project demo

https://masoomazahedi.github.io/offbeat/demo.pdf

## Link to final project

https://masoomazahedi.github.io/offbeat/

Source code: https://github.com/masoomazahedi/offbeat

## Detailed project description

**What it does.** A single web page with a zoomable map of the Herat valley. Each coloured square is one hectare: grey where the radar saw no real change, green where a season followed the neighbouring fields, orange where it did not, purple where there was nothing to compare with. Clicking a hectare shows its ten measurements, a chart against its neighbours, and a verdict split into what was measured, what was calculated and what is only a hypothesis.

**How it works.** Three rules. A hectare changed if its HV echo at least doubled across the season. Its season is a summer peak if the strongest pass is 18 August or later. It is out of step if its curve does not correlate with the average of the changed hectares within half a kilometre. On bare ground, 0 of 900 hectares pass the first rule.

**Dancing with the data.** The season of any hectare can be played as rhythm: fast beeps while the echo climbs, slow while it falls, a steady tick when nothing happens. A replay runs the analysis pass by pass with about 1 MB of running state and a message under 2 KB, as a design for processing on board a radar satellite.

**Benefits.** It narrows 435 km² to a list of places, works through cloud and dust, and repeats every twelve days.

**Honest limits.** The result depends on the threshold, which the page lets the viewer move. It cannot see an area that fails together, cannot tell why a patch differs, and covers one season. It is not validated: a blind spot check of twenty random hectares against NASA optical imagery agrees 8 of 20 under the strict rule set in advance, with summer peaks holding up best (6 of 8) and four of seven "quiet" hectares turning out to be green, so the method misses real growth. The out-of-step rule itself cannot be confirmed from imagery. Full method and per-point numbers: `validation/RESULTS.md`.

**Tools.** Python (numpy, scipy, h5py, pyproj, earthaccess), Leaflet, plain HTML and JavaScript. Static files, no server.

## NASA data

NISAR L-band Level-2 GCOV (geocoded polarimetric covariance), provisional products, path 70 frame 19, ten passes from 19 June to 17 October 2026, accessed through NASA's Alaska Satellite Facility with Earthdata login. HH and HV backscatter were read for the Herat window, averaged to 100 m and analysed as time series. NASA Earthdata's SAR guide informed the interpretation of the two channels. NASA Worldview was used for the validation spot check, reading the HLS Sentinel-2 colour infrared layer (Harmonized Landsat Sentinel-2, a NASA product) at twenty random hectares on three dates. NASA GPM IMERG rainfall was not used.

## Space agency partner and other data

- NISAR is a joint mission of NASA and ISRO.
- ESA Copernicus Sentinel-2 imagery, viewed for the validation spot check.
- Bazzi, H. et al. (2019). Mapping irrigated areas using Sentinel-1 time series in Catalonia, Spain. *Remote Sensing* 11(15), 1836. The neighbour comparison follows its reasoning.
- FEWS NET Afghanistan livelihood zones, for the crop calendar.
- Basemap tiles © Esri and its data providers. Leaflet map library (BSD-2).
- Python libraries: numpy, scipy, h5py, pyproj, matplotlib, earthaccess.

## Use of artificial intelligence

Yes. Claude, an AI model made by Anthropic, assisted with writing the pipeline code, the web page and the documentation, and with finding and correcting errors in the method. Each source file carries an acknowledgment in its header. The team chose the problem and place, directed the work, ran the code and is responsible for all claims. Two AI-generated illustrations are used as decoration on the web page: the sidebar image and the image behind the heading. Both carry a visible "AI-generated" watermark, are labelled as such on the page, and are not satellite imagery or photographs of Herat; no result depends on them. No other AI-generated images, video or audio are used: every figure is drawn from the data by the scripts, and the sounds are generated in the browser from the measurements.
