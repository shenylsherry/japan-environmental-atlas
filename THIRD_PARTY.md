# Third-party software

- MapLibre GL JS 4.7.1, retained vendor assets: BSD-3-Clause.
  https://github.com/maplibre/maplibre-gl-js/tree/v4.7.1
- Vite 7.3.1 (development server): MIT; transitive dependencies recorded in package-lock.json.
  https://github.com/vitejs/vite
- NumPy (BSD-3-Clause), SciPy (BSD-3-Clause), Pillow (MIT-CMU), rasterio (BSD-3-Clause):
  optional offline Python preprocessing dependencies, not bundled in the browser.

Dataset attribution and terms are separate: docs/data-sources.md.

- NARO Japanese Soil Inventory factual soil class / texture palette records in
  `dist/gis/soil-catalog.mjs`: derived from published soil map lookup tables.
  Credit 農研機構日本土壌インベントリー（NARO, Japanese Soil Inventory）;
  released digital soil maps CC BY 4.0. Source URLs and hashes are embedded in
  that generated catalog. Original application JavaScript is not bundled.
