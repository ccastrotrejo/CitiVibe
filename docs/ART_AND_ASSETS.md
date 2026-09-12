# Art and assets

**Status:** proposed original-art pipeline. No new models, textures, audio, or app assets have been generated. Imported screenshots are research only.

## Originality and rights

Create an original district, not a reconstruction of Opportunity.city or its distinctive composition. Do not download or reuse its `city.glb`, original JavaScript/CSS, fonts, logo, brand marks, promotional text, building names, or artwork. Do not trace screenshots or use a screenshot as a texture, loading poster, splash screen, or fallback.

Broad ideas such as a low-poly miniature, repeated building modules, lively streets, and warm lighting are useful references. The new skyline, street graph, building family designs, landmark forms, typography, color system, and scene composition must be independently designed. Source measurements in [reference analysis](REFERENCE_ANALYSIS.md) are observations, not artistic targets.

The source GLB has zero embedded textures/images and a generator string naming a Python script. That supports colored procedural geometry as a useful approach; it does not provide an original script, license, or proof that all source visuals were procedural.

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
| Actors | Simple ordinary buses, cars, people and a drone, authored separately with coherent scale and pivots. |

A building's roof detail should not cost more than the whole actor system without a visible benefit. Close views need enough geometry to hold up, but the overview composition remains the main use.

## Deterministic generation pipeline

1. **Blockout:** define an original street graph, district extents, landmark placement, camera-safe anchors, and walking/vehicle routes. Review silhouette and negative space before adding detail.
2. **Generator:** a new Python geometry generator produces building families, ground/roads, and reusable props from explicit dimensions and a seed. `trimesh` is optional if it removes real export/mesh work; do not install anything for this handoff.
3. **Art refinement:** optional Blender work can refine newly authored geometry, normals, pivots and landmarks. Use it for original art, not importing/tracing the reference.
4. **Semantic export:** emit a separate versioned POI/route/anchor manifest. IDs and coordinates must stay stable when meshes are reordered or merged. Check units (meters), Y-up, bounds, origins, and actor pivots.
5. **Optimization:** deduplicate materials, remove invisible interior faces, weld where appropriate, merge sensible static batches, and instance repeated elements. Consider glTF Transform and Meshopt only after testing visual quality, decoder cost, and target browser support.
6. **Delivery:** export original versioned GLB files, a matching manifest, original static poster/fallback art, and an asset provenance record. Validate the bundle and compare against the agreed render/bandwidth budgets.

Keep the deterministic source inputs and generator version so an agent can reproduce a district without manually editing an opaque binary. Do not use mesh names alone as the semantic contract. Geometry regeneration must not silently strand camera anchors or bus stops.

## Separation of static and dynamic art

Static district geometry can be batched spatially and by material. Actors, foliage effects, fountain effects, and semantic hit targets should stay separately controllable. Roads and paths must agree geometrically with the simulation manifests; vehicles should not drive over curbs because the art and route graph evolved independently.

Use shared actor geometry/materials with instanced transforms when appropriate. Keep enough identity to follow a chosen bus across a quality change; do not replace it with a different instance just because an array was compacted. Optional wheels/limbs need simple local transforms, not a full skeletal system unless the art clearly requires one.

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
