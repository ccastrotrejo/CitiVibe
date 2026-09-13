# Art and assets

**Status:** M1-M3 art includes a compact original procedural district, three landmark forms, a bounded set of actor models, and an original SVG still, authored on 2026-09-12. M2 uses a reproducible TypeScript workflow rather than requiring Python/Blender/GLB export. Imported screenshots remain research only; no textures or audio are shipped by this art slice.

**Current review priority:** desktop at **1440 × 900** and **1920 × 1080**, checking the overview, three landmark views, street activity and signal legibility. Existing basic responsiveness remains, but mobile edge-case hardening is not an acceptance gate for this art deliverable. Desktop visual/GPU verification belongs to the integrated runtime review; the unit checks below do not claim it has been completed.

## Originality and rights

Create an original district, not a reconstruction of Opportunity.city or its distinctive composition. Do not download or reuse its `city.glb`, original JavaScript/CSS, fonts, logo, brand marks, promotional text, building names, or artwork. Do not trace screenshots or use a screenshot as a texture, loading poster, splash screen, or fallback.

Broad ideas such as a low-poly miniature, repeated building modules, lively streets, and warm lighting are useful references. The new skyline, street graph, building family designs, landmark forms, typography, color system, and scene composition must be independently designed. Source measurements in [reference analysis](REFERENCE_ANALYSIS.md) are observations, not artistic targets.

The source GLB has zero embedded textures/images and a generator string naming a Python script. That supports colored procedural geometry as a useful approach; it does not provide an original script, license, or proof that all source visuals were procedural.

## Implemented M1-M3 originals: Rainlight Square

The initial implementation uses a warm handcrafted miniature with a copper-roofed pavilion, cream/terracotta/teal buildings, a small garden, and ordinary street activity. The initial M1 block was extended in place for M2-M3: five buildings across flat-roofed hall, stepped terrace and hipped-roof cottage families; an open civic pavilion; planted terrace steps; a shallow reed garden; two seated figures; and twelve moving-actor models. The district footprint was not expanded. These assets were authored directly for LivingCity by GitHub Copilot, without downloading, tracing, importing, or deriving geometry from the reference assets. They contain no third-party artwork, textures, fonts, icons, branding, advertisements, or external resource requests. This records actual local source provenance, not a claim about the source site's implementation history. The later NYC-inspired direction is recorded in M8 and has not replaced this artwork yet.

| Asset/version | Authored source and reproduction | Rights/provenance |
| --- | --- | --- |
| Procedural district and actor models `rainlight-001` | [`src/world/scene.ts`](../src/world/scene.ts) exports `ART_INPUTS` (schema version 1, asset version `rainlight-001`, seed 2401, street/stop/crossing dimensions and positions, and five named building inputs) and `validateArtInputs`. Paired semantic placement, route and camera inputs are the versioned `CONTENT` manifest in [`src/content/city.ts`](../src/content/city.ts). Call `buildCityScene()` with the locked Three.js version. Dimensions, palette choices and transforms are explicit; a bounded seeded integer sequence varies tree rotations. Rebuilding produces identical geometry without wall-clock/unseeded randomness, network access, a generator install, or a binary model. | New original source authored for this project on 2026-09-12. Standard Three.js primitives plus an authored ground outline and route ribbon; the library's license is separate from artwork provenance. No source-site material was used. |
| Static illustration `rainlight-001` | [`public/city/rainlight-001.svg`](../public/city/rainlight-001.svg), **15,620 bytes**, `viewBox="0 0 1200 900"`. The checked-in editable vectors are the canonical source: reproduce by copying/serving this version unchanged. It is a hand-authored companion illustration of the same layout and palette, not a renderer screenshot or an automatic exact scene export. It includes all three landmark forms, the crossing, stop, signals in their initial vehicle phase, and representative fixed street activity. | New original SVG authored for this project on 2026-09-12. All shapes, local reusable symbols, descriptions and window patterns are inline. No external images, fonts or icons. |

