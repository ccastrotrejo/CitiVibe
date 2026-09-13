# Art and assets

**Status:** the current full-size-court, population and compact-entrance follow-up uses asset version `rainlight-005`; main's weather integration was already published at `48dc3fe`. Original neighborhood blocks, two-way protected cycling and varied traffic surround the car-free park. Authored TypeScript remains the reproducible art workflow; reference photographs remain research only. Historical measurements below do not establish current geometry or visual acceptance.

## Expanded park original assets - rainlight-005

**Population follow-up:** new original authored people retain the miniature's angular, warm-palette style. [`people.ts`](../src/content/people.ts) and [`person.ts`](../src/world/person.ts) replace the two-skin/four-shirt walker palette with independent appearance and thirteen work roles: layered jackets/lapels/ties, hoodies, scrubs, aprons, overalls, reflective workwear and plain service uniforms. Seven skin colors, variable builds/statures, six hair silhouettes, hats, glasses and four bag types create readable differences. Runners and court players have shorts, exposed legs, socks and trainer soles. All clothing uses shared boxes and 20-triangle head/hair forms, a single neutral material and per-instance colors; no textures, fonts, insignia, brands or downloaded art are introduced. See [research and design limits](PEOPLE_AND_ACTIVITY.md).

The ground expands from version 003's 136 x 124 m island to **220 x 340 m**. Six avenues at X = -102, -76, -46, 46, 76, 102 and six cross streets at Z = -162, -132, -95, 95, 132, 162 define thirty-six intersections and twenty-four surrounding blocks. Street geometry and movement share [`streets.ts`](../src/content/streets.ts). The former village buildings, copper gazebo and internal asphalt circuit remain removed.

[`streetscape.ts`](../src/world/streetscape.ts) retains 94 original buildings with street-wall facades, floor-by-floor windows, cornices, fire escapes, roof tanks, stoops, public spaces, street trees, subway stairs, and protective sheds/scaffolding. Cobra-head street lamps and park globe lamps are placed from [`lighting.ts`](../src/content/lighting.ts) as static infrastructure, not advertising. Local building relocations clear the larger recreation parcel without changing the street grid. Bike paths and intersection markings are infrastructure, not advertising. Juniper Court (-5, 113.5) and Crosstown Steps (67.4, -117.8) remain original scenery and city-wide tour viewpoints.

The subway and ordinary-building shed [photo studies](NYC_CITY_RESEARCH.md) inform eight compact frontage entrances and additional protective structures. The shared [metro manifest](../src/content/metro.ts) defines 1.9 x 4.5 m clear openings at sidewalk grade Y=-0.08, twelve 0.18 m descending steps, 1.08 m railings and modest globe/sign posts. Exact matching holes pass through local paving, the island and its backdrop; the landing is at Y=-2.24, not a raised podium. Weather collision captures the exposed treads below the old backdrop floor. Entrances remain original scenery, not operational stations or accessible underground connections. No MTA marks, route bullets, real station names, advertisements or photo textures are shipped; globe colors imply no verified service status.

Seven additional protective sidewalk sheds sit along ordinary completed buildings, four with open upper-facade scaffold sections. The original construction-area shed/scaffold remains. Thin posts and bracing stay outside continuous 2 m walking channels; deck undersides retain more than 2.6 m clearance. No active construction, excavation, contractor signs or commercial placement is implied by the new walking workers. Streetscape-only allowances remain 440,000 triangles / 32,000 parts; the current population-specific whole-scene allowance is described below.

The models distinguish sedans, unbranded yellow cabs, vans, trucks, buses, and helmeted cyclists. Yellow cabs have lower cabins, dark glazing, trim, grille, door details and small original TAXI roof lights, without manufacturer/TLC logos, actual identification numbers or roof advertising. Cyclists retain distance-driven wheels/pedals with varied rider colors and helmets. [`ActorInstances`](../src/world/actorInstances.ts) submits shared geometries/materials across **260 active rigs, eight resting people and two sports balls** while preserving individually driven poses. It owns only instance buffers; the parent scene owns geometry/material disposal. There are 144 neighborhood walkers, 36 park walkers and eighteen runners. Six shorter children play near two guardians in a clear south-meadow patch. Existing semantic actor IDs remain; the former garden bus/cars stay removed.

