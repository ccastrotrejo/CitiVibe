# Weather physics: research and implementation

**Scope:** source-backed physical principles applied to the original ambient city, not a weather forecast, engineering safety model, or reconstruction of another site's implementation. Seventeen sources were retrieved and read for this research, including a bounded follow-up on canopy snow and depression storage. The source register records supporting sections and unsuccessful retrievals. No source code, artwork, models, or recordings were imported.

The useful result is a connected system: rain and snow respond to shared wind, roofs intercept precipitation, snow gains visible depth on roofs/streets/canopies, meltwater and rain feed three shallow ground pools, and vehicles remain cautious until surfaces recover. Rain intensity is adjustable from 0 to 30 mm/h. The choices below deliberately stop short of CFD, destructive weather, and a full thermal or drainage-network solver.

## Evidence and units

The repository's evidence labels remain distinct: `observed` describes inspected code, rendered output, or measured behavior; `operator-declared` describes unverified creator statements; `inferred` describes interpretation; `proposed` describes an unimplemented recommendation. A publication supporting a physical principle is not evidence that the original reference website used it.

Within this report:

| Classification | Meaning |
| --- | --- |
| Physical law | Conservation, mechanics, and optical attenuation under stated assumptions. |
| Empirical relationship | A measured correlation with a limited application range. |
| Reduced model | A simplification derived from a physical model. |
| Artistic parameter | An original, uncalibrated choice for legibility, stability, or miniature scale. |

Positions use meters, Y up; time uses seconds; velocity uses m/s; gravity is 9.80665 m/s². Temperature is °C, relative humidity is a fraction, rain is mm/h, and snow input is **mm of snow-water equivalent (SWE) per hour**. One millimeter of water over one square meter has mass 1 kg. Thus 10 mm/h for 600 seconds supplies 1.6667 mm before losses.

The world advances at 30 fixed steps per second with at most three steps per rendered frame. Particle travel and traffic use this ordinary simulation clock. **Surface accumulation, melt, drainage, and evaporation use 60 times that elapsed time.** One displayed minute represents one physical hour for these reservoirs only. This is intentional time compression, not real-time pavement drying.

## 1. Rain: measured speed, air-relative drag, and exposure

### Physical basis

NASA expresses aerodynamic drag as `Fd = 0.5 rhoAir Cd A |v-u|²` [S1]. Its direction opposes velocity relative to air, `v-u`, not necessarily motion relative to the ground. Balancing weight, buoyancy, and drag gives a terminal speed. A constant drag coefficient is not a universal raindrop model: shape and flow regime matter.

Bringi, Thurai, and Baumgardner compare measured fall velocities with laboratory-derived curves [S2]. Their Table 1 reproduces rounded expected sea-level speed intervals based on Foote and du Toit. Its endpoints provide this bounded reference:

| Diameter (mm) | 0.6 | 0.8 | 1.0 | 1.2 | 1.4 | 1.6 | 1.8 | 2.0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Expected speed (m/s) | 2.5 | 3.3 | 4.0 | 4.6 | 5.2 | 5.7 | 6.1 | 6.5 |

Section 2.2 additionally reports a mean near 2 m/s for the 0.5 mm bin in one Huntsville case. These are rounded references, not exact constants for every drop. Strong turbulence broadens observed distributions and can change their means.

### Implemented model

`rainTerminalSpeed` linearly interpolates the reference values over **0.5-2.0 mm**, including the 0.5 mm mean as a low-end anchor. Every rain particle receives one seeded diameter and terminal speed. This deliberately modest range avoids extrapolation to drizzle or very large, deforming drops. Particles enter the 52 m-high render volume already settling at terminal speed; they did not begin falling at that artificial boundary.

Linearizing quadratic drag near terminal settling gives different relaxation times:

```text
horizontal tau = vt / g
vertical tau   = vt / (2g)
vNext          = target + (vBefore - target) exp(-dt / tau)
displacement   = target dt + (vBefore - target) tau (1 - exp(-dt / tau))
```

The implementation uses those exponential velocity and displacement updates, with local wind frozen during each fixed step. This is an exact integration of the **linearized subproblem**, not an exact solution of nonlinear drag in varying wind. Large lateral gust departures, buoyancy variation, drop deformation, and altitude corrections are omitted.

Rain streak length represents a selected 0.055 s exposure interval multiplied by velocity, rather than the render frame duration. Streak thickness is an appearance choice, not literal drop diameter. Changing visible counts changes visual density, not accumulated water mass.