The scene uses meters, Y-up, ground-level road `y=0`, and the unchanged closed distance-sampled route from the content module. The **4 m road** and sidewalk ribbons use that same centerline and heading-derived normals, including all rounded corners. The sidewalk reaches the outer walker path at a 4 m offset; tree trunks and planters leave that path clear. The north zebra crossing is centered at **(0, 0, -16)**, with stripes parallel to X and the pedestrian path running across Z. The boarding platform at **(-9, 0, -13)** stays unobstructed, with a modest unbranded stop pole outside the boarding area. Input validation rejects invalid versions/seeds/dimensions, repeated building IDs, out-of-bounds buildings, and building footprints that obstruct the crossing or stop.

The pavilion at **(-4, 0, -3)** is an open octagonal cream colonnade and broad copper canopy. The terrace steps at **(9, 0, -4)** use five rising treads framed by planted terracotta edges. The reed garden at **(-8, 0, 7)** uses a low stone basin, still water and two reed rows beside garden seating. Each `LANDMARKS` entry has a dedicated transparent, raycastable semantic volume. Neither decorative geometry nor mesh ordering defines identity.

`CityScene.actors` is a `Map<string, THREE.Group>` containing `square-bus`, `car-1` through `car-3`, and `walker-1` through `walker-8`; `bus` aliases the bus map entry. Groups start at the origin without autonomous art animation. Road vehicles point along local **+Z** with wheel bottoms at local **y=0**; walker feet are also at y=0. Cars fit within the simulation's 2.8 m length and the bus within 4.8 m. All actors and two static resting figures are non-interactive artwork. Actor IDs serve simulation, not selection. `hitTargets` contains only the three original landmarks. Drone geometry, metadata, and the SVG drone drawing have been removed. The initially hidden `marker` is centered on the origin so the runtime can position it at a selected landmark. The scene owns unique geometry/material/instance-buffer and shadow resources and disposes them idempotently, including every actor group. Runtime camera, simulation and UI behavior are not part of these assets.

`CityScene.setSignal?(phase: 'vehicles' | 'clearance' | 'pedestrians')` is implemented for three small signal heads beside the north crossing. The initial phase is `vehicles`: the vehicle's lower green lamp is on and both pedestrian heads show their upper red lamps. `clearance` shows red for every head; `pedestrians` shows red for vehicles and green for both pedestrian heads. Upper stop/lower go positions and lit/unlit contrast supplement color. The setter reassigns shared owned materials only when the phase changes; repeated calls and calls after disposal do no work. There are no added timers, animation, point lights, or UI controls. The parent simulation remains responsible for actual vehicle/walker waiting and crossing behavior; the lamps only display its authoritative phase.

The SVG's focus points are relative to its **illustrated content box**:

| Landmark ID | SVG point | Left / top |
| --- | --- | --- |
| `rainlight-pavilion` | (589.4, 299) | **49.117% / 33.222%** |
| `terrace-steps` | (738, 462) | **61.5% / 51.333%** |
| `reed-garden` | (441, 413) | **36.75% / 45.889%** |

A CSS fallback marker must account for image letterboxing rather than using percentages of a differently proportioned container. The still depicts Afternoon/Sunny and is explicitly described as static.

### M1-M3 art verification

`npx vitest run src/world/scene.test.ts` passes twelve tests for semantic raycasting, route alignment and closure, grounded actor pivots/population, origin-centered marker, crossing orientation, input validation/clearance, exclusive signal phases and material reuse, bounded geometry, independent idempotent disposal, deterministic reproduction, and self-contained valid SVG. Art/test lint and strict TypeScript checks pass. The runtime validates an exact match between twelve street actors and their artwork, plus all three landmark targets. No drone ID is part of the active art contract. See the integrated checkpoint in [acceptance criteria](ACCEPTANCE_CRITERIA.md). These checks do not establish physical-device performance, visual acceptance of every camera angle, or later weather/night appearance.

Earlier CPU traversal estimates included the now-removed drone and are not current renderer measurements. Re-profile final artwork after the NYC pass and environment integration, including main/shadow/effect passes. Repeated windows, trees, structure, seating and actor parts use shared material/geometry instance batches; the current district art has no autonomous per-frame work or post-processing. Passing geometry/disposal tests is not an FPS or GPU-performance result.

## Proposed visual direction

