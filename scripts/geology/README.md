# GSJ adapter
Runtime: `worker/sources.mjs`, route `/api/geology?lat=...&lon=...`.
Point normalization: `dist/gis/normalize.mjs`. The original object is retained.
Validation: `python scripts/terrain/validate_locations.py` also records GSJ symbols,
rock names and ages for the same geographic points.

National Phase 2 geology filtering cannot use colors sampled from the display raster.
Obtain GSJ's vector distribution, record its version/CRS/terms, tile it regionally,
and rasterize original symbols onto the analysis grid. Do not infer polygons from
API point sampling. No such national analysis dataset is claimed in Phase 1.