### Collision and shelter

The original static triangle geometry is rasterized into a 192 × 192 highest-surface grid over a 96 m square: 0.5 m cells. It is captured before actors and semantic selection volumes are attached. Rain and snow stop at the sampled roof, canopy, or ground, and respawn in fixed pools. Initial particles are placed above the local surface.

Wind-driven travel is sampled at intervals no greater than 0.25 m in either horizontal axis, rather than testing only the destination. Rain impacts reuse a 48-slot ring buffer. This is a bounded sampled **2.5D top envelope**, not exact mesh collision: tiny edges, grazing cell corners, vertical walls, undersides, layered balconies, moving actors, and wind blown under overhangs are not resolved.

The same grid masks material exposure and records surface snow retention. Collisions include the displayed snow height and water level inside filled ground pools. Covered ground does not receive the same snow layer as the roof above it. The grid does not route roof runoff into gutters or solve a separate mass reservoir for every roof.

### Source reconciliation

An early implementation used the familiar Atlas-type exponential terminal-speed fit. The original publisher full text could not be read, so its coefficients were not treated as directly verified. The final implementation instead uses the bounded table above. This avoids presenting an inaccessible original formula as verified evidence.

## 2. Snow: slow settling and small lateral motion

Snow settling depends on morphology and turbulence, not just reduced density [S3]. Experiments on rimed plate-like crystals found swinging and spiral patterns, with horizontal velocity variation around 4-15% of mean settling speed in that sample [S4]. Those results do not describe every crystal.

The original pool assigns settling speeds of **0.45-1.2 m/s**, an uncalibrated light-snow choice. It applies the same inexpensive air-relative relaxation structure as rain, not a validated aerodynamic law for snow. A deterministic 0.5 Hz sinusoid adds lateral target velocity with X amplitude 10% of settling speed and Z amplitude 6%. The resulting vector amplitude is about 11.7% of settling speed. Its phase differs by particle; no frame-by-frame random teleportation is used.

This smaller, speed-relative flutter replaced an initial fixed 0.45 m/s perturbation that could dominate a slow flake's settling speed. Screen-space flake size remains exaggerated for the miniature. Crystal aggregation, riming, breakup, compaction, wind redistribution, and ice formation are not simulated.

## 3. Shared wind and foliage

NREL's TurbSim describes statistical wind fields using spectra, seeded phases, and spatial coherence [S5]. It is itself a statistical generator, not direct Navier-Stokes simulation. The important transferable idea is that nearby objects respond to related gusts rather than unrelated random samples.

The city uses a small deterministic sum of spatial and temporal sine modes:

```text
gust = 1 + 0.22 sin(pi t/8 - 0.035 x - 0.02 z)
         + 0.10 sin(pi t/3 + 0.07 z)
direction = 0.6 + 0.18 sin(pi t/24)
wind = meanSpeed gust (cos(direction), sin(direction))
```

Magnitude remains within **0.68-1.32 times the selected mean**. Periods divide 48 seconds, allowing continuous time wrapping at 4,800 seconds. Wind direction, frequencies, and amplitudes are artistic, not calibrated street-canyon measurements. The field is neither divergence-free nor terrain-aware.

Rain, snow, foliage, and cloud offsets share this wind. Clouds move at an artistic 0.15 speed multiplier. Foliage uses modest-wind loading proportional to speed squared, limited to 0.09 radians. Each update starts from immutable rest matrices so bending cannot accumulate into permanent deformation. Snow shells copy changed canopy instance matrices into their own buffers, keeping the accumulated layer attached to swaying trees.

GPU Gems discusses hierarchical, instanced, phenomenological tree animation and distinctions between inertia, elasticity, and finer branch motion [S6]. The city intentionally uses the cheaper **quasi-static** bend, not a spring oscillator or a resonance/structural simulation. Slow coherent gusts provide its temporal smoothness; separate branch inertia and material stress remain omitted.

## 4. Retained water and snow: conservation before appearance

USGS identifies rainfall duration/intensity, prior moisture, impervious surfaces, slope, and drainage as important runoff controls [S7]. Resolving all of them would require a spatial hydrology model. The implemented compromise is one representative, exposure-normalized pair of surface stores:

```text
W = liquid water, mm
S = snow-water equivalent, mm
S change = snow input - melt - snow overflow
W change = rain input + melt - evaporation - drainage - liquid overflow
```

