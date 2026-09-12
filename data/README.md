# Data lifecycle

Do not commit raw national data, generated tiles, caches or COGs.
`raw/`, `cache/`, `processed/` and `tiles/` are ignored. Terrain jobs are bounded by
XYZ z11–14 blocks; finest viewer level is z14. Original resolution remains nominal
10 m even where a Mercator display pixel is smaller. Use a z14 analysis grid for
comparisons; lower zooms are visualization overviews and can classify differently.

The inherited 25 vegetation PBFs in `dist/tiles` (~1 MB) remain as a historical,
source-hashed test fixture. Runtime no longer uses them, and Worker packaging excludes
them. `dist/data-manifest.json` is explicitly the historical local snapshot, not a
national coverage manifest.

```
python3 -m pip install -r scripts/terrain/requirements.txt
python3 scripts/terrain/process.py --bbox 139.24 35.62 139.25 35.63
python3 scripts/build_tiles/colorize.py data/processed/terrain-1.0.0/14/X/Y.tif
python3 scripts/vegetation/cache_tiles.py --bbox 139.24 35.62 139.25 35.63
```

Use `--dry-run` to estimate a terrain batch, `--force` to regenerate a product from
cached DEM, `--refresh` to refetch sources including earlier 404s. Successful products
have hash-checked atomic manifests; failed tiles are logged and retried by rerunning
the command. Existing outputs without matching hashes are regenerated.

Coordinate system: official tile scheme/Web Mercator EPSG:3857; query lon/lat
EPSG:4326. Before any future polygon/raster alignment, inspect the actual native
geographic CRS/datum from its supplied metadata. Do not assign an assumed CRS to
shapefiles. Local metre spacing for derivatives is cos(latitude)-corrected Mercator;
this is a spherical approximation, not a national conformal distance standard.
