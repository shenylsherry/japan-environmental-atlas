# Terrain method v1.0.0

Raw elevation → continuous terrain variables → display categories. No biological rule
occurs in this module. Browser and Python implementations are tested independently.

1. Decode official DEM10B PNG: unsigned RGB integer v; v=2^23 is missing, otherwise
   h=v/100 below 2^23 and h=(v−2^24)/100 above. Alpha=0 is missing. Decode PNG without
   display color-space conversion. Input/output float32; intermediate sums float64.
2. Gather a 64-pixel halo from surrounding XYZ tiles. Derive the central 256×256 only.
   z11–14 is supported; 64 pixels exceed the 350 m half-width at all Japanese z14
   latitudes. Use row-dependent spherical Mercator ground spacing
   `2π6378137 cos(latitude) / (256 · 2^z)`. This approximates the ellipsoidal ground
   metric; it is not geodetic sub-percent distance calibration.
3. Horn weighted 3×3 differences give p=dz/dEast, q=dz/dSouth.
   Slope = atan(sqrt(p²+q²)). Downhill azimuth = atan2(−p,q), wrapped into [0,360).
   A north-facing slope gets q>0 because terrain rises toward south. Missing any of
   the nine neighbors makes the derivative missing; no interpolated fake coast edges.
4. At slope <2° mark aspect undefined. This is a **display/stability threshold**, not
   an ecological cutoff. Sector boundaries are ±22.5° around each compass direction.
5. Second differences r=zxx, t=zxy, u=zyy. Convex-positive Laplacian curvature=−(r+u).
   Profile curvature=−(p²r+2pqt+q²u)/[(p²+q²)(1+p²+q²)^1.5].
   Plan curvature=−(q²r−2pqt+p²u)/(p²+q²)^1.5. Units m⁻¹; plan/profile undefined at
   zero gradient. Conventions differ among GIS packages, so sign/definition metadata
   must travel with the products. Curvature is noise-sensitive at 10 m support.
6. For square neighborhoods with half-widths approximately 75 m and 350 m, compute
   TPI = center elevation − local mean and standardized TPI = TPI/local SD. Include
   the center. A nearly constant window (SD<0.01 m) gets standardized TPI=0.
   Require ≥95% valid pixels in each window. Actual windows round to integer pixels;
   these scales are configurable geometry settings, not ecological thresholds.
7. Provisional terrain classes in precedence order: ridge if large standardized
   TPI>1 and small>0.5; valley if large<−1 and small<−0.5; upper convex slope if
   large>0.35, small>0 and profile curvature>0; lower concave slope uses opposite signs;
   flat if slope<2 and both standardized |TPI|<0.35; otherwise midslope. Unknown is
   separate from flat. At a numerically zero gradient, convexity supplies the otherwise
   undefined profile sign. These are explicitly **project heuristic classes**.

[Weiss TPI poster](https://www.jennessent.com/arcview/TPI_Weiss_poster.htm) motivates
multiscale position rather than curvature-only ridge detection. The exact scales,
thresholds and class rules above are this project's provisional variant; they are not
a validated reproduction of Weiss or an empirical habitat model.
[GDAL aspect documentation](https://gdal.org/en/stable/programs/gdal_raster_aspect.html)
provides the conventional downhill azimuth and Horn gradient reference.

## Known precision limits

Use z14 for comparisons/filtering. z11–13 summaries are independently derived from
coarser DEM tiles and can change classifications, so do not compare their classes as
if all zooms use identical support. Point queries are always z14. Curvature has no
additional denoising in v1; uncertainty and threshold sensitivity must be investigated
before ecological interpretation. Square-window TPI is directional compared with a
circular kernel. Summit/flat terrain and mixed coastal windows require particular care.

COG band order is in each manifest. Nearest-neighbor overviews preserve aspect and
class values; arithmetic averaging of aspect across north is prohibited.
