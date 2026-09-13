# Architecture — audit and migration

Audit: 2026-09-12. Existing project retained at `/workspace/sites/japan-mushroom-map`.
Site identity and Git history are preserved. Initial Git commit: 439d72b. There were
uncommitted vegetation corrections before this work; they are preserved in history.
No AGENTS.md, package manager, package manifest, API, CI, tests, backend or Git remote
was present. Connected GitHub repository search and listing returned no repositories;
GitHub synchronization was not established at that audit checkpoint.

## Current product scope

The current product is **Japan Environmental Atlas / 日本自然環境アトラス**,
a general-purpose map viewer for layered terrain, vegetation, geology and soil exploration.
Canonical GitHub repository: https://github.com/shenylsherry/japan-environmental-atlas.
The earlier audit below records conditions before GitHub publication; that historical
access blocker has been resolved. The existing public Site identity and URL remain.

Core responsibilities: authoritative data transport, tiled rendering, point queries,
continuous derived environmental variables and future general environmental filters.
Species-specific or other purpose-specific interpretations belong to optional profiles,
not the application identity or GIS calculations. The inherited larch-name preset is
retained in a separate optional UI section. See [product scope](product-scope.md).

## Existing architecture
Authored static `dist/index.html`, `dist/app.js`, vendored MapLibre GL JS 4.7.1.
25 original MOE z13 vegetation PBFs around Takao/Jinba, raw attributes, name filters,
larch host preset, GSI pale/standard basemaps, one-shot location and mobile drawer.
A cache-retirement service worker prevents the older invented prototype data persisting.
No DEM or suitability logic. Zoom locked to 13–17; no national data coverage.

Baseline executed: HTTP requests to index, app and PBF returned 200; node syntax
check passed; verify-data.py passed 25 hashes and 10,168 polygon fragments / 62 names.
Initial supervised preview failed because package.json was absent. Browser rendering
was not yet verified at this audit checkpoint.

## Decisions
Preserve MapLibre and existing framework-free UI rather than introduce a React rewrite.
Split frontend into ES modules; add small npm development/build/test commands.
Retain all original vegetation properties and working vegetation filters/preset.
Serve official MOE national vector tiles, never national GeoJSON. Verified source style
uses z5–15. MOE currently returns an incompatible CORS origin, so route these tiles
through a strict same-origin official-source adapter. Successful responses carry
HTTP cache headers; DEM computation uses bounded browser caches. Sites does not grant
access to the default Worker cache, so the adapter never uses `caches.default`.
GSJ API 1.3.1 supplies raster visualization and independent point legend queries.
GSI DEM10B PNG z1–14 is the terrain master. Decode signed centimetres, preserve nodata.

## Phase 1 runtime
Browser → viewport tiles → official-source adapter → GSI/MOE/GSJ/NARO.
A dedicated worker derives terrain from haloed GSI DEM tiles, never blocking the UI.
Point queries always use z14 DEM and a z15 vegetation polygon containment test,
independent of visible layer opacity/filter/zoom. GSJ point coordinates are latitude,
longitude; tile URL order is z/y/x. Display original class and conservative normalization.
Views below z11 show terrain as unavailable-at-this-zoom; analysis retains useful local
resolution at z14. Overview slope/terrain are explicitly scale-dependent, not survey data.
The proxy is implemented as a small Cloudflare-compatible ESM Worker. A deterministic build embeds the small frontend assets; Vite is only the development server. No weather or biological score is fabricated. Layer order and opacity are device-local.

Soil integration adds three NARO raster layers and independent fixed-zoom pixel
queries. National type stops at z12 to retain mountain coverage; texture samples use
z15 with explicit gaps. `soil-client.mjs` samples three tiny Canvas regions without
waiting for terrain computations, then closes bitmaps. `soil.mjs` decodes only exact
official palette keys. The roughly 31 KB catalog contains factual attributes, never
national geometry. Invalid/missing/unknown values stay distinct; no measured physical
properties or ecological interpretations are synthesized. See [soil method](soil-method.md).

## Preprocessing / later migration
Python tile batches cache official DEMs, derive continuous elevation/slope/aspect,
profile/plan curvature and two-scale TPI; write georeferenced COGs and provenance.
Fixed XYZ processing units with halo prevent seam derivatives; versioned algorithms,
atomic output and content manifests support resuming/regenerating regions.
Phase 2 must rasterize authoritative polygons onto a common analysis grid in regional
jobs. Server evaluates AND across variables (OR within a categorical selection), stores
query hashes and returns candidate raster/vector tiles. Missing data fails closed.
It must not classify sampled points or filtered vegetation polygons as a completed
national environmental intersection. No nationwide raw GIS payload enters a browser.

Phase 3 weather: ingest licensed JMA sources only after operational access verification;
interpolate station residuals relative to an elevation trend, cross-validate withheld
stations, preserve distance/elevation/support uncertainty. Thermal inference remains
estimated soil-temperature condition. Phase 4 species rules are separate versioned
configuration with visible weights, evidence and uncertainty; unreviewed profiles disabled.

Offline future: versioned regional packages of terrain COGs/tiles and vegetation/geology
PMTiles plus a manifest. No unbounded service-worker tile cache in Phase 1.