This is **not per-cell water routing**. The geometry grid provides collision and visual shelter; the two scalar stores represent exposed-surface history. Three explicit 40 m² contributing areas route their representative drainage and liquid overflow into three authored shallow depressions. No slope-flow paths or gutter network are inferred from the grid. Local pool volumes and depths are modeled separately below.

Every step records rain, snow, melt, evaporation, drainage, and capacity overflow. Melt moves the same water-equivalent amount from S to W. Losses cannot exceed available storage. Water is capped at 3 mm, SWE at 18 mm; excess is recorded as outflow instead of silently disappearing. The combined balance is:

```text
Wafter + Safter + evaporation + drainage + overflow
  = Wbefore + Sbefore + rain input + snow input
```

Drainage uses an exponential reservoir with a physical 1,800 s timescale. It transfers liquid from the representative contributing areas to the pools, not through a simulated drain mesh. Rain forcing is adjustable from 0 to 30 mm/h, default 8; snowfall is 2 mm SWE/h at full Snow. These are fictional scenario parameters, not observations or a claim that every visual particle deposits a literal droplet mass.

Wetness appearance saturates at 0.6 mm water; snow opacity/coverage saturates at 1.2 mm SWE. Those normalized shader inputs are not additional mass stores. Wet surfaces darken and become less rough. Snow follows world-space upward normals and top-envelope exposure. Roads and markings use a 0.45 retention factor for a thinner layer; that factor is an appearance/contact tuning, not modeled plowing.

The initial coating was extended at the user's request with **displaced snow shells**, not just recoloring. Shells reuse the original solid geometry, lift exposed vertices, retain a narrow side edge, and use matching displacement in their shadow material. They cover roofs, ground, streets, and tree canopies, excluding moving actors and semantic hit volumes.

Fresh snow density is an uncalibrated 80 kg/m³. Physical depth is therefore `0.0125 × SWE_mm` meters. A named **2× display-depth exaggeration** makes the miniature readable, giving `displayDepth = min(0.45, 0.025 × SWE_mm)` meters. The road retention factor also applies to depth. This creates bounded visible thickness, not individual snow grains, pressure/roof loading, snowbanks, avalanches, or a calibrated compaction model.

Route actors are smoothly lifted onto nearby ground snow, without changing route X/Z, stepping onto a canopy above them, or accumulating a new vertical offset each frame. Selection rings remain above the snow. Materials not marked weather-responsive, including window lighting, preserve their existing behavior.

### Canopy evidence and the current boundary

SnowModel explicitly distinguishes intercepted canopy inventory, throughfall, and unloading [S16, §3a]. Its reproduced capacity relation is `Imax = 4.4 LAI*` kg/m², with effective leaf area including stems and branches. A stylized tree has no measured effective LAI, so this equation does not calibrate the city's tree crowns. Its temperature-index unloading transfers snow to the ground, not simultaneously into liquid water; wind unloading is not explicitly resolved there.

The current canopy shells are a **visual envelope driven by the representative SWE**, not a separately conserved interception reservoir or a branch-load model. Only exposed upper regions and narrow edges remain visible. Vertical displacement uses the horizontal-plan-area depth convention; the 2× display scale and retention masks are not a claim that total rendered snow volume equals stored physical mass. They do not change the SWE inventory. Normal extrusion over every crown face would require a different supporting-area calculation.

A future separate canopy store would require capped capture, explicit throughfall, and area-weighted unloading into receiving stores. Equal depth transfers across unequal crown/ground areas would not conserve mass. That extension is **proposed, not implemented**, and would need separate tests; no structural loading or universal wind-unloading threshold is claimed.

### Three rain-fed ground pools

The original ground geometry now has three small elliptical openings with shallow paraboloid beds: west verge, terrace verge, and south verge. They lie outside building footprints and the travel corridors. They are not floating decals over an intact ground plane.

EPA SWMM represents surface runoff as a reservoir water balance and storage units using area versus water height [S17, §§3.4.1 and 3.2.6]. This supports the reduced storage approach below, not the specific basin positions or drainage coefficients. Appendix A.5 gives 1.27-2.54 mm as a representative impervious depression-storage range: that effective catchment parameter is **not** a universal maximum visible puddle depth. The city's deeper authored bowls are distinct local storage.

For maximum elliptical area `Amax = pi radiusX radiusZ`, maximum depth `H`, and current depth `h`:

