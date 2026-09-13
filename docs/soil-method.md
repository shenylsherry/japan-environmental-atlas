# Soil layers — source, interpretation and validation

Implemented 2026-09-12 using [NARO Japanese Soil Inventory](https://soil-inventory.rad.naro.go.jp/).
The existing atlas now has three independent raster layers: national soil type,
surface texture and subsurface texture. All have visibility, ordering, opacity and
legends. A point query samples all three, even if their overlays are hidden.

## Nationwide type versus agricultural detail

The [official help](https://soil-inventory.rad.naro.go.jp/pdf/help.pdf), pp. 1–2,
describes a national 1:200,000 map that switches to agricultural 1:50,000 coverage
when enlarged. The current [official viewer configuration](https://soil-inventory.rad.naro.go.jp/main/static/apac/figure.js)
advertises XYZ `tile/figure/{z}/{x}/{y}.png`, z6–15. Actual samples at Takao returned
opaque forest soil at z9, 10, 11 and 12, but transparent soil at z13; z15 was 404.
Therefore this atlas caps the **national soil type** source and point query at z12.
Higher map zooms overzoom that nationwide raster rather than replace forests with
agricultural-only coverage. This is an intentional choice, not a claim that zooming
improves the 1:200,000 map's precision. Recheck the switch if the provider changes it.

Texture uses the separately published `soil_properties_upper` and
`soil_properties_lower` XYZ layers, z6–15. Their coverage is incomplete: mountain
samples can be transparent or lack a tile. The provider's names 表層 / 下層 are
preserved. **A uniform numeric depth and uniform source survey resolution have not
been established for these published layers**, so no 0–5 cm/0–30 cm labels or
metre-level survey accuracy are invented. Tile projection is EPSG:3857; query input
is longitude, latitude. The display pixel size is not ground-truth accuracy.

## Point reading and categories

NARO's own viewer queries the encoded raster palette; it does not expose a
documented standalone public point API for this integration. We use only the
published tiles and a small local snapshot of factual RGB keys, classification
codes and Japanese names from its `figureRGB.js` and `chRGB.js`. The source scripts
are not executed or bundled. There is no guessed endpoint and no profile scraping.

The browser requests three 256×256 tiles and reads one unscaled pixel from each.
Type query is fixed z12, texture fixed z15. Exact opaque RGB keys are decoded using
the official tables; soil code generalization follows NARO's z10–12 four-character
rule where a matching parent exists. The original encoded code remains in details.
The type legend lists group-level main colors; subgroup colors differ slightly.

Unlike the official viewer's unrestricted nearest-color lookup, this adapter
does not guess classes for unrecognized or partly transparent pixels. At the
Tsukuba validation point the national pixel `[138,68,0,255]` did not match a
published key; this remains **unmatched**, not an invented class. Neighbor pixels
and official-map review can help a user understand boundary or palette issues.
This conservative behavior can leave valid-looking map regions without a point
classification; it is a documented limitation of this raster integration.

Opaque black in the **texture** map means 泥炭層 (peat), while alpha=0 is nodata.
The named class 不明, a missing tile, an unmatched pixel and a network error remain
distinct. One failed texture request does not erase successfully returned soil
information. Repeated clicks cancel previous requests; no bitmap cache is retained.
Upstream 404 tiles become explicitly tagged transparent tiles for map display;
other failures remain uncached errors. Point queries retain that missing-tile tag.

## Scientific boundaries

Soil type is a classification, texture describes particle-size composition,
structure describes aggregate/horizon arrangement, and geology describes the
underlying geological unit. They are separate environmental variables. These
layers do not establish local aggregate structure, bulk density, pH, organic
matter, current moisture or measured soil temperature. No numeric property is
inferred from a class or from a qualitative texture description.

NARO also publishes water-retention/permeability products. Its help pp. 9–10
explains that values are medians grouped by prefecture/region and soil group.
Those require separate statistical-support labels and coverage checks before
integration; they are not point measurements and are not included in this release.

## Reproduction and checks

```bash
python3 scripts/soil/update_catalog.py
npm run build
npm test
python3 scripts/soil/validate_sources.py
# Force a fresh seven-sample comparison, rather than reuse hash-valid snapshots:
python3 scripts/soil/validate_sources.py --refresh
```

The catalog refresher parses only JSON-compatible data literals, validates RGB
keys, rejects conflicts, drops duplicate identical rows, and records the SHA-256
of each official source. It commits only 526 factual class records and nine texture
records, about 31 KB, not the national polygons or source application code.
Sample provenance and expected pixels are in `tests/fixtures/soil-samples.json`;
the validation command downloads at most three tiles concurrently and caches only
hash-valid responses under ignored `data/cache/soil-validation`.

| Test point | National type at z12 | Texture check |
|---|---|---|
| Takao, 35.625, 139.243 | I1 褐色森林土 | Exploratory z13 surface/subsurface pixels transparent |
| Asahidake, 43.670, 142.851 | J4z1 普通陸成未熟土 | Exploratory z13 tiles absent |
| Yakushima, 30.336, 130.505 | D5z1 普通非アロフェン質黒ボク土 | Exploratory z13 tiles absent |
| Okinawa, 26.5, 127.9 | J4z1 普通陸成未熟土 | Exploratory z13 pixels transparent |
| Tsukuba, 36.032116, 140.087325 | Unmatched pixel; no assigned class | Both z15 layers: 壌質（中粒質） |

These are reproduced map readings, not independent field validation. Exploratory
z13 texture checks are explicitly different from the app's fixed z15 point query.
The regression suite also checks nodata, opaque peat, ambiguous colors, coordinates,
source allowlisting, zoom limits, invalid payloads, partial failure and cancellation.
Full WebGL overlay/mobile device QA remains subject to the existing limitations in
[validation.md](validation.md).

For regional offline packages or future AND queries, use the official downloadable
soil polygons/texture products and versioned regional tiles. The visible raster
and its pixel classifications do not implement precise polygon intersections or
an environmental suitability score.
