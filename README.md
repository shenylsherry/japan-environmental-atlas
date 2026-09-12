# Kinoko Map Japan

> Published to GitHub on 2026-09-12. Live public map: https://kinoko-map-japan.workspace-828684.chatgpt.site/
> This application snapshot comes from source commit `ff8fa332b1eda13705659d71ed22414657db8dc9`. The repository retains its existing MIT LICENSE and initial commit. Original development history remains in the existing Site source repository; the audit and phase reports below describe the earlier implementation checkpoints, including the former GitHub access limitation.

Japan-wide environmental GIS for inspecting vegetation, bedrock and DEM-derived
terrain. This is an in-place upgrade of the existing Kinoko Map; MapLibre and its
framework-free JavaScript UI are retained. **No matsutake occurrence probability or
habitat score is calculated.**

Phase 0 audit and Phase 1 implementation are included. Phase 1 acceptance is pending
full WebGL map rendering and real iPhone verification; see [validation](docs/validation.md).
Phases 2–4 (complete environmental intersections, JMA weather, species scoring) are
not advertised as implemented. Existing vegetation-name filters and the larch host
preset are preserved and are clearly distinct from complete spatial filtering.

## Architecture

- MapLibre GL JS 4.7.1 (retained), ES-module UI, responsive layer drawer/point panel.
- Small Cloudflare-compatible Worker serves the static assets and a strict official
  data proxy. MOE cross-origin restrictions require the same-origin adapter.
- Nationwide MOE vector tiles, GSJ raster tiles + independent legend queries.
- Dedicated browser worker reads only needed GSI DEM tiles, derives continuous
  variables and PNG overlays; bounded memory and request concurrency.
- Python regional processing produces eleven-band COGs, logs, hashes and resumable
  source manifests. No national GeoJSON or raw DEM is loaded into browser memory.

See [architecture and migration](docs/architecture.md), [data/terms ledger](docs/data-sources.md),
[terrain definitions](docs/terrain-method.md), [validation](docs/validation.md).

## Install and develop

Node ≥24.5 (includes environment-proxy support); npm. Python ≥3.10 for optional terrain
preprocessing. A WebGL-capable browser is required for the interactive map.

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 5173
```

Open the local URL printed by Vite. No API keys are needed. `.env.example` documents
optional data paths; never commit `.env` or credentials. The old bare static-server
command is insufficient for nationwide data because it has no `/api` adapter.

The development browser can use `/validation.html` for independent terrain/image
checks. It does not replace map integration QA. If the development sandbox lacks
outbound networking, the optional source-hashed validation fixtures described below
allow checking CPU/Canvas calculations; production never uses these fixtures.

## Use

- Pan/zoom anywhere in Japan, or choose 日本全国 on desktop. On mobile, pinch/zoom out
  or enter a coordinate / choose a validation region from the layer panel.
- Independently toggle, reorder and adjust all map layers. Top panel rows render above
  lower rows. GSI pale/standard map or aerial imagery can be selected as the base.
- Tap a location for elevation, slope, downhill aspect, provisional terrain class,
  original vegetation properties and GSJ symbol/lithology/age. Hidden or filtered
  vegetation remains independently queryable at the selected point.
- Terrain overlays appear at z11+. Point terrain queries always use z14; aspect on
  near-flat land is undefined. Display overzoom does not improve source precision.
- 定位 requests GPS once, only when pressed. It does not start continuous tracking.

## Preprocess and build tiles

```bash
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r scripts/terrain/requirements.txt
python3 scripts/terrain/process.py --bbox 138.725 35.391 138.729 35.394 --dry-run
python3 scripts/terrain/process.py --bbox 138.725 35.391 138.729 35.394
python3 scripts/build_tiles/colorize.py data/processed/terrain-1.0.0/14/14505/6467.tif
python3 scripts/vegetation/cache_tiles.py --bbox 138.725 35.391 138.729 35.394
```

`--force` regenerates products from source cache; `--refresh` downloads updated source
bytes, including retrying cached 404s. A completed COG has an atomic JSON manifest;
resuming skips only hash-valid outputs. Regional batches are capped by default. See
[data lifecycle](data/README.md). Offline packages are a future capability.

## Test and build

```bash
npm test
npm run test:terrain
python3 verify-data.py
npm run build
node --use-env-proxy scripts/smoke-sources.mjs
python3 scripts/terrain/validate_locations.py
```

The smoke and location commands require external official services; the unit suite
uses synthetic planes and the inherited source-hashed MOE fixture. Optional browser
fixtures, after the real location validation has downloaded data:

```bash
python3 scripts/prepare-browser-fixtures.py --data-dir data
```

This prepares 22 exact official responses around two Fuji points under ignored
`data/cache/browser-fixtures`. Vite explicitly tags fixture responses; remove that
folder to return to exclusively live development requests. The production Worker
never reads this directory. The full acceptance protocol is in docs/validation.md.

## Deployment

`npm run build` produces the Cloudflare Workers-compatible ESM entry
`dist/server/index.js` with embedded frontend assets plus `dist/.openai/hosting.json`.
This preserves the existing Site identity. Deploy that built version with Sites;
source is committed and pushed before packaging. Generated Worker output, caches and
raw national data are excluded from Git. The browser diagnostics page is included
as a reproducible development tool, but requires live APIs on deployment.

For a reported map-source failure, inspect production Worker logs and run the payload
smoke checks against the deployed origin (a local adapter check alone cannot detect
hosting restrictions):

```bash
KINOKO_SITE_ORIGIN=https://kinoko-map-japan.workspace-828684.chatgpt.site node --use-env-proxy scripts/smoke-sources.mjs
```

For this owner-private Site, provide its authorized access token as the process
environment variable `KINOKO_SITE_TOKEN`; never save it in Git. The check sends it
only to that origin, does not follow redirects, and prints no credentials. All seven
routes must return valid PNG/JPEG, decodable vegetation PBF or GSJ legend JSON.
The Worker uses HTTP response caching without requesting the restricted default cache.

The repository initially had no Git remote. Connected GitHub listing/search exposed
no repositories. **GitHub synchronization is not established.** The existing Site's
source repository is separate from GitHub; no GitHub owner or successful GitHub push
is inferred. `.github/workflows/ci.yml` is ready for a connected GitHub repository.

## Limitations

- Full WebGL map integration and physical iPhone QA are still outstanding.
- DEM10B has source-specific coverage/nodata; source service failures remain visible.
- Geology's 1:200,000 scale is much coarser than terrain; it does not establish
  parcel-scale bedrock or soil chemistry. Vegetation map class is not a tree inventory.
- Curvature is noise-sensitive; multiscale position labels are provisional, not a
  field-validated terrain taxonomy. No biological rules are embedded in them.
- Lower-zoom terrain is scale-dependent. A later filter service must use a fixed
  common grid, with uncertainty/coverage masks and AND semantics across variables.
- JMA observations, mountain interpolation, soil-temperature estimates, ecological
  weights, access rights, protected-area data and offline navigation are not active.

Original local snapshot documentation: `dist/data-manifest.json`, `fetch-data.py`,
`verify-data.py`. MapLibre license notice: THIRD_PARTY.md.