```text
wetted area A(h) = Amax h/H
stored volume V(h) = Amax h²/(2H)
h = sqrt(2 V H/Amax)
radius fraction = sqrt(h/H)
```

These are geometric relationships for the authored bowl, not an inferred terrain survey. Depth caps are 7.5-8.5 cm. Water rises from the actual bed and spreads as it fills; a 2 mm rendering offset avoids coplanar flicker. The exposed water area controls evaporation. Pool drainage uses a physical one-hour exponential timescale; excess above the rim is recorded as boundary outflow. All these processes use the same 60× surface clock.

Each pool receives rainfall over its opening, melt from the shared SWE over that footprint, and drainage/liquid overflow from its 40 m² contributing area. Snow overflow is **not** treated as liquid runoff. With total contributing area `C = 120 m²`, combined depression area `A`, and volumes `Vi`, the complete represented store is:

```text
Vtotal = W C/1000 + S (C+A)/1000 + sum(Vi)
external input = (rain_mm + snow_mm) (C+A)/1000
external loss = surfaceEvaporation_mm C/1000
              + snowOverflow_mm (C+A)/1000
              + poolEvaporation + poolDrainage + poolOverflow
```

Surface drainage and melt are internal transfers in this combined balance. They must not be counted again as external losses. Per-step tests check this identity through snowfall, melt, intense rain, dry weather, and capacity overflow.

This is a lumped catchment/depression-storage model. Catchment sizes, bowl positions, density, and drainage coefficients are original tunings. There is no terrain-wide flow solver, infiltration calibration, connected sewer system, flooding, or complete freezing/ice model.

## 5. Evaporation and melting

### Evaporation

FAO identifies temperature, humidity, available energy, and wind as evaporation controls [S8]. Its Penman-Monteith reference-crop model cannot be transplanted unchanged to paving. The city uses FAO's saturation vapor-pressure expression, then an explicitly uncalibrated drying coefficient:

```text
es(T) = 0.6108 exp(17.27 T / (T + 237.3))       [kPa]
vapor-pressure deficit = (1 - RH) es(T)         [kPa]
E = deficit (0.06 + 0.018 windSpeed + 0.02 sunIntensity) [mm/h]
```

The coefficient incorporates the units needed for mm/h. `sunIntensity` is an artistic lighting parameter, **not W/m²**. The result is limited by available liquid. Humid conditions dry more slowly; wind, warmth, and brighter conditions increase the approximate rate. No dew, refreezing, sublimation, or independently solved surface temperature is present. Below freezing, any retained liquid still uses this liquid-water approximation; it is not an ice-vapor model.

For scale, latent heat near 20 °C is approximately 2.45 MJ/kg [S8]. A real available energy flux of 100 W/m² would support about 0.147 mm/h evaporation. The city does not solve that energy budget; rapid visible change also reflects its explicit 60× surface clock.

### Snow-water equivalent and melt

NWS explains why a universal 10:1 snow-depth/water ratio is unreliable [S9]. If physical depth were needed, `depthMeters = SWE_mm / 1000 × rhoWater / rhoSnow`. Ten millimeters SWE at 100 kg/m³ would be 0.1 m snow. The city stores SWE and uses the explicit 80 kg/m³ density and 2× display scale above for its geometry; it does not pretend a universal snow-to-water ratio was measured.

Hock distinguishes empirical temperature-index melt from full energy-balance melt [S10]. The implemented degree-day approximation is:

```text
meltRate = 3 max(temperatureC, 0) / 86400       [mm SWE/s]
```

The factor 3 mm/(°C day) is an uncalibrated scene choice. It gives 6 mm SWE/day at +2 °C before time compression. Melt is capped by remaining SWE and added to liquid before liquid losses.

OpenStax gives water-ice latent heat near 334 kJ/kg [S11]. At the melting point, 100 W/m² could melt about 1.08 mm SWE/h; colder snow first needs sensible heating. This is a sanity reference, not a second melt term. The implementation does not double-count degree-day and energy-balance melt. It omits cold content, albedo feedback, shade-dependent temperatures, and refreezing.

## 6. Fog, light, and garden water

### Fog: research versus present rendering

PBRT gives transmittance `T = exp(-integral sigmaT ds)`; homogeneous extinction reduces to `T = exp(-beta distance)` [S12]. The familiar color blend `T surface + (1-T) fogColor` approximates illumination within the medium. A physical half-transmission distance is `ln(2)/beta`, not automatically meteorological visibility.

