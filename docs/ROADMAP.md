# Ambient-only roadmap

**Status: all roadmap goals M1-M8 authorized on 2026-09-12; implementation and verification in progress.** The latest requests expand the initial M1-M3 scope, add an NYC-inspired visual identity, and ask for detailed updates. Earlier removals remain binding: no actor-follow features, no drone, and no mobile-edge-case work. The planned occasional airplane is included in the all-roadmap implementation scope. Read [AGENTS.md](../AGENTS.md) and the [product boundary](PRODUCT_BRIEF.md) first.

**Historical main-branch checkpoint (M5 reached; M1-M4 implemented).** Main at `a0dcac3` provided the original district, 1-bus/3-car/8-walker garden simulation, complete camera/control surface, environment/audio, quality presets and occasional airplane. It also configured Vercel static hosting. The connected-city slice below replaces its central vehicle loop and supersedes its geometry/population counts while preserving the control, environment and lifecycle contracts. Unchecked hardening items remain outstanding; this is not a completed M1-M8 product claim.

**Current follow-up:** main's population commit `121817c` and the street-sign feature `e7a49dc` were merged and pushed as `0d76990`. The user subsequently removed landmark selection end to end: toolbar, map clicks, bracket shortcuts, highlights, descriptions and landmark-specific tours. Retain manual camera controls and all six city-wide tour/guided views. Finish integrated checks on existing PR #6; do not create a duplicate or deploy. Older landmark requirements below are historical and superseded by this decision.

**Platform update:** desktop/laptop-first. The user explicitly excluded mobile edge-case work; phone-specific acceptance/profiling is no longer required. Current layout verification targets 1024x768, 1440x900, and 1920x1080.

Dependencies favor working vertical slices. Accessibility, cleanup, failure handling, and basic profiling start in milestone 1; the later hardening milestones broaden coverage rather than postponing those responsibilities.

## Latest authorized slice - connected NYC-inspired neighborhood

**2026-09-17 ordinary fleet:** implement the approved all-six-group refinement of ordinary moving and parked cars, taxis, vans, box trucks and compressed buses. Preserve all 48 motor IDs, the approved ten-vehicle emergency fleet, traffic behavior, static curb placements and unchanged scene budgets. Shared passenger shells, ID-stable silhouette variation and original planar TAXI lettering keep the change bounded. The user subsequently authorized a new PR, followed by further vehicle polish; no merge or deployment is authorized. Current results belong in [acceptance criteria](ACCEPTANCE_CRITERIA.md), with source limitations in the [ordinary-fleet study](NYC_ORDINARY_VEHICLES_RESEARCH.md).

**2026-09-16 weather-aware people:** implement researched, ID-seeded rainwear/umbrella choices, cold-weather layers and conservative weather-dependent pace. The user chose visible park departures and walking outside rather than invented indoor shelters: the eight existing seated neighbors stand, leave through the east gate, circulate outside, and return via the south gate after stable suitable conditions. Preserve the same 328 people, original city, traffic rules, gates, snow support, pause/recovery and budgets. The eight formerly static neighbors join the existing actor collection; this is not a population increase. The [research study](PEOPLE_WEATHER_RESEARCH.md) and current [verification record](ACCEPTANCE_CRITERIA.md) distinguish implemented behavior from scientific claims and remaining acceptance gates. The user subsequently approved commit, push and a pull request. Deployment remains excluded.

**2026-09-16 station/signal appearance follow-up:** implement the approved original silver tapered dock design with dark inset faces and open wheel guides. Apply the supplied signal illustration's yellow-shell/dark-face treatment to existing vehicle/pedestrian lights only; preserve meanings, timing and routes rather than add bicycle-specific signals. Retain the completed rider-motion fix, inventories, clearances and existing geometry budgets. The station image could not be inspected, so its separately approved design is not claimed as a reference match. Local work only.