Prioritize a readable silhouette, distinct neighborhoods within a compact footprint, and places the camera can visit. Start with a modest block count rather than filling a giant ground plane. Use a quieter low-rise edge, a contrasting mid-rise cluster, a central civic space, and one original landmark. Deliberately differ from the source's street/skyline arrangement.

Choose a small original palette by material role: ground/road, sidewalk/curb, masonry, painted panels, glazing, vegetation, metal, and warm night accents. Evaluate it in daylight, night, rain, mist, and reduced-detail modes. UI contrast requirements are separate from muted world colors.

| Family/system | Original construction approach |
| --- | --- |
| Low-rise courtyard buildings | Parameterized footprints, recessed entrances, pitched/flat roof variants, varied window rhythm. |
| Mid-rise stepped buildings | Shared slabs and bays with several silhouettes, setbacks, terraces, and restrained rooftop details. |
| Civic landmark | One independently sketched memorable form; recognizable from overview and ground-adjacent anchors. |
| Roads and sidewalks | Connected lane/footpath graph, clear curb edges, crossings, stop lines, bus dwell areas, turning space. |
| Plaza and landscape | Fountain or garden feature, benches, planted edges, open pedestrian circulation, meaningful resting spots. |
| Vegetation | A few reusable tree/shrub silhouettes with scale/hue variation; avoid one mesh/material per tree. |
| Props | Original lights, seating, cycle racks, civic wayfinding and service details; no ad slots or branded billboards. |
| Actors | Simple ordinary buses, cars and people, authored separately with coherent scale and pivots. An occasional airplane is future planning only; no airplane or drone is implemented in this art deliverable. |

A building's roof detail should not cost more than the whole actor system without a visible benefit. Close views need enough geometry to hold up, but the overview composition remains the main use.

## Reproducible TypeScript workflow

1. **Inputs:** retain the versioned `ART_INPUTS` record and paired `CONTENT` manifest. Edit the explicit building dimensions/families or seed, not opaque geometry or research data. Keep meters, Y-up, bounds, route shape, landmark IDs and camera anchors consistent.
2. **Validation:** `buildCityScene()` validates art and landmark inputs before constructing resources. Changes to the north crossing, bus stop, actor lengths or shared route require coordinated simulation changes, not independent decorative adjustments.
3. **Generation:** the authored source produces shared primitives, a sampled route ribbon, instanced static families and separately transformable actor groups. Seed 2401 determines fixed tree rotation variation; time and runtime randomness never enter generation.
4. **Reproduction:** use the dependency lockfile and call `buildCityScene()` again. The art test compares all geometry position/index arrays and instance matrices across independent builds. No Python/Blender process, GLB encoder/decoder or downloaded model is needed.
5. **Companion still:** keep the editable `rainlight-001.svg` with its asset version and inline focus-point metadata. Regenerate by serving/copying this canonical SVG; changes to district composition require a deliberate matching vector edit and fallback-coordinate review.
6. **Verification and delivery:** run the art tests, lint and typecheck; review camera/focus views in the integrated runtime; measure renderer calls and device performance separately. Vite's hashed source bundle carries the procedural art, alongside the separately versioned original SVG.

Direct source generation is the chosen M2 equivalent reproducible-art workflow: it retains original source, dimensions, semantic manifests, stable pivots, deterministic output and explicit resource ownership without adding an export toolchain for roughly thirteen thousand triangles. GLB delivery is a possible later option if measured transfer/loading or an external art workflow requires it, not an outstanding M2 requirement or a claim that a binary export already exists.

## Separation of static and dynamic art

Static district geometry can be batched spatially and by material. Actors, foliage effects, fountain effects, and semantic hit targets should stay separately controllable. Roads and paths must agree geometrically with the simulation manifests; vehicles should not drive over curbs because the art and route graph evolved independently.

Use shared actor geometry/materials with instanced transforms when appropriate. Keep actor IDs stable through quality changes; do not assign a different identity just because an array was compacted. Optional wheels/limbs need simple local transforms, not a full skeletal system unless the art clearly requires one.

Night cues can use restrained emissive/material variation rather than hundreds of dynamic lights. Rain can be a bounded shared particle representation with no per-drop objects. Use original procedural micro-animation sparingly.