Juniper Court has a full-size 28.6512 x 15.24 m basketball surface at (-18, 113.5) and 13.4112 x 6.096 m pickleball surface at (15, 113.5). Their authored dimensions convert 94 x 50 ft and 44 x 20 ft respectively; pickleball is about 18.7% of the basketball playing area. Basketball has a 2 m clear runoff; pickleball's overall area is 18.288 x 9.144 m. A continuous 2 m public passage separates the recreation areas. The shared [court manifest](../src/content/courts.ts) positions rims at 3.048 m above the surface, with center offsets +/-12.7254 m. Pickleball kitchens extend 2.1336 m either side of the net; tape height sags from 0.9144 m at the sides to 0.8636 m centrally. Both playing surfaces remain at Y=0.04.

Four basketball rigs move through a 24-second practice sequence; two paddle players cover a 5.6-second rally. Human scale stays unchanged. Paddle blades are approximately 0.20 x 0.26 x 0.016 m and retain their authored hand-relative contact center. Motion uses readable footwork rather than merely translating an arm-animated standing pose. Palette/primitive geometry and actor batches are reused, with fixed stills for reduced motion or paused samples. Full-size geometry is not facility/safety-code certification, and the games remain bounded ambient choreography rather than interactive sports.

[`park.ts`](../src/world/park.ts) authors a **78 x 176 m park**, trimmed about 10% per dimension after the user's follow-up: northern reservoir, dedicated running track, great lawn, southern meadow, western lake and pale shallow-arched bridge, a tree-lined mall, fountain/pergola terrace, rock clusters, slatted benches and dark perimeter railings. Trees use shared trunk/crown geometry, with denser edges and large open clearings. Tan paths and a darker running surface differ from pale city sidewalks. Tree placement excludes water and the whole path width; props keep interior paths and outside walker bodies clear. Path ribbons follow the same [`park.ts` content curves](../src/content/park.ts) as visitors, including four open gates and outside sidewalks. The bridge is scenery; no bridge-crossing visitor behavior is claimed. This is a compressed original interpretation of the [eight-photo study](NYC_CITY_RESEARCH.md#expanded-central-park-photo-study---2026-09-13), not a replica or a measured NYC map.

