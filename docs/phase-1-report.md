# Engineering report — Phase 0 / Phase 1

**Phase 0 complete; Phase 1 implementation delivered with acceptance gaps.**

1. Implemented: nationwide tile-source routing; independent elevation/slope/aspect/
   curvature/terrain overlays; original MOE polygon inspection; GSJ legend/age/rock
   queries; layer controls, legends, reorder, one-shot location, mobile drawer and
   coordinate inspector; reproducible Python COG/PNG processing and source manifests.
2. Main files: dist/app.js, dist/index.html, dist/styles.css, dist/gis/*,
   worker/sources.mjs, scripts/terrain/*, scripts/vegetation/*,
   scripts/build_tiles/*, tests/*, docs/*, README.md, package.json/package-lock.json,
   vite.config.js and .github/workflows/ci.yml. Existing local vegetation corrections
   and fixtures were preserved in a separate initial commit.
3. Architecture: retain MapLibre and modular JavaScript. Add a small Worker for strict
   official source transport and a dedicated browser compute worker. Keep continuous
   terrain, rendering, filtering design and future species interpretation independent.
4. Sources actually queried: GSI DEM10B PNG and standard tiles; MOE veg2024 PBF;
   GSJ Seamless V2 1.3.1 tiles and point legend API. JMA is not connected.
5. Local commands: npm ci; npm run dev; npm run build; npm test;
   python3 -m pip install -r scripts/terrain/requirements.txt;
   npm run test:terrain. See README for exact preprocessing invocations.
6. Validation: 15 Node + 5 Python tests; 25 historical source hashes; seven real
   location queries; 11-band JS/Python parity; COG output and resume; live adapter
   responses; browser terrain/Canvas tests on explicitly labeled official snapshots.
7. Limits: testing browser has WebGL disabled, so complete map compositing, panning,
   map-click integration and physical iPhone usability remain unverified. Manual
   contour checks and field truth are outstanding. Pipeline is regionally resumable,
   but no national precomputed environmental-analysis store has been generated.
   At the original audit, GitHub exposed no repositories. This access issue was later resolved;
   current code is published in shenylsherry/japan-environmental-atlas.
8. Next gate: complete Phase 1 GPU/device/contour checks before Phase 2. Then build
   a common-grid, server-side AND filter producing candidate tiles with explicit
   nodata/coverage. Species config, weights and JMA/thermal inference remain later work.

Licensing: MOE's current PDL1.0 source/modification attribution is included. GSI source
and derived-product credit is included. GSJ original edition is credited. Separate
protected-area terms and bulk national redistribution/access conditions remain to be
reviewed before adding those data or mirroring interactive tile services at scale.

2026-09-12 outage correction: production version 2 exposed a forbidden default-cache
access that local checks missed. `worker/sources.mjs` now relies on HTTP cache headers
and bounded browser caches; compiled-Worker regressions and a deployed-origin payload
smoke check were added in `tests/build.test.mjs` and `scripts/smoke-sources.mjs`.
See docs/validation.md for the production error evidence and regression procedure.