The existing city retains Three.js **squared-exponential fog** with preset density. It is a subdued artistic depth cue, **not homogeneous Beer-Lambert attenuation**, humidity-derived visibility, volumetric clouds, or multiple scattering. Replacing every material's fog pipeline was not justified for this bounded weather slice. Night/light changes remain independent of weather; Snow does not falsely force the device clock into winter.

### Ripples

MIT's finite-depth, small-amplitude capillary-gravity relation is [S13]:

```text
k = 2 pi / wavelength
omega² = (g k + surfaceTension k³ / density) tanh(k depth)
phaseSpeed = omega / k
```

For clean water near room temperature, the implementation uses surface tension 0.072 N/m and density 1,000 kg/m³. The garden motif selects 0.30 m wavelength and 0.08 m depth, yielding phase speed between 0.6 and 0.7 m/s. The wavelength is deliberately larger than a typical fine rain ripple for overhead legibility.

At most 12 instanced rings are drawn over the existing garden water; Lightweight uses four. Their expansion uses phase speed, as a stylized moving crest, **not a group-velocity wave packet**. Their placement, repeating expansion cycle, opacity, and relationship to rain intensity are artistic. They are not a solved water-height field, physically resolved impact crowns, or arbitrary puddles over the streets. No fluid library or extra animation loop was added.

## 7. Weather-aware traffic

On a level road with constant braking magnitude `a`, mechanics gives `brakingDistance = speed²/(2a)`. An idealized friction limit has `a <= mu g`; a response delay would add `speed × delay` [S14]. Static and kinetic friction are different; a route vehicle is not a sliding block.

The Highway Code supports larger stopping margins and smooth braking in wet/snowy conditions [S15]. Its safety guidance is **not** a water-depth-to-tire-friction calibration.

The implementation computes a bounded caution factor:

```text
traction = max(0.3, 1 - 0.25 wetness - 0.5 snowCover)
cruiseSpeed = dryCruiseSpeed sqrt(traction)
accelerationBudget = dryAccelerationBudget traction
brakingBudget = dryBrakingBudget traction
```

This keeps the basic `speed² / brakingBudget` relationship consistent while reducing aggressive motion. Signal clearance and stopping calculations use the same reduced braking budget. Existing stop lines, dwell, spacing, and crossing arbitration are preserved. Surface history, rather than the weather label alone, drives caution after precipitation stops.

This factor is a model tuning, not a measured friction coefficient or road-safety prediction. Walkers retain their own clock; they do not slip or fall. There are no skids, crashes, hydroplaning, tire/contact mechanics, or ice hazards.

## 8. Runtime boundaries and controls

`EnvironmentController` retains the CPU physics. `WorldModel` advances it before traffic. `EnvironmentVisual`, `SurfaceVisual`, and `FoliageWind` consume that state; rendering cannot advance the simulation. Weather summaries reach React about once per simulated second, not once per frame.

High draw limits are 600 rain streaks, 420 flakes, 48 rain impacts, six shared cloud meshes, and 12 garden rings. Lightweight caps these at 160/120/16 particles/impacts and four garden rings. Rain counts scale with `sqrt(intensity/30)` within the caps; default 8 mm/h draws 310 High or 83 Lightweight streaks. Three ground-water meshes and six optional pool ripple instances are fixed additions. Thirty-three snow-shell batches reuse source geometry and have owned material/instance resources. CPU pools and physical input are independent of draw quality. Borrowed material hooks, foliage rest poses, lights and texture/geometry ownership are restored or released correctly.

Pause and hidden-tab/context suspension freeze all weather progression. Explicit settings changes while paused update the static atmosphere without advancing reservoirs. Reduced motion keeps static precipitation cues and disables decorative travel, sway, cloud motion, splashes, and ripples even when the user explicitly resumes conservative street activity.

Graphics restoration and retry preserve CPU precipitation, wind, snow/water stores, and world state. Page reload keeps only non-sensitive preferences. Shader compilation failures report the existing actionable fallback instead of a false live state.

Sunny, Cloudy, Rain, Mist, Snow, and Windy are selectable. Manual selection disables natural weather in both live state and saved preferences. The keyboard-operable intensity slider appears for Rain or natural weather, displays mm/h with stable-width numerals, and preserves the current preset/natural selection when changed. Older saved preferences acquire the 8 mm/h default; invalid values produce the existing visible reset notice.