[`pavement.ts`](../src/world/pavement.ts) creates original flat bicycle/rider/arrow and pedestrian-running stencils from geometry, not downloaded icons or textures. All 120 protected-lane segments receive direction-aligned white marks away from stop bars and crosswalks. On the north and south park-adjacent streets, marks and stop bars share the signed two-way lane offsets: a 2.1 m green surface, opposing lane centers 1 m apart, a dashed yellow divider and low separator. Four contrasting runner stencils follow the reservoir loop. A NYC-specific runner stencil was not established by the image research; these are original functional cues, not replicas or traffic-engineering claims. The [image-reference record](NYC_CITY_RESEARCH.md#photo-reference-pass---2026-09-13) documents the source observations and limits.

[`rainlight-005.svg`](../public/city/rainlight-005.svg) is a self-contained original companion illustration, not a screenshot, copied reference image, or exact scene export. It relocates the full-size courts, depicts eight compact entrances and adds sidewalk activity. A new URL prevents cached version-004 composition from surviving the update. Its inline metadata records the original registration points in a 1200 x 900 viewBox. The following is historical illustration-registration metadata, not active CSS or click targets; selection overlays and their styles have been removed:

| Landmark | Illustration point | CSS left / top |
| --- | --- | --- |
| Rainlight Pavilion | 533.4, 511.635 | 44.45% / 56.8483% |
| Terrace Steps | 585.6, 507.36 | 48.8% / 56.3733% |
| Reservoir Walk (`reed-garden`) | 699, 432.975 | 58.25% / 48.1083% |
| Juniper Court | 363, 583.075 | 30.25% / 64.7861% |
| Crosstown Steps | 970.4, 432.12 | 80.8667% / 48.0133% |

Scene and still were authored for this project from standard geometry and new vectors, without source-site models, textures, fonts, maps, brands, or signs. Earlier SVG versions remain unchanged as historical originals. A neutral sky-matched unlit backdrop avoids tinting the whole city yellow, while world lighting and tagged windows still respond to time/weather. Rain/cloud coverage and shadow bounds expand with the scene; effects retain their fixed allocation caps.

The six-by-six expansion raised the former CPU geometry allowance to 550,000 triangles. The user's subsequent larger, more diverse population adds roughly 49% more active/posable humans with actual clothing/accessory geometry, revising that allowance to **600,000 triangles** (+9.1%). The **110 visible submissions / 36 materials** ceilings remain unchanged. Twenty-triangle heads replace more expensive 36-triangle forms for the new people; per-instance colors prevent an explosion of clothing materials/draw calls. These are base source-scene accounting limits, not revised or verified device FPS goals. Runtime weather/snow/pool work and extra render passes must be measured separately. See [current measurements](ACCEPTANCE_CRITERIA.md).

There are **260 active people/vehicle rigs**, eight resting neighbors and two sports balls. The version-005 SVG remains a simplified companion illustration rather than a literal population inventory. Current scene counts belong in [acceptance criteria](ACCEPTANCE_CRITERIA.md); earlier counts are historical. CPU geometry counts exclude extra renderer passes and are not FPS measurements. Shadows refresh on retained weather revisions; moving actors do not cast into the cache. Depth bias scales with the larger shadow texels, without a larger shadow texture. Precipitation allocations remain fixed, and unchanged actor poses are not resubmitted between simulation ticks.

**Review scope:** overview, reservoir runners, paired cycling, park and street-detail focus, Night/Rain and Mist/Lightweight; record the final executed checks in acceptance criteria. Browser layouts target 1024 x 768, 1440 x 900 and 1920 x 1080, including city-wide tours/guided views, inert scenery clicks and the descriptive fallback. The title card is removed; an offscreen h1 preserves accessible naming without covering the map. Physical-device GPU and assistive-technology verification remain outstanding; mobile-specific hardening is not an acceptance gate.

## Street-name design - street-signs-001

This bounded follow-up was first implemented on main `b81eb32`, not the superseded garden loop. [`streetNames.ts`](../src/content/streetNames.ts) names the existing roads and selects **twelve primary junctions**: four park corners and eight approaches. All twelve road names appear in this first pass; the other twenty-four intersections retain their existing furniture. No roads, traffic directions, park paths, landmarks, controls or destinations are added.

| Avenue, west to east | X (m) | Cross street, north to south | Z (m) |
| --- | --- | --- | --- |
| Lantern Av | -102 | Reed St | -162 |
| Alder Av | -76 | Grove St | -132 |
| Rainlight Av | -46 | Orchard St | -95 |
| Terrace Av | 46 | Juniper St | 95 |
| Foundry Av | 76 | Cinder St | 132 |
| Willow Av | 102 | Harbor St | 162 |

The user-supplied NYC sign photograph is an **appearance reference** for deep-green blades, white lettering, thin metal edges and mounting bands, not a source of runtime pixels, location names or fonts. The palette is green `#07513e`, warm white `#f8f6e9` and galvanized gray `#aab6b3`. Original narrow uppercase stroke lettering interprets the reference rather than replicating its mixed-case typeface. The current two-way motor streets must not receive misleading “ONE WAY” plates; bicycle-direction markings and traffic signals remain authoritative.

[`streetSigns.ts`](../src/world/streetSigns.ts) builds paired perpendicular blades on existing signal poles. The shared signal-pole offset avoids an independently placed obstacle in the walking/cycling channel. Plate widths follow their names, up to 2.9 m, with 0.54 m height. Cross-street blades are centered at 3.78 m; avenue blades at 3.14 m. Their lowest edges clear pedestrian signal hoods, their highest edges stay below mast arms, and any road overhang clears 3.5 m. The metal collars and brackets are the only added mounting hardware; existing pole finishes are retained.

Both faces have normally readable lettering, not mirrored back-face text. [`signLettering.ts`](../src/world/signLettering.ts) generates original flat letter geometry synchronously, without downloaded fonts, textures, canvas rasterization or asynchronous loading. Four spatial batches share one vertex-colored material. They cast/receive scene shadows and participate in precipitation interception, but do not add snow shells, lights, timers, selection targets or per-frame work. The parent scene owns their geometry/material disposal and rebuilds them during graphics recovery.

The addition costs **5,672 triangles, four potential mesh submissions and one material**. Its pre-population-merge base-scene traversal was **549,184 triangles / 98 submissions / 34 visible materials**, within the former 550,000 / 110 / 36 ceilings. The population follow-up on main raises the triangle ceiling to 600,000; the merged scene passes that budget without changing the submission/material ceilings. These are CPU scene counts, not GPU frame-time or FPS claims. The existing `rainlight-005.svg` remains the simplified overview fallback: this small prop layer does not change its composition or landmark positions. Earlier illustrations are untouched. Current checks and isolated-render limitations are recorded in [acceptance criteria](ACCEPTANCE_CRITERIA.md#street-name-design-checkpoint---2026-09-13).

## Originality and rights

Create an original district, not a reconstruction of Opportunity.city or its distinctive composition. Do not download or reuse its `city.glb`, original JavaScript/CSS, fonts, logo, brand marks, promotional text, building names, or artwork. Do not trace screenshots or use a screenshot as a texture, loading poster, splash screen, or fallback.

Broad ideas such as a low-poly miniature, repeated building modules, lively streets, and warm lighting are useful references. The new skyline, street graph, building family designs, landmark forms, typography, color system, and scene composition must be independently designed. Source measurements in [reference analysis](REFERENCE_ANALYSIS.md) are observations, not artistic targets.

The source GLB has zero embedded textures/images and a generator string naming a Python script. That supports colored procedural geometry as a useful approach; it does not provide an original script, license, or proof that all source visuals were procedural.

## Historical M1-M3 originals: Rainlight Square

The initial implementation used a warm handcrafted miniature with a copper-roofed pavilion, cream/terracotta/teal buildings, a small garden, and ordinary street activity. The initial M1 block was extended in place for M2-M3: five buildings across flat-roofed hall, stepped terrace and hipped-roof cottage families; an open civic pavilion; planted terrace steps; a shallow reed garden; two seated figures; and twelve moving-actor models. The district footprint was not expanded at that checkpoint. These original assets were authored directly for LivingCity without downloading or tracing the reference assets. The following version-001 records describe that historical checkpoint; the connected-city section above supersedes its population, footprint, target count and current asset version.

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
| Actors | Simple ordinary buses, cars, cyclists and people, authored separately with coherent scale and pivots. The occasional airplane is implemented separately; no drone. |

A building's roof detail should not cost more than the whole actor system without a visible benefit. Close views need enough geometry to hold up, but the overview composition remains the main use.

## Reproducible TypeScript workflow

1. **Inputs:** retain the versioned `ART_INPUTS` record and paired `CONTENT` manifest. Edit the explicit building dimensions/families or seed, not opaque geometry or research data. Keep meters, Y-up, bounds, route shape, landmark IDs and camera anchors consistent.
2. **Validation:** `buildCityScene()` validates art inputs before constructing resources. Street stop bars, actor footprints, park gates and shared paths require coordinated simulation changes, not independent decorative adjustments.
3. **Generation:** the authored source produces shared primitives, a sampled route ribbon, instanced static families and separately transformable actor groups. Seed 2401 determines fixed tree rotation variation; time and runtime randomness never enter generation.
4. **Reproduction:** use the dependency lockfile and call `buildCityScene()` again. The art test compares all geometry position/index arrays and instance matrices across independent builds. No Python/Blender process, GLB encoder/decoder or downloaded model is needed.
5. **Companion still:** keep the editable `rainlight-005.svg` with its asset version and inline focus-point metadata. Regenerate by serving/copying this canonical SVG; changes to district composition require a deliberate matching vector edit and fallback-coordinate review. Earlier versions remain unchanged as historical artifacts.
6. **Verification and delivery:** run the art tests, lint and typecheck; review camera/focus views in the integrated runtime; measure renderer calls and device performance separately. Vite's hashed source bundle carries the procedural art, alongside the separately versioned original SVG.

Direct source generation is the chosen M2 equivalent reproducible-art workflow: it retains original source, dimensions, semantic manifests, stable pivots, deterministic output and explicit resource ownership without adding an export toolchain. The initial roughly thirteen-thousand-triangle prototype and the later expanded city use this same approach; their budgets are not interchangeable. GLB delivery is a possible later option if measured transfer/loading or an external art workflow requires it, not an outstanding M2 requirement or a claim that a binary export already exists.

## Separation of static and dynamic art

Static district geometry can be batched spatially and by material. Actors, foliage effects, fountain effects, and semantic hit targets should stay separately controllable. Roads and paths must agree geometrically with the simulation manifests; vehicles should not drive over curbs because the art and route graph evolved independently.

Use shared actor geometry/materials with instanced transforms when appropriate. Keep actor IDs stable through quality changes; do not assign a different identity just because an array was compacted. Optional wheels/limbs need simple local transforms, not a full skeletal system unless the art clearly requires one.

Night cues use restrained emissive/material variation rather than hundreds of dynamic lights. Street and park lamps ([`lighting.ts`](../src/content/lighting.ts)) are shared-geometry fixtures — a rubber pole, an emissive head or globe, and one additive ground pool disc each — ramped on together by the environment layer's normalized night value; the discs never cast shadows and park lamps stay clear of every walking-path body clearance. Building windows vary by a deterministic per-instance attribute: about a third stay unlit and the rest pick from several warm-to-cool tints, so night reads as an occupied skyline rather than one uniform wash. Rain can be a bounded shared particle representation with no per-drop objects. Use original procedural micro-animation sparingly.

### Original weather effects

The weather extension adds no downloaded assets. Rain streaks, radial snow sprites, impact rings and ripples are generated from code and standard primitives. Exposed surfaces receive wetness/coverage shaders and source-geometry-sharing snow-shell batches: vertices and matching shadow geometry rise with retained snow depth, including roof edges, streets, canopies and the park lawn/path materials. The layer is bounded and intentionally exaggerated at miniature scale; it is not individual-grain or snowbank simulation. Shell counts depend on source batches and must be remeasured for `rainlight-005`, not assumed to equal historical main or feature counts. Current results and visual limits belong in acceptance criteria.

Three original elliptical openings in the ground have shallow paraboloid beds, with rain-fed water surfaces that rise and expand rather than floating over uncut terrain. Their merged Great Lawn centers are X/Z (4, -3), (13, -4) and (5, 6), with rim Y=-0.035 and actual holes through both lawn overlays and the island base. The earlier basins were hidden by the new park. The relocated openings are authored away from buildings, both courts, park/city paths, gate approaches and cycle tracks; final clearance and visual checks remain pending. These small details are not new landmarks and do not change semantic IDs, route geometry, or the original fallback illustration's overview role.

Trees and reeds retain their authored rest geometry and palette; wind now drives their shared instance batches. Snow copies their changed transforms so it remains attached during sway. Rectangular precipitation covers +/-110 X and +/-170 Z, while the square 680x680 top-envelope/retention grid spans +/-170 on both axes at 0.5 m cells. The heights/retention arrays together occupy 3,699,200 bytes, excluding other CPU/GPU allocations; runtime measurements are pending. Precipitation also checks displayed snow and pool water height, and reservoir ripples align at water Y=0.018. The grid approximates canopy/roof boundaries, not gutters, vertical walls or sub-cell geometry. See [research and limitations](WEATHER_PHYSICS_RESEARCH.md); its original small-district grid/scene measurements describe the incoming-main study, not final merged coverage.

**Historical incoming-main measurement, before the connected-city merge:** CPU traversal counted **24,294 base-scene triangles, 174 potential mesh submissions and 23 materials**. With visible snow shells/clouds/garden rings, it counted **40,926 triangles, 214 potential mesh submissions and 27 materials**. Both included actor artwork and semantic meshes, not exclusively immobile district geometry. These were upper-bound scene counts before view culling, excluded point/line primitives and extra shadow passes, and were not measured GPU draw calls or FPS. That revision used 33 snow-shell batches sharing original geometry buffers. None of these figures describes the 94-building merged city or replaces its source-scene ceilings. Final merged and device profiling remain required.

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
