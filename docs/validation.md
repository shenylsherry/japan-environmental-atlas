# Validation and Phase 1 acceptance

Run date: 2026-09-12. `validation-results.json` contains exact official responses,
coordinates, source URLs and GSI source hashes. Reproduce with:

```bash
python3 scripts/terrain/validate_locations.py
python3 scripts/terrain/parity_check.py --data-dir data
```

## Actual source/terrain integration

| Region / point | Latitude, longitude | GSI / derived elevation (m) | Slope | Downhill aspect | Original vegetation | GSJ lithology |
|---|---|---:|---:|---|---|---|
| Fuji north flank | 35.393, 138.728 | 2303.35 / 2303.35 | 27.46° | 335.07° NW | シラビソ－オオシラビソ群集 | 玄武岩 溶岩・火砕岩 |
| Fuji south flank | 35.329, 138.728 | 1983.91 / 1983.91 | 13.61° | 200.60° S | ダケカンバ群落（III） | 玄武岩 溶岩・火砕岩 |
| Takao | 35.625, 139.243 | 589.88 / 589.88 | 14.82° | 311.84° NW | クリ－コナラ群集 | 海成層 泥岩 後期白亜紀付加体 |
| Daisen | 35.378, 133.544 | 1124.92 / 1124.92 | 16.95° | 310.73° NW | クロモジ－ブナ群集 | デイサイト・流紋岩 溶岩・火砕岩 |
| Asahidake | 43.670, 142.851 | 1980.26 / 1980.26 | 29.91° | 18.65° N | 雪田荒原 | 安山岩・玄武岩質安山岩 溶岩・火砕岩 |
| Kirishima | 31.927, 130.860 | 1342.58 / 1342.58 | 14.18° | 213.25° SW | リョウブ－ミズナラ群集 | 安山岩・玄武岩質安山岩 溶岩・火砕岩 |
| Yakushima | 30.336, 130.505 | 1916.15 / 1916.15 | 35.76° | 29.71° NE | ヤクシマダケ群集 | 花崗岩 塊状 島弧・大陸 |

These are test coordinates in mountain regions, not claimed summit positions or
mushroom recommendations. Exact DEM agreement checks decoding/sampling consistency;
it is not independent elevation-accuracy validation.

## Direction sanity check

Independent 100 m north/south samples from the official DEM:

- Fuji north: north=2261.88 m, south=2337.00 m. Terrain falls toward north; local
  3×3 Horn direction NW is compatible with the north flank. East=2310.20 m,
  west=2288.85 m independently supports a western component.
- Fuji south: north=2009.50 m, south=1945.33 m. Terrain falls toward south; local
  direction S is compatible. East/west samples support a western component.

A 100 m regional contrast need not match a roughly 10 m local derivative on complex
ridges (e.g. Takao); do not change a local aspect to fit a mountain-wide label.

**Contour interpretation remains to be visually checked** on GSI standard maps for
these exact points. The above checks use height differences, not a falsely claimed
manual contour review. Field truth for terrain labels has not been collected.

## Automated checks performed

- 13 Node test cases (including built Worker asset/routing checks): coordinate round trips, eight exact compass sectors and their
  boundaries, eight analytic downhill planes, north/south conceptual tests, missing
  elevation and negative elevation, slope classes, curvature sign, multiscale ridge
  decision, tile-halo behavior, vegetation/geology normalization, MVT hole/boundary
  containment, validated upstream routing and coordinate ordering.
- 5 Python cases independently verify terrain direction, flat/nodata handling,
  ridge classification, coordinates and signed PNG decoding.
- Historical MOE integrity: 25 SHA-256 checks; 10,168 polygon fragments, 62 names.
- Real 256×256 Fuji tile: Python/JS outputs match all 11 bands. Elevation, slope,
  aspect, curvatures, terrain classes identical after float32 output; maximum
  standardized TPI difference <6×10⁻⁸; identical nodata masks.
- Seven eleven-band COGs successfully generated; rasterio reports EPSG:3857,
  DEFLATE and LAYOUT=COG. Five colorized raster products produced from a real tile.