Sound remains off until a fresh gesture each visit; Snow softens the air layer and does not play rain, while Windy modestly strengthens it. Rain-layer gain is zero at 0 mm/h, retains the original 0.2 mix at 8, and rises to a restrained 0.3 at 30; this audio mapping is artistic, not a calibrated acoustic law. Changing intensity does not grant consent or resume a blocked context. Settings and original landmark navigation remain UI controls, not a weather-data service.

## 9. Verification and honest limits

The behavior tests cover reference interpolation, finite ranges, drag convergence, continuous bounded wind, allocation caps, roof interception including lateral travel, representative mass balance including overflow, retained snow/water and warming, 30/60 Hz determinism, reduced-motion freezing, and gravity-wave limiting behavior. Related tests cover material hooks, foliage rest poses, graphics restoration/disposal, weather-aware signal/spacing safety, settings persistence, and sound consent.

Browser checks are authored for actual shader compilation, snow-depth/wetness uniform writes and pool model matrices through the real runtime, paused raster stability, preset persistence, graphics recovery, accessibility, and compact settings layout. The latest run status is recorded separately; authored checks are not a claim that every current browser scenario passed, nor a laboratory validation of the coefficients. See the current run evidence and limitations in [acceptance criteria](ACCEPTANCE_CRITERIA.md).

Not implemented: urban CFD, live weather, cloud microphysics, hail, lightning, flooding, erosion, structural damage, spatial runoff/soil hydrology, snowbank geometry, refreezing, full thermal balance, individual-crystal physics, physically solved splashes, or tire dynamics. These would need a separate requirement, cost/benefit decision, and validation plan. Physical-device FPS, two-hour memory profiling, additional desktop browsers, and assistive-technology sign-off remain broader roadmap work.

## Verified source register

These entries had relevant HTML or PDF text retrieved and read during this research. Titles and locators identify the evidence; equations and discussion above are an original synthesis, not copied implementation.