**2026-09-16 shared-bike correction:** fix the stuck Juniper station user and research/implement original classic and electric shared bikes. Replace its indefinite gap wait with retained, body-clear crossing admission; correct saddle/hand and active-dock marker coordinates. Mix stable classic/electric models across docked and ridden bikes without changing actor counts, routes, scene-budget limits or controls. Preserve pause/recovery, reduced motion, snow support and existing safety rules. Source evidence is in the [bike study](NYC_CITY_RESEARCH.md#classic-and-electric-shared-bikes---2026-09-16); this request authorizes local work only, not publication or deployment.

**2026-09-15 building-fabric follow-up:** NYC is the standing visual direction for all subsequent visual development. Replace incidental gaps with attached street-wall runs while preserving intentional yards, planted openings and public access. The bounded implementation keeps all 94 buildings and the existing grid, joins 57 gaps across 75 buildings, and distinguishes 19 offices, 32 mixed-use storefront buildings and 43 residential buildings. The [research/photo record](NYC_BUILDING_FABRIC_RESEARCH.md) supports the direction without making a literal map, copying architecture/brands or adding commerce. Preserve population, traffic, park, full-size courts, bicycle/subway access, weather, lighting and controls; no publication or deployment is authorized. Current verification is recorded separately in [acceptance criteria](ACCEPTANCE_CRITERIA.md).

**2026-09-14 roadmap-completion follow-up:** the current session raises the bounded population to **328 people** — 200 street walkers, 55 park walkers, 24 runners, fifteen road cyclists, nine roaming shared-bike riders, three station users, six court players, eight meadow figures and eight resting neighbors — with 48 motor vehicles unchanged (354 traveling rigs). The per-block pedestrian cap is lifted to eleven so cross-street flow survives the denser sidewalks. The docked shared-bike neighbor now carries a subtle deterministic idle so it never reads as frozen, and the optional M3 refinement lands as an ambient occasional balloon bunch (`src/world/balloons.ts`) that mirrors the airplane's bounded, seeded, disposable, reduced-motion-aware pattern. Work is tracked on PR #18; deployment is not authorized. The 464-person doubling target below remains separate and unimplemented.

**2026-09-14 lakeside refinement:** correct the screenshot's bridge/fountain overlap and stepped profile, finish both pergolas, and enrich pond color and shoreline planting. Preserve existing paths, population, trees, weather, controls and scene budgets. This is a bounded original-art refinement, not a broader park redesign, new bridge-walking simulation or population increase. The user subsequently approved the result and requested a commit, push and pull request against main; deployment remains excluded. See [art details](ART_AND_ASSETS.md#lakeside-refinement---2026-09-14) and [current verification](ACCEPTANCE_CRITERIA.md#lakeside-refinement---2026-09-14).

**2026-09-13 street-life follow-up:** the new session adds a bounded increase in people and moving cars, stationary curbside cars, sidewalk food carts, mailboxes, more street/park benches, seeded architectural variation, and original blue bike-share stations with visible use. Subsequent corrections require genuine two-way sidewalk walking, cabless sidewalk carts rather than road trucks, and at least ten bicycles docked side by side in each station, including beside Juniper Court. Current implementation has 328 people, 48 moving motor vehicles, twelve parked cars, four carts and three ten-bike stations. Preserve physical body clearance, crossings and landings, park gates, cycle tracks, all existing scenery/lighting/weather/controls and retained pause/recovery. This is not permission to copy brands or introduce a rental/payment product. The independent [street-furniture study](NYC_CITY_RESEARCH.md#street-life-reference-study---2026-09-13) informs the original geometry. Work stays local; the older PR/merge instructions below are historical.

**2026-09-13 movement follow-up:** [five-source movement research](PEOPLE_AND_ACTIVITY.md#movement-research-and-design-decisions) informs seeded destinations, brief activities and 72 crosswalk connections between neighborhood blocks. Preserve the fixed population, car-free park, weather, controls and retained pause/recovery state while verifying the new movement rules. Latest main's night/vehicle/court lighting (`06ecb95`) is integrated, including its retained-pose restoration; publication follows combined validation.

### Next planned task - double the people

- [ ] Reach the previously requested **464 people total**, including resting figures. The original doubling proposal started at 232; the separate street-life follow-up now has 328 people and 48 moving motor vehicles. Reconcile the remaining human allocation against that newer baseline rather than applying the obsolete 232-person/36-vehicle accounting. This target is not yet implemented and does not itself authorize another vehicle increase.
- [ ] Allocate the additional people across street/park walking, running, cycling, meadow and resting activity. Confirm safe court capacity/choreography before increasing its six-player population; do not shrink people or playing surfaces to fit.
- [ ] Increase route, crossing and destination capacity only where clearance allows; verify progress without overlap, starvation, blocked park gates or a crowded landing deadlock.
- [ ] Measure the enlarged scene's geometry, submissions and desktop frame times, then run behavior, lifecycle and browser checks. Do not silently raise budgets or substitute CPU counts for physical-device performance.

**2026-09-13 population follow-up:** expand and diversify people, not the street grid or UI. The implementation adds thirteen work roles, age-scaled people, independent appearance/accessories, purposeful walking pace, running sportswear and six children playing near two guardians. The bounded target is 224 active/posable people (260 rigs including vehicles), plus eight resting neighbors and two balls. Shared per-instance colors keep material/submission limits unchanged; the richer, roughly 49% larger human population revises the base triangle allowance from 550,000 to 600,000. Earlier density counts below are historical. See [people and activity](PEOPLE_AND_ACTIVITY.md) and [current verification](ACCEPTANCE_CRITERIA.md). No publication or deployment is requested in this follow-up.

On 2026-09-12 the user explicitly resumed implementation from the latest main and requested a substantially larger city, multiple roads/intersections/traffic lights, vehicle variety, bike paths, and deeper NYC research. This supersedes the earlier M3 population cap and the reflection pause for this bounded slice. It does not authorize every possible feature listed by the research or restore excluded commerce, drones, camera follow, GIS, or backend systems.

The first expansion delivered a four-by-four grid, 32 buildings and 68 moving actors around a **car-free park**. Subsequent feedback enlarged the city and photograph-informed park, then slightly reduced the park to favor city streets. The current follow-up retains six avenues, six cross streets, thirty-six intersections, twenty-four surrounding blocks, 94 buildings and a 78 x 176 m park within a 220 x 340 m map. The latest density request raises the bounded population to 186 people/vehicles: 36 motor vehicles, twelve cyclists, 96 neighborhood walkers, twenty-four park walkers, twelve runners and six court players. Full-size courts, compact distributed subway entrances and more protective sheds/scaffolding are session-specific requests. Two-way cycling and all park features retain pause, focus/tour and fallback contracts. The title card and Field guide header button remain removed; keyboard help remains available. Subway entrances remain scenery, not working transit. See [verified research and image observations](NYC_CITY_RESEARCH.md). Street bus dwell, walking road crossings, operational subways, active construction simulation and broader waterfront/seasonal systems remain follow-on work.

The original M1-M5 checkpoint below remains a historical baseline. The connected-city verification record in [acceptance criteria](ACCEPTANCE_CRITERIA.md) supersedes its old geometry and population counts. M6/M7 physical-device and long-session sign-off remain separate.

**Latest court correction:** the user approved full-size basketball (28.6512 x 15.24 m) and pickleball (13.4112 x 6.096 m) without shrinking people. Both fit the existing wide parcel south of the park with full runoff and a shared passage; local building relocations retain all 94 buildings. Six players use grounded movement and contact-aligned 24-second basketball/5.6-second pickleball practice cycles. Preserve fixed net/rim targets under snow, deterministic pause/recovery and reduced-motion stills. This supersedes the earlier half-scale correction and does not authorize a sports engine.

**Latest streetscape correction:** eight smaller entrances sit at frontage edges with real below-grade stairs and matching ground/backdrop openings. Add protective sidewalk sheds and facade frames to ordinary buildings, not only visibly active construction sites; keep complete walking channels and gate/entrance access clear. Automatic quality, broad input-parity work and M6/M7 hardening remain deferred rather than being substituted for these session requests.

### Retained incoming-main weather and interface work

Keep source-backed rain/snow/wind, retained snow/water and visible snow depth, three rain-fed ground pools, 0-30 mm/h rain intensity, cautious wet/snowy traffic, and smooth retained transitions. Weather sampling, pool placement and snow batches must be reconciled with the enlarged map and shared park/court/traffic contracts rather than retaining old small-district bounds. Pause, reduced motion, consent-gated sound and graphics recovery remain mandatory.

Keep one lower-left Settings trigger and compact non-modal dock, with Pause/Tour/Fullscreen in the bottom toolbar and Help still modal. Preserve CitiVibe naming, removal of the title overlay and Field guide button, and help through Settings/`?`. This is not the broader charcoal/transit UI redesign. Vercel's immutable hashed-asset cache, shorter illustration cache, revalidated app shell and response headers remain configuration only; no deployment is part of this work.

**Published merge adaptations (`48dc3fe`):** rectangular city-wide precipitation, a 680x680 half-meter height grid, wind on shared tree/reed batches, lawn/path snow shells, relocated Great Lawn basins with holes through lawn/base geometry, aligned reservoir ripples and weather-revision shadow refresh. The compact dock and bottom-only landmark controls retain the CitiVibe/help changes. Their published automated record is separate from current follow-up verification; see [acceptance criteria](ACCEPTANCE_CRITERIA.md).

## Milestones

### Night-lighting follow-up - 2026-09-13

The user requested extensive light-physics research and smoother nighttime illumination, including working vehicle headlights, rear/brake lamps and turn indicators, and asked to pull latest main first. The worktree was already current at fetched main `b81eb32`. The [lighting study](LIGHTING_RESEARCH.md) records sixteen primary sources and distinguishes physical facts from artistic approximations.

The implementation adds soft public/vehicle footprints, subtle halos, bounded local spotlights, linear-color/output handling, behavior-driven vehicle lamps, bicycle lights, taxi/subway fixture emission and non-emissive vehicle glazing. Pause/reduced-motion and exact graphics-recovery lamp poses are covered. Existing city geometry, controls and traffic movement remain; no yellow-phase redesign, global illumination, new dependency, commit/push or deployment is included. Current executed checks and browser limitations belong in [acceptance criteria](ACCEPTANCE_CRITERIA.md#night-lighting-follow-up---2026-09-13), not the historical milestones below.

| ID | Milestone | Depends on | Rough effort |
| --- | --- | --- | --- |
| M1 | Small interactive original slice | Explicit implementation request; confirm reference devices | 16-28 h |
| M2 | Original coherent district | M1 | 24-42 h |
| M3 | Believable street activity | M2 route/anchor contracts | 22-40 h |
| M4 | Complete controls and contextual views | M1 camera contract; M2/M3 targets | 16-30 h |
| M5 | Weather, light, and optional sound | M1 clocks; M2 art; M3 activity | 14-26 h |
| M6 | Responsive and accessibility hardening | M4/M5 complete feature surfaces | 14-26 h |
| M7 | Performance and long-session reliability | M1-M6 | 14-28 h |
| M8 | NYC-inspired world and interface | M2 art; M4/M5 behavior | Profile and scope before estimating |
| Original total | M1-M7 ambient scope, excluding the later M8 addition | No commercial systems | **120-220 h** |

### M1 - Small interactive original slice

- [x] Confirm a modest original scene concept, camera projection, reference desktop/laptop, and implementation stack/package manager.
- [x] Build one small original block, one original landmark, and one closed route with an ordinary bus.
- [x] Connect real pan/zoom/rotate/reset, landmark focus, pause/resume, and keyboard alternatives.
- [x] Provide an original loading still and error/teardown paths, hidden-tab suspension, and muted-by-default behavior even before audio exists. _The still is kept as a loading and WebGL-failure backdrop; the earlier user-facing static opt-out was removed so normal use is always live._
- [x] Add camera/clock tests and a small browser interaction path.

**Done when:** the slice is genuinely interactive, not a fake poster/demo; navigation cancels focus transitions predictably; pause and a hidden-tab return cause no actor jump; controls are operable on supported desktop layouts; mount/unmount leaves no active loop. Satisfy applicable AC-01 through AC-07 and AC-17 through AC-20 in [acceptance criteria](ACCEPTANCE_CRITERIA.md). _Implemented and covered by unit + Playwright tests._

### M2 - Original district

- [x] Author a new seeded generation pipeline or equivalent reproducible original-art workflow.
- [x] Add a coherent small street graph, contrasting building families, plaza/landscape, and several original POIs.
- [x] Export versioned geometry plus separate POI/route/tour anchors with stable IDs and validation.
- [x] Replace the blockout with optimized original assets; regenerate the original fallback/poster.
- [x] Review overview silhouette and multiple focus views; align stop lines, sidewalks, and routes with art.

**Done when:** regeneration retains semantic references, asset provenance is complete, no source artwork or names are copied, the district is navigable without clipping, and the initial geometry budget is measured. Applicable AC-03, AC-05, AC-15, AC-16, AC-19. _Implemented; geometry budget measured (draw calls 170/180, triangles 23,418/25,000, materials 23/24). The NYC-era silhouette rework returns in M8._

### M3 - Street activity

- [x] Add cars, pedestrians, bus stop dwell, and explicit crossing/intersection conflict rules.
- [x] Vary speeds and route phases deterministically; include a few waiting/sitting people.
- [x] Keep the moving population bounded to one bus, three cars, and eight walkers; no drone.
- [x] Add restrained micro-animation and occasional seeded events after core movement is stable.
- [x] Treat motorcycles, skating figures, and balloons as optional refinements. _Balloons landed as an ambient occasional drifting bunch (`src/world/balloons.ts`), mirroring the airplane's bounded, seeded, disposable, reduced-motion-aware pattern; motorcycles and skating figures remain deferred. Cyclists were subsequently requested and implemented in the connected-city slice; the original garden traffic cap and bus dwell are historical, not current behavior._

**Done when:** route loops are continuous, cars and crossing pedestrians obey the chosen conflict rules, bus stops are believable, target IDs survive quality changes, and the seeded scene runs ten minutes without runaway spawning or deadlock. Applicable AC-04, AC-05, AC-08, AC-15, AC-18. _Implemented with `moving`/`waiting`/`dwelling` states and signal arbitration; the ten-minute soak is folded into M7 long-session profiling._

### Additional approved goal - Occasional airplane fly-by

**Initially plan-only; included by the subsequent all-roadmap authorization.** Replace the removed drone concept with a rare, distant airplane passing above the district. No airplane-follow control, selection action, notification, or new audio requirement.

- [x] Author one original lightweight airplane silhouette with an above-rooftop flight corridor and off-screen entry/exit.
- [x] Schedule at most one airplane at a time with seeded gaps. Working proposal: one pass every 90-180 simulated seconds, with no permanent circling or spawning buildup.
- [x] Drive both travel and scheduling from the simulation clock: pause freezes them; hidden-tab return must not catch up or burst-spawn. Suppress passes under reduced motion.
- [x] Verify deterministic timing, bounded allocation/cleanup, desktop composition, and safe separation from buildings before enabling it.

### M4 - Controls and contextual tours

- [x] Complete original-landmark focus cycling and concise contextual status without a directory/card catalog.
- [x] Support Command/Control-drag and right-drag orbit with bounded vertical tilt, projection-correct panning, and equivalent buttons/shortcuts across the whole modeled district.
- [x] Implement global/contextual tour segments and explicit tour Stop.
- [x] Wire interruption, modal-close, pause, unavailable-target, and reduced-motion guided-view behavior through one camera state machine.
- [x] Complete help, fullscreen or clearly labeled expanded-view fallback, and preference controls.
- [x] Add cross-input parity tests so toolbar, shortcuts, and touch invoke the same commands. _One shared action table in `src/app/commands.ts` now defines every camera and city command; the toolbar and the keyboard handler both read it, and `src/app/inputParity.test.tsx` verifies button, shortcut and pointer/touch agreement._

**Done when:** all camera transitions follow the experience contract; no camera resumes unexpectedly after manual input/modal dismissal; all actions have discoverable keyboard-operable controls. Applicable AC-02 through AC-06, AC-10 through AC-14. _Functionally implemented: toolbar buttons, keyboard shortcuts and scene gestures dispatch identical world commands from one shared action table, covered by the parity suite. Remaining: final desktop QA under M6._

### M5 - Weather, light, and optional sound

The checked weather/dock work below reflects its incoming-main implementation checkpoint. Expanded-city integration and final browser/GPU verification are separate gates; pre-merge CPU coverage must not be presented as a merged passing suite.

- [x] Add Sunny/Cloudy/Rain/Mist/Snow/Windy with explicit presets and optional seeded natural changes.
- [x] Add Afternoon/Night/Local clock/Day-night cycle with clear fictional-weather labeling.
- [x] Implement pause-safe environment clocks and local-time lighting resynchronization.
- [x] Add a small original audio design, master volume/mute, explicit enable, and visible failure/retry state.
- [x] Tie effects to quality and reduced-motion settings without removing essential control.
- [x] Extend weather with source-backed terminal rain, slower advected snow, coherent wind/foliage, roof interception, retained water/SWE and melt, wet/snow materials, garden ripples, and cautious traffic. See the [17-source research and implementation report](WEATHER_PHYSICS_RESEARCH.md). Surface time compression, empirical coefficients, and omitted spatial hydrology/CFD are explicit.
- [x] Add bounded snow-shell depth on roofs, streets and canopies, matching shadow displacement and ground-contact height, three rain-fed ground depressions, and a physical rainfall-intensity contract. Incoming-main CPU/render-adapter coverage was recorded; merged-map coverage and the browser verification gate remain open.
- [x] Replace the lower-left landmark card with one standalone Settings trigger and a compact non-modal dock above it; move landmark navigation into the bottom toolbar. Preserve Help modality, focus return, city input and pause access.
- [ ] Complete the final integrated Chromium run and visual review of accumulated depth/pools and the latest intensity UI. Current local browser launch failures occur before any page loads; do not count older screenshots as validation of the new geometry.

**Done when:** every weather/time combination remains legible, no environment effect catches up through hidden time, sound is silent until explicitly enabled each load, and audio suspends/disposes correctly. Applicable AC-06 through AC-11, AC-15, AC-17, AC-18. _Implemented and automatically verified in the published merge; later artwork requires renewed checks. Final cross-combination legibility sign-off remains with deferred M6/M7 work._

### M6 - Desktop and accessibility hardening

- [ ] Exercise 1024/1440/1920 px computer layouts and enlarged text.
- [ ] Check every control's visibility/hit target and prevent overlay input leaking to the world.
- [ ] Complete modal focus, shortcut scoping/help, meaningful status announcements, and screen-reader fallback.
- [ ] Test reduced-motion transitions, stepwise tours, static focus navigation, and sound-independent operation.
- [ ] Test supported desktop browsers and assistive technology on a physical computer.

**Done when:** the complete keyboard route and fallback are usable without adding a directory; no primary control is obscured; panels scroll without moving the scene. Applicable AC-02, AC-09 through AC-14, AC-19. _Partially covered by automated desktop layouts, axe, keyboard, modal and fallback checks. Enlarged-text, cross-browser and physical assistive-technology sign-off remain outstanding._

### M7 - Optimization and hardening

- [ ] Profile real frames, assets, draw calls, heap/GPU proxies, and long-session behavior on the agreed devices.
- [ ] Tune geometry/material sharing, instancing/culling, bounded DPR, effect caps, and Automatic quality hysteresis.
- [ ] Verify resource cleanup, failed/late loads, context loss/restoration, repeated retry, and hidden-tab recovery.
- [ ] Establish deterministic visual fixtures across seed/time/weather/quality; check scene and UI regressions.
- [ ] Record the measured result and any approved budget revisions; leave no claim supported only by a screenshot.

**Done when:** the applicable full [acceptance matrix](ACCEPTANCE_CRITERIA.md) passes or explicit limitations are approved and documented. No hidden analytics, backend, commercial features, or unlicensed runtime assets. _Partial: all-actor instancing, static-shadow caching, coalesced navigation rendering, resource disposal and multi-seed ten-minute simulation soaks are implemented. Physical frame/heap profiling, adaptive-quality runtime calibration and two-hour visible/hidden stability remain outstanding._

### M8 - NYC-inspired world and interface

Replace the initial garden-village feel with an **original fictional NYC-like neighborhood**, not a literal map or a recreation of named buildings. Execute this visual pass before the final M6/M7 accessibility and performance sign-off so measurements cover the final artwork.

- [x] Refine the original ambulance/fire vehicles and add patrol-SUV artwork in two existing sedan slots using [NYC fleet research](NYC_EMERGENCY_VEHICLES_RESEARCH.md). Retain 48 motor vehicles, existing safety envelopes, weather/lighting and controls; no real department branding or emergency-response behavior. The user subsequently authorized a commit, push and new PR, not deployment.
- [x] Make NYC the durable visual direction, with source-backed attached building groups, ordinary offices and stores beneath upper floors; preserve meaningful public openings rather than squeezing sidewalks to obtain density. See the 2026-09-15 building-fabric slice above.
- [x] Create a denser street-wall silhouette with original brick/brownstone and limestone mid-rises, varied cornices, fire escapes, rooftop water tanks, and restrained taller accents.
- [x] Rework streets and public space toward asphalt, concrete sidewalks, curb details, railings, small tree pits, and a car-free central park. Keep routes, gate openings, stop bars and painted lane symbols aligned.
- [x] Begin original NYC-inspired street naming on the current grid: twelve primary junctions carry paired green blades covering all twelve roads, mounted on existing signal poles. The 2026-09-13 sign pass preserves two-way traffic and the existing scene budgets; it is not a claim of signage at every intersection or traffic-code certification.
- [x] Give ordinary cars a restrained yellow-cab visual cue without copying taxi-company branding, logos, or commercial signage. Preserve buses, pedestrians, and the rare airplane; no drone or camera-follow actions.
- [x] Replace the soft garden palette and decorative UI voice with an understated urban/transit-inspired desktop control system: clear typography, charcoal/stone surfaces, warm brick, and limited yellow accents. Keep the world dominant, not a marketing page. _2026-09-13: implemented in `src/styles.css` — Helvetica Neue transit wordmark, charcoal ink (#1e2124)/stone paper (#e5e3de) surfaces, warm brick accent (#b0472b), limited signal-yellow (#f2b01e) pressed-state underline. Control-dock hit targets raised to 44px; Settings anchored lower-left via flex order while preserving DOM tab order. Verified via App/inputParity unit tests and desktop e2e (settings/city overflow specs green under swiftshader)._
- [x] Update landmark descriptions/forms and camera compositions coherently; preserve the three original IDs and add Juniper Court/Crosstown Steps across focus, tour and fallback.
- [ ] Regenerate the original static illustration, revise asset provenance/versioning, and inspect overview, focused, night, rain, and mist views. _Version 004 is the new six-by-six companion illustration; final integrated visual verification remains pending. Version 003's final screenshot pass was blocked by browser startup failures._
- [ ] Re-run scene budgets, desktop accessibility, deterministic visuals, and resource-lifetime checks after the art change. _Feature-branch pre-merge unit/resource/budget checks passed. Rerun after weather/settings integration. Browser startup/navigation remains blocked; do not substitute earlier passing scenarios for final artwork verification._

**Done when:** the scene and chrome read as one NYC-inspired experience at supported desktop sizes, not just a color swap; no exact real-city layout, source artwork, branded billboard, directory, or commercial feature has been introduced; camera/actor/fallback behavior remains correct. _Requested world/detail implementation complete. 2026-09-13: the charcoal/transit desktop UI redesign is now implemented and unit/e2e-verified; final on-hardware browser/visual verification (M6/M7 sign-off) remains separate and human-gated._

## Estimate interpretation

These are rough planning proposals for an experienced developer with original procedural-art work, iteration, and testing included. They are neither verified author effort nor delivery guarantees. A **visual prototype might take 40-80 hours**, overlapping the early milestones; do not add that range to the 120-220 hour total.

The earlier 250-450 hour full-commerce concept is **not the scoped estimate** and should not drive staffing or the backlog. Removing payments, advertiser workflows, identities, moderation, and analytics changes the project substantially. Additional original art complexity, demanding low-end devices, or extensive audio work may increase effort; any expansion needs an explicit decision.

## Scope-change gate

Do not fill perceived gaps with a backend, directory, multiplayer, editor, real map data, live weather, or monetization. A future user request can change scope, but an archived reference screen or starter prompt cannot. Prefer completing the next ambient vertical slice to expanding the feature list.
