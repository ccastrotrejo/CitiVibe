# Art and assets

**Status:** the expanded park and city use asset version `rainlight-004`. A large car-free Central Park-inspired landscape replaces the compact park; original neighborhood blocks, two-way protected cycling and varied traffic surround it. Authored TypeScript remains the reproducible art workflow; reference photographs remain research only. The M1-M3 record below is historical and does not describe current source contracts, footprint or population.

## Expanded park original assets - rainlight-004

The ground expands from version 003's 136 x 124 m island to **220 x 340 m**. Six avenues at X = -102, -76, -46, 46, 76, 102 and six cross streets at Z = -162, -132, -95, 95, 132, 162 define thirty-six intersections and twenty-four surrounding blocks. Street geometry and movement share [`streets.ts`](../src/content/streets.ts). The former village buildings, copper gazebo and internal asphalt circuit remain removed.

[`streetscape.ts`](../src/world/streetscape.ts) adds original street-wall facades, floor-by-floor windows, cornices, fire escapes, roof tanks, stoops, public spaces, street trees, subway stairs, and construction detail. Bike paths and intersection markings are infrastructure, not advertising. Juniper Court (-63, 118) and Crosstown Steps (63, -118) accompany the three retained landmark IDs, each with an original semantic hit volume and camera anchor.