1. **[S1] NASA Glenn, "Drag Equation."** Drag dependencies, coefficient interpretation, and reference area. <https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/>
2. **[S2] Bringi, Thurai and Baumgardner (2018), "Raindrop fall velocities from an optical array probe and 2-D video disdrometer."** *Atmospheric Measurement Techniques* 11, 1377-1384. Abstract, §§2.1-2.2, Table 1 p. 1380, §3. <https://amt.copernicus.org/articles/11/1377/2018/>; [read PDF](https://amt.copernicus.org/articles/11/1377/2018/amt-11-1377-2018.pdf).
3. **[S3] Li et al. (2021), "Settling and clustering of snow particles in atmospheric turbulence."** *Journal of Fluid Mechanics* 912. Abstract, introduction, conclusions. <https://doi.org/10.1017/jfm.2020.1153>
4. **[S4] Kajikawa and Okuhara (1997), "Observations of the Falling Motion of Plate-Like Snow Crystals, Part II: The Free-Fall Patterns and Velocity Variations of Rimed Crystals."** *Journal of the Meteorological Society of Japan* 75, 811-818. Abstract and §§3.1-3.3. <https://www.jstage.jst.go.jp/article/jmsj1965/75/4/75_4_811/_article>; [read PDF](https://www.jstage.jst.go.jp/article/jmsj1965/75/4/75_4_811/_pdf).
5. **[S5] NREL (2009), TurbSim User's Guide, report 46198.** Statistical methodology p. 1, seeded phases p. 5, coherence pp. 38-39, limitations p. 46. Retrieved from the laboratory's current document host: <https://docs.nlr.gov/docs/fy09osti/46198.pdf>.
6. **[S6] Renaldas Zioma, GPU Gems 3, chapter 6, "GPU-Generated Procedural Wind Animations for Trees."** §§6.2-6.4, hierarchy, instancing, inertia and stiffness. <https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-6-gpu-generated-procedural-wind-animations-trees>
7. **[S7] USGS Water Science School, "Runoff: Surface and Overland Water Runoff."** Runoff controls, infiltration, impervious areas and urban drainage. <https://www.usgs.gov/water-science-school/science/runoff-surface-and-overland-water-runoff>
8. **[S8] FAO, Irrigation and Drainage Paper 56, Crop Evapotranspiration.** Chapter 2, reference-crop limits; chapter 3, energy, humidity, wind, latent heat and Eq. 11. [Chapter 2](https://www.fao.org/4/x0490e/x0490e06.htm); [chapter 3](https://www.fao.org/4/x0490e/x0490e07.htm).
9. **[S9] NOAA/NWS La Crosse, "Why Snow Ratios?"** Variability of snow-to-liquid ratios. <https://www.weather.gov/arx/why_snowratios>
10. **[S10] Hock (1999), "A distributed temperature-index ice- and snowmelt model including potential direct solar radiation."** Introduction and §3.1, Models 1-3. <https://doi.org/10.3189/S0022143000003087>
11. **[S11] OpenStax, University Physics Volume 2, §1.5, "Phase Changes."** Phase-change energy, sensible warming, and Table 1.4. <https://openstax.org/books/university-physics-volume-2/pages/1-5-phase-changes>
12. **[S12] Physically Based Rendering, 4th edition, §11.2, "Transmittance."** Eqs. 11.5-11.7, optical thickness and homogeneous attenuation. <https://pbr-book.org/4ed/Volume_Scattering/Transmittance>
13. **[S13] John W. M. Bush, MIT OpenCourseWare, 18.357 Interfacial Phenomena, Lecture 19, "Water Waves."** pp. 78-79, Eqs. 19.4-19.5, finite-depth dispersion and group velocity. [Lecture](https://ocw.mit.edu/courses/18-357-interfacial-phenomena-fall-2010/resources/mit18_357f10_lecture19/); [read PDF](https://ocw.mit.edu/courses/18-357-interfacial-phenomena-fall-2010/229785489c81648500f89044a97c0e51_MIT18_357F10_Lecture19.pdf).
14. **[S14] OpenStax, University Physics Volume 1, §6.2, "Friction."** Static/kinetic distinction and empirical coefficient models. Stopping distance above is derived from constant-acceleration mechanics, not quoted as a tested city braking model. <https://openstax.org/books/university-physics-volume-1/pages/6-2-friction>
15. **[S15] UK Government, Highway Code, "Driving in adverse weather conditions," Rules 227-231.** Wet/snow/ice stopping margins and smooth braking. <https://www.gov.uk/guidance/the-highway-code/driving-in-adverse-weather-conditions-226-to-237>
16. **[S16] Liston and Elder (2006), "A Distributed Snow-Evolution Modeling System (SnowModel)."** *Journal of Hydrometeorology* 7, 1259-1276. §3a, p. 1264, Eqs. 4-5: interception, throughfall and canopy capacity; p. 1265, Eq. 19 and following paragraph: thermal unloading and unresolved wind unloading. Abstract/§2: intended 10-minute to one-day time increments, not validation of this 30 Hz visual model. <https://doi.org/10.1175/JHM548.1>; [read PDF](https://journals.ametsoc.org/downloadpdf/journals/hydr/7/6/jhm548_1.pdf).
17. **[S17] US EPA (2022), Storm Water Management Model User's Manual, Version 5.2.** §3.4.1, printed p. 84: surface reservoir water balance and depression storage; §3.2.6, pp. 54-55: storage units, area-height functions, evaporation and seepage; Appendix A.5, p. 210: representative impervious depression storage. [Read PDF](https://www.epa.gov/system/files/documents/2022-04/swmm-users-manual-version-5.2.pdf).

### Retrieval gaps and claims not made

Atlas, Srivastava and Sekhon (1973), DOI `10.1029/RG011i001p00001`: bibliographic identity and abstract were available, but publisher full text was blocked. It is not counted among full-text-read sources. Foote and du Toit (1969), DOI `10.1175/1520-0450(1969)008<0249:TVORA>2.0.CO;2`: the scanned original coefficient table was not successfully verified; [S2]'s reproduced speeds are the bounded alternative used here.

Some guessed NASA rain FAQ paths returned 404 and supply no evidence. The old NREL document URL failed; the PDF was successfully read at the current host in [S5]. No retrieved source calibrates this city's pavement drying coefficient, snow density, melt factor, gust parameters, or traffic caution mapping. Those remain explicit original design choices.

Hedstrom and Pomeroy (1998), "Measurements and modelling of snow interception in the boreal forest": publisher access returned 403, so its original full text was not read. The capacity relationship is verified only where reproduced in [S16]. SnowModel's publisher HTML was blocked but its PDF was read. An attempted USACE storage URL returned 404 and was not used; [S17] supplies the storage evidence.
