# Japan Environmental Atlas

English: Japan Environmental Atlas  
Japanese: 日本自然環境アトラス  
Chinese: 日本自然环境地图集

Repository: https://github.com/shenylsherry/japan-environmental-atlas

The project presents multiple authoritative environmental maps together for different
purposes, including nature observation, hiking preparation, ecological surveys and
geography learning. It continues the existing application formerly named Kinoko Map
Japan. A change of identity does not change the precision or interpretation of its data.

## Product boundaries

| Responsibility | Current state |
| --- | --- |
| Japan-wide tiled basemaps, vegetation and geology | Implemented |
| Layer visibility, opacity, ordering and legends | Implemented |
| Point inspection with original attributes and source attribution | Implemented |
| DEM-derived elevation, slope, downhill aspect, curvature and terrain position | Implemented; terrain classes remain provisional |
| Regional reproducible terrain processing | Implemented |
| Combined environmental AND filtering | Planned; vegetation-name filtering is not this feature |
| Weather layers and mountain interpolation | Planned |
| Purpose-specific habitat or other interpretation models | Optional future extensions |

## Keep environmental information separate from interpretation

1. Source adapters preserve official classes and provenance.
2. GIS processing derives continuous environmental variables and explicit categories.
3. General filters operate on those variables, independently of the user's purpose.
4. Optional profiles may interpret filtered environments with documented assumptions.

The existing ハナイグチ / カラマツ selector remains available in the collapsed
**专题预设（可选）** section. It only selects vegetation names containing カラマツ.
It is not a distribution model, suitability assessment or probability estimate.
The main point panel describes environmental data rather than reserving a species score.

## Compatibility and validation

The original map APIs, algorithms, source attributes, fixtures and application controls
are retained. Legacy preference keys and cache-retirement prefixes remain unchanged
so returning users retain their layer settings. The existing public Site URL is retained.
The web manifest, package metadata, visible attribution and documentation use the new name.

The broader product scope does not resolve earlier WebGL/device and terrain validation
gaps; see [validation](validation.md). Historical audit reports retain the earlier
species-focused project context and are not statements of the current product scope.
