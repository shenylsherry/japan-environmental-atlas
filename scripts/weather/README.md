# Phase 3 weather design — not active

No unverified JMA endpoint is wired to the product. A separately scheduled ingestion
job must establish access conditions and operational data format before rollout.
Retain station IDs, altitude, observation/ingestion times, quality flags and missing hours.
Accumulate 3/7/14/21-day rainfall only when completeness criteria are met. Missing is
not zero. Air-temperature summaries and recent trends use consistent local-day windows.

Mountain estimates: fit temperature versus station elevation (season/location-specific,
not a universal fixed lapse rate), interpolate residuals with bounded spatial support,
then adjust to DEM elevation. Leave-one-station-out validation and elevation-extrapolation
flags are required. For rainfall, account for orographic exposure and demonstrate
skill beyond nearest-station values; sparse regions remain unavailable.

Estimated soil-temperature condition must be a calibrated lagged/smoothed thermal
model with explicit forest-cover and depth assumptions and uncertainty intervals.
Air/soil values are separate fields; no generic air-temperature threshold is presented
as measured soil temperature. Only after validation may a species profile reference it.
