# Data sources and reuse ledger

Official documentation checked 2026-09-12. A returned HTTP 200 is not a nationwide
coverage guarantee. Per-request failures and nodata remain unavailable, never zero.

| Dataset | Organization / official documentation | Access actually used | Resolution / CRS / updates | Terms and attribution | Project processing |
|---|---|---|---|---|---|
| GSI standard/pale map, seamless photographs | [GSI tile catalogue](https://maps.gsi.go.jp/development/ichiran.html) | `https://cyberjapandata.gsi.go.jp/xyz/{pale,std}/{z}/{x}/{y}.png`; `.../seamlessphoto/{z}/{x}/{y}.jpg` | XYZ 256px; EPSG:3857; map z2–18 in this viewer; imagery date/resolution varies | [GSI terms](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html), currently PDL1.0 except stated exclusions. Credit 国土地理院 linked to tile catalogue. Real-time tile use is described as attribution-only in catalogue; check separate requirements for redistributed derived surveying products. | Same-origin transport; no content recoloring. |
| GSI DEM10B PNG | [DEM encoding specification](https://maps.gsi.go.jp/development/demtile.html), [catalogue](https://maps.gsi.go.jp/development/ichiran.html) | `https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png` | Nominal 10 m source, display grid z1–14; max zoom pixel spacing about 6.6–9 m across Japan does not improve original resolution; EPSG:3857; updates by source region, no fixed cadence | Same GSI terms. Credit 国土地理院 DEM; identify Japan Environmental Atlas derivation. Text DEM tiles stopped updating in October 2024, so this project uses PNG. | Signed RGB centimetres decoded; nodata retained; haloed Horn slope/aspect, Hessian curvature, multiscale TPI; optional COG and PNG. |
| 現存植生図2024 | Ministry of Environment Biodiversity Center; [official style/source definition](https://www.biodic.go.jp/kiso/vg/tile/veg2024vector/veg2024.json) | `https://www.biodic.go.jp/kiso/vg/tile/veg2024vector/{z}/{x}/{y}.pbf`; source-layer `veg2024`; z5–15 | Nationwide generalized polygon tiles; cartographic source primarily vegetation surveys, with heterogeneous survey dates/scales; local 1:25,000 context must not be promoted to uniform tree-level accuracy. Tile projection EPSG:3857; dates vary; 2024 is dataset name, not a universal field survey date. | [MOE terms](https://www.biodic.go.jp/copyright/terms_of_service.html): PDL1.0 for covered content, exceptions in [annex](https://www.biodic.go.jp/copyright/img/exhibit.pdf). Credit source and separately label project modification. Vegetation is not among the listed excluded content. | Unchanged PBF transport, name-based display groups, point-in-polygon query with raw attributes preserved. Initial HTTP checks found an incompatible `Access-Control-Allow-Origin`; same-origin Worker required. |
| 20万分の1日本シームレス地質図V2, original edition | GSJ/AIST; [API 1.3.1](https://gbank.gsj.jp/seamless/v2/api/1.3.1/) | `.../tiles/{z}/{y}/{x}.png?layer=g`; `.../legend.json?point=LAT,LON` | Scale 1:200,000; raster XYZ EPSG:3857 z0–13; geographical point input; no claim of metre-level boundary accuracy; revisions irregular | [Seamless map reuse page](https://gsj-seamless.jp/seamless/agreement.html) specifies Government Standard Terms 2.0 and source credit; modified secondary reuse allowed without application. Credit 20万分の1日本シームレス地質図V2（©産総研地質調査総合センター）; retain original edition indication. | Original colors/symbol/age/lithology retained; additional conservative name normalization. No reverse inference of class from raster RGB. |
| JMA weather | Japan Meteorological Agency | **Not connected in Phase 1** | Station/grid product and update cadence must be established in Phase 3 | Product-specific access/redistribution conditions not yet verified; no assumed free production API | No fabricated station, precipitation or soil-temperature data. |
| Roads/trails and land use | GSI base-map display / MOE source polygons | Displayed only where present in those sources | Not a routed trail network or access-rights dataset | Same dataset-specific terms; future OSM would need its own ODbL review and attribution | No road/trail distances, landownership or collection permission inferred. |

## Request limits and cache

No numerical request quota was found in the cited MOE/GSJ documentation. This does
not authorize unlimited bulk extraction. Worker routes allow only fixed official
sources, validated tile ranges or bounded Japan point coordinates. 20-second upstream
timeout; 8 MB response ceiling; successful public responses cache for one day.
Browser terrain worker limits simultaneous DEM fetches to four and retains bounded
raw/derived tiles. The pipeline defaults to at most 256 terrain or 64 vegetation tiles
per invocation. For country-wide offline production, coordinate a bulk distribution
and service terms strategy rather than mirror the interactive servers indiscriminately.

## Accuracy and licensing boundaries

Raw MOE names and GSJ legend records remain available in the point panel. Normalized
groups are project additions, not official ecological predictions. Source layers have
different effective resolutions and temporal support. Raster alignment alone does not
make a 1:200,000 geology boundary equally precise as a 10 m terrain derivative.

The MOE terms annex specifically excludes some protected-area GIS datasets. Therefore
protected-area data is deferred pending its separate terms review. No such layer or
permission inference is silently included.