- Resumability: rerunning completed Fuji tile logged `cached` and preserved the output.
- Live Worker adapter smoke: GSI DEM, GSI standard map, MOE PBF, GSJ tile and GSJ
  point legend each returned 200 with nonempty content. This ran under Node with
  the environment's network proxy; it is not production Cloudflare verification.

## Browser QA and limitations

### Production map outage correction — 2026-09-12

The deployed version 2 failed before every official-source fetch: Sites production
logs at 09:13:04 UTC reported `This Worker is not permitted to access the default
cache.` at `proxySource`, including `/api/geology` (request
`a2b7b446b3e8c8da752c679e1ff4771e`) and DEM/vegetation tile routes. Previous local
source checks lacked this hosting restriction and did not catch the outage.

The adapter now avoids all platform cache APIs and retains successful-response HTTP
cache headers. New compiled-Worker regression tests simulate a throwing default-cache
getter across all seven source routes, verify byte-preserving responses, strip source
cookies, and check uncached 404/429/500/network failures. There are now 15 Node tests.
Run `scripts/smoke-sources.mjs` with `KINOKO_SITE_ORIGIN` after deployment to validate
real PNG/JPEG signatures, decoded vegetation polygons and GSJ legend fields. The
README documents owner-private authentication without putting credentials in files.

### Device validation

The supervised browser loads the UI but has WebGL disabled (`Failed to initialize
WebGL`). Therefore MapLibre visual rendering, compositing, pan/zoom and map click
integration cannot be marked passed here. A graceful message keeps coordinate-based
point inspection usable. No attempt was made to disable browser security to enable GPU.

The development server's external requests initially timed out. A separate, explicitly
prepared, hash-verified set of **22 original official responses** around two Fuji points
allows worker/Canvas tests without claiming live network success. These snapshots stay
in ignored data/cache, the response header identifies fixtures, and production never
packages or serves them. The diagnostic page identifies pinned versus live GSJ data.

Browser test of Fuji north point with these fixtures returned elevation 2303.35 m,
slope 27.46°, aspect 335.07°, original MOE attributes (including 作成年度=2004),
and GSJ symbol H_vbs_al. Total local diagnostic time was 452 ms. This number excludes
remote network latency and is not a nationwide performance benchmark.

Browser worker PNG rendering also succeeded for all five layers on the same original
Fuji tile: elevation 65,536 valid pixels, slope 65,536, aspect 65,425 (111 near-flat
pixels remain transparent), curvature 65,536, terrain 65,536. Cached local rendering
ranged 27–129 ms per layer; this excludes WebGL compositing and external requests.

The 390px iframe layout was exercised: open/close layer drawer, select the Fuji north
validation location, automatically collapse controls and display terrain/vegetation/
geology in the bottom panel. This verifies responsive DOM behavior with fixtures; it
is not a physical iPhone Safari or GPS test.

## Remaining acceptance protocol

On a WebGL-capable desktop and actual iPhone Safari:

1. Load the deployed map; confirm GSI plus precise MOE polygon boundaries, not circles.
2. Visit all seven test regions plus Okinawa and Ogasawara. Check source errors/nodata.
3. Toggle every layer independently. Test 0/50/100% opacity, reorder and every legend.
4. Verify point inspection with layers hidden and with a vegetation-name filter that
   excludes the clicked class. Values must remain the original class at that point.
5. Compare Fuji north/south aspect colors and point values to labeled GSI contours.
6. Pan across a tile seam, zoom through z10→11→14→18; confirm resolution labels and
   no artificial seam bands or flat-land north directions.
7. Test mobile drawer, tap selection, coordinates, one-shot geolocation, orientation
   changes, long raw Japanese labels, 200% text scaling and permission refusal.
8. Simulate a missing tile/network failure, rapid repeated clicks and cancellation.
9. Check peak memory/pan responsiveness with vegetation plus two terrain layers;
   do not benchmark fixture-only latency as nationwide performance.

## Phase completion status

Phase 0 audit is complete. Phase 1 implementation and CPU/data tests are present,
**but its strict definition of done is not yet met** because full WebGL map/mobile
integration and contour review are not verified. Phase 2 full spatial intersection,
Phase 3 weather and Phase 4 suitability are intentionally not started. Filter-logic
and species-config parsing tests belong to those later modules and are still required.