The [four-photo subway study](NYC_CITY_RESEARCH.md#subway-entrance-photo-study---2026-09-13) informs the Crosstown Steps refinement: recessed stairs, descending rails, green perimeter posts and globe lamps. This is original surface scenery, not an operational station or an accessible underground connection. No MTA marks, route bullets, real station names, advertisements or photo textures are shipped; globe colors imply no verified service status.

The models distinguish sedans, unbranded yellow cabs, vans, trucks, buses, and helmeted cyclists. Yellow cabs have lower cabins, dark glazing, trim, grille, door details and small original TAXI roof lights, without manufacturer/TLC logos, actual identification numbers or roof advertising. Cyclists have distance-driven wheels and alternating pedals. [`ActorInstances`](../src/world/actorInstances.ts) submits shared geometries/materials across **all 132 people/vehicle rigs and two sports balls** while preserving individually driven poses. It owns only instance buffers; the parent scene owns geometry/material disposal. The park has eighteen walkers and twelve runners. Runners have bent arms, exposed lower legs, light shoes and genuine running articulation; existing semantic actor IDs remain. The former garden bus/cars stay removed.

Juniper Court has an original compact 12 x 8 m basketball surface and adjacent 13.4 x 6.1 m pickleball surface, both centered on X=-61 at Z=119 and Z=108.5. Their shared [court manifest](../src/content/courts.ts) positions rims, net, markings, players and balls consistently. Four planted basketball rigs dribble, pass, shoot and rebound; two paddle players trade a bouncing ball across the pickleball net. Palette/primitive geometry and actor instance batches are reused. These compressed public-space layouts are not a regulation-facility or safety-code certification, and the games are ambient choreography rather than interactive sports.

[`park.ts`](../src/world/park.ts) authors a **78 x 176 m park**, trimmed about 10% per dimension after the user's follow-up: northern reservoir, dedicated running track, great lawn, southern meadow, western lake and pale shallow-arched bridge, a tree-lined mall, fountain/pergola terrace, rock clusters, slatted benches and dark perimeter railings. Trees use shared trunk/crown geometry, with denser edges and large open clearings. Tan paths and a darker running surface differ from pale city sidewalks. Tree placement excludes water and the whole path width; props keep interior paths and outside walker bodies clear. Path ribbons follow the same [`park.ts` content curves](../src/content/park.ts) as visitors, including four open gates and outside sidewalks. The bridge is scenery; no bridge-crossing visitor behavior is claimed. This is a compressed original interpretation of the [eight-photo study](NYC_CITY_RESEARCH.md#expanded-central-park-photo-study---2026-09-13), not a replica or a measured NYC map.

[`pavement.ts`](../src/world/pavement.ts) creates original flat bicycle/rider/arrow and pedestrian-running stencils from geometry, not downloaded icons or textures. All 120 protected-lane segments receive direction-aligned white marks away from stop bars and crosswalks. On the north and south park-adjacent streets, marks and stop bars share the signed two-way lane offsets: a 2.1 m green surface, opposing lane centers 1 m apart, a dashed yellow divider and low separator. Four contrasting runner stencils follow the reservoir loop. A NYC-specific runner stencil was not established by the image research; these are original functional cues, not replicas or traffic-engineering claims. The [image-reference record](NYC_CITY_RESEARCH.md#photo-reference-pass---2026-09-13) documents the source observations and limits.

[`rainlight-004.svg`](../public/city/rainlight-004.svg) is a self-contained original companion illustration of the enlarged park district, not a screenshot, copied reference image, or exact scene export. Its inline metadata records the authored focus points in a 1200 x 900 viewBox:

| Landmark | Illustration point | CSS left / top |
| --- | --- | --- |
| Rainlight Pavilion | 533.4, 511.635 | 44.45% / 56.8483% |
| Terrace Steps | 585.6, 507.36 | 48.8% / 56.3733% |
| Reservoir Walk (`reed-garden`) | 699, 432.975 | 58.25% / 48.1083% |
| Juniper Court | 238, 532.25 | 19.8333% / 59.1389% |
| Crosstown Steps | 962, 427.75 | 80.1667% / 47.5278% |

Scene and still were authored for this project from standard geometry and new vectors, without source-site models, textures, fonts, maps, brands, or signs. Earlier SVG versions remain unchanged as historical originals. A neutral sky-matched unlit backdrop avoids tinting the whole city yellow, while world lighting and tagged windows still respond to time/weather. Rain/cloud coverage and shadow bounds expand with the scene; effects retain their fixed allocation caps.

The subsequent six-by-six street expansion explicitly revises the CPU geometry ceiling from version 003's 200,000 to **550,000 triangles**, while tightening the visible mesh-submission ceiling from 240 to **110** and retaining **36 materials**. The additional blocks, landscape and runners must fit these bounds without removing controls or weakening collision checks. These are source-scene accounting limits, not revised or verified device FPS goals. Record actual measurements in [acceptance criteria](ACCEPTANCE_CRITERIA.md).

There are **132 animated people/vehicles** and two sports balls. Final building and scene traversal counts belong in [acceptance criteria](ACCEPTANCE_CRITERIA.md); earlier version-002/003 counts are superseded. CPU geometry counts exclude extra renderer passes and are not FPS measurements. Static shadows are cached; moving actors do not cast into the cache. Rain/cloud budgets remain fixed, and unchanged actor poses are not resubmitted between simulation ticks.

**Review scope:** overview, reservoir runners, paired cycling, park and street-detail focus, Night/Rain and Mist/Lightweight; record the final executed checks in acceptance criteria. Browser layouts target 1024 x 768, 1440 x 900 and 1920 x 1080, including five-landmark cycling and fallback. The title card is removed; an offscreen h1 preserves accessible naming without covering the map. Physical-device GPU and assistive-technology verification remain outstanding; mobile-specific hardening is not an acceptance gate.

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
2. **Validation:** `buildCityScene()` validates art and landmark inputs before constructing resources. Street stop bars, actor footprints, park gates and shared paths require coordinated simulation changes, not independent decorative adjustments.
3. **Generation:** the authored source produces shared primitives, a sampled route ribbon, instanced static families and separately transformable actor groups. Seed 2401 determines fixed tree rotation variation; time and runtime randomness never enter generation.
4. **Reproduction:** use the dependency lockfile and call `buildCityScene()` again. The art test compares all geometry position/index arrays and instance matrices across independent builds. No Python/Blender process, GLB encoder/decoder or downloaded model is needed.
5. **Companion still:** keep the editable `rainlight-004.svg` with its asset version and inline focus-point metadata. Regenerate by serving/copying this canonical SVG; changes to district composition require a deliberate matching vector edit and fallback-coordinate review. Earlier versions remain unchanged as historical artifacts.
6. **Verification and delivery:** run the art tests, lint and typecheck; review camera/focus views in the integrated runtime; measure renderer calls and device performance separately. Vite's hashed source bundle carries the procedural art, alongside the separately versioned original SVG.

Direct source generation is the chosen M2 equivalent reproducible-art workflow: it retains original source, dimensions, semantic manifests, stable pivots, deterministic output and explicit resource ownership without adding an export toolchain for roughly thirteen thousand triangles. GLB delivery is a possible later option if measured transfer/loading or an external art workflow requires it, not an outstanding M2 requirement or a claim that a binary export already exists.

## Separation of static and dynamic art

Static district geometry can be batched spatially and by material. Actors, foliage effects, fountain effects, and semantic hit targets should stay separately controllable. Roads and paths must agree geometrically with the simulation manifests; vehicles should not drive over curbs because the art and route graph evolved independently.

Use shared actor geometry/materials with instanced transforms when appropriate. Keep actor IDs stable through quality changes; do not assign a different identity just because an array was compacted. Optional wheels/limbs need simple local transforms, not a full skeletal system unless the art clearly requires one.

Night cues can use restrained emissive/material variation rather than hundreds of dynamic lights. Rain can be a bounded shared particle representation with no per-drop objects. Use original procedural micro-animation sparingly.

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