### Original weather effects

The weather extension adds no downloaded assets. Rain streaks, radial snow sprites, impact rings and ripples are generated from code and standard primitives. Exposed surfaces receive wetness/coverage shaders plus 33 source-geometry-sharing snow-shell batches: vertices and matching shadow geometry rise with retained snow depth, including roof edges, streets and canopies. The layer is bounded and intentionally exaggerated at miniature scale; it is not individual-grain or snowbank simulation.

Three original elliptical openings in the ground have shallow paraboloid beds, with rain-fed water surfaces that rise and expand rather than floating over uncut terrain. Their positions avoid buildings and travel corridors. These small details are not new landmarks and do not change semantic IDs, route geometry, or the original fallback illustration's overview role.

Trees and reeds retain their authored rest geometry and palette. Snow copies their changed instance transforms so it remains attached during sway. A 0.5 m top-envelope/retention grid comes from actual static triangles; precipitation also checks displayed snow and pool water height. It approximates canopy/roof boundaries, not gutters, vertical walls or sub-cell geometry. See [research and limitations](WEATHER_PHYSICS_RESEARCH.md).

CPU scene traversal after this extension counts **24,294 base-scene triangles, 174 potential mesh submissions and 23 materials**, within the existing art-only test limits. With visible snow shells/clouds/garden rings, traversal counts **40,926 triangles, 214 potential mesh submissions and 27 materials**. Both counts include actor artwork and semantic meshes, not exclusively immobile district geometry. These are upper-bound scene counts before view culling, exclude point/line primitives and extra shadow passes, and are not measured GPU draw calls or FPS. The 33 snow shell batches add rendering work but reuse original geometry buffers. Final device profiling remains required.

## Proposed budgets

These are initial **profile-driven targets**, not recovered source costs, contractual art limits, or measured application results.

| Item | Initial proposal | Measurement/adjustment |
| --- | --- | --- |
| Primary district model delivery | Aim for 3-5 MB compressed total for the initial district geometry bundle. | Record transferred/encoded asset bytes and decoded memory separately; include compression decoder overhead in total load accounting. |
| Static visible triangle count | Start around 100k-200k at overview; tune for agreed devices. | Measure actual rendered triangles, including actors/effects and shadow passes; source POSITION count is not a triangle baseline. |
| Shared material palette | Approximately 12-24 world materials to start. | Material count alone does not predict draw calls; measure batches and shader variants. |
| Main render work | Aim at no more than 100 main-pass draw calls on the reference laptop and 60 in Lightweight. | Record shadow/effect passes separately and optimize if total GPU frame budget fails. |
| Original poster | Aim below 200 KB encoded. | Test readable fallback quality at small sizes; choose an appropriate image format. |
| Actors/effects | Start with small fixed caps per type. | Tune counts against frame time and visual density; never unbounded population spawning. |

The [acceptance criteria](ACCEPTANCE_CRITERIA.md) own cross-system targets. If a budget is infeasible, record the profile and an explicit revised target; do not silently remove behavior or call an unmeasured result optimized.

## Legally reusable supplements

Prefer original procedural assets. If they are insufficient, choose a small set of assets with explicit licenses allowing the intended use and redistribution. Possible starting points include CC0 libraries or assets purchased with an appropriate license, but verify the actual asset page and license rather than assuming an entire website is reusable.

For each external asset record: filename/version, creator, original URL, retrieval date, exact license and a retained license copy, attribution requirements, permitted modifications/redistribution, and local modifications. Retain proof for purchased assets privately as appropriate; never commit payment information. Check trademarks, likeness restrictions, and audio-specific rights separately.

Use system fonts or deliberately selected licensed fonts, not downloaded source-site brand typography files. Record licenses for any future icon/font libraries as well. Attribution of a research screenshot does not grant runtime reuse rights.

## Art acceptance

An art milestone is done only when geometry loads at correct scale, route/anchor references validate, actor paths align with roads and crossings, overview and focus shots read well, day/night/weather modes remain legible, and every shipped asset has known provenance. Ship an original fallback from the same art direction. No research image may enter the runtime asset graph.
