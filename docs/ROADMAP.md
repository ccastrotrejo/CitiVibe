# Ambient-only roadmap

**Status: all roadmap goals M1-M8 authorized on 2026-09-12; implementation and verification in progress.** The latest requests expand the initial M1-M3 scope, add an NYC-inspired visual identity, and ask for detailed updates. Earlier removals remain binding: no actor-follow features, no drone, and no mobile-edge-case work. The planned occasional airplane is included in the all-roadmap implementation scope. Read [AGENTS.md](../AGENTS.md) and the [product boundary](PRODUCT_BRIEF.md) first.

**Milestone checkpoint (M5 reached; M1-M4 implemented).** The live build integrates the full M1-M3 foundation (original district, closed route, bounded 1-bus/3-car/8-walker simulation with signal arbitration and deterministic locomotion), the M4 control surface (landmark focus cycling, Command/Control-drag orbit, continuous and per-landmark tours with explicit Stop, reduced-motion guided views, help/fullscreen/preferences, all routed through one camera state machine), the **M5 environment + audio surface** (Sunny/Cloudy/Rain/Mist, Afternoon/Night/Local/Cycle time, quality tiers, pause-safe clocks, and gesture-gated ambient sound with mute/volume), and the **occasional airplane**. The world was also enlarged around the tuned core (a deterministic outer skyline revealed on pan/zoom-out) within the same draw-call/material budget, and the app is configured for static deployment on Vercel (`vercel.json` + verified production build). Remaining: a dedicated cross-input parity test for M4, M6 desktop/accessibility hardening, M7 performance/reliability sign-off, and the M8 NYC identity pass. Unchecked items below are not completed-product claims; final legibility/perf/accessibility verification is deferred to M6/M7 after the M8 artwork.

**Platform update:** desktop/laptop-first. The user explicitly excluded mobile edge-case work; phone-specific acceptance/profiling is no longer required. Current layout verification targets 1024x768, 1440x900, and 1920x1080.

Dependencies favor working vertical slices. Accessibility, cleanup, failure handling, and basic profiling start in milestone 1; the later hardening milestones broaden coverage rather than postponing those responsibilities.

## Milestones

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
- [ ] Treat cyclists, motorcycles, skating figures, and balloons as optional refinements, not systems required before completion. _Intentionally deferred; optional, not required for completion._

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
- [ ] Add cross-input parity tests so toolbar, shortcuts, and touch invoke the same commands.

**Done when:** all camera transitions follow the experience contract; no camera resumes unexpectedly after manual input/modal dismissal; all actions have discoverable keyboard-operable controls. Applicable AC-02 through AC-06, AC-10 through AC-14. _Functionally implemented: toolbar buttons and keyboard shortcuts already dispatch identical world commands. Remaining: a dedicated cross-input parity test and final QA under M6._

### M5 - Weather, light, and optional sound

- [x] Add Sunny/Cloudy/Rain/Mist/Snow/Windy with explicit presets and optional seeded natural changes.
- [x] Add Afternoon/Night/Local clock/Day-night cycle with clear fictional-weather labeling.
- [x] Implement pause-safe environment clocks and local-time lighting resynchronization.
- [x] Add a small original audio design, master volume/mute, explicit enable, and visible failure/retry state.
- [x] Tie effects to quality and reduced-motion settings without removing essential control.
- [x] Extend weather with source-backed terminal rain, slower advected snow, coherent wind/foliage, roof interception, retained water/SWE and melt, wet/snow materials, garden ripples, and cautious traffic. See the [17-source research and implementation report](WEATHER_PHYSICS_RESEARCH.md). Surface time compression, empirical coefficients, and omitted spatial hydrology/CFD are explicit.
- [x] Add bounded snow-shell depth on roofs, streets and canopies, matching shadow displacement and ground-contact height, three rain-fed ground depressions, and a physical rainfall-intensity contract. Local CPU/render-adapter coverage is complete; the expanded browser verification gate below remains open.
- [x] Replace the lower-left landmark card with one standalone Settings trigger and a compact non-modal dock above it; move landmark navigation into the bottom toolbar. Preserve Help modality, focus return, city input and pause access.
- [ ] Complete the final integrated Chromium run and visual review of accumulated depth/pools and the latest intensity UI. Current local browser launch failures occur before any page loads; do not count older screenshots as validation of the new geometry.

**Done when:** every weather/time combination remains legible, no environment effect catches up through hidden time, sound is silent until explicitly enabled each load, and audio suspends/disposes correctly. Applicable AC-06 through AC-11, AC-15, AC-17, AC-18. _Integrated and unit-verified; final cross-combination legibility sign-off rides with M6/M7 after the M8 artwork._

### M6 - Desktop and accessibility hardening

- [ ] Exercise 1024/1440/1920 px computer layouts and enlarged text.
- [ ] Check every control's visibility/hit target and prevent overlay input leaking to the world.
- [ ] Complete modal focus, shortcut scoping/help, meaningful status announcements, and screen-reader fallback.
- [ ] Test reduced-motion transitions, stepwise tours, static focus navigation, and sound-independent operation.
- [ ] Test supported desktop browsers and assistive technology on a physical computer.

**Done when:** the complete keyboard route and fallback are usable without adding a directory; no primary control is obscured; panels scroll without moving the scene. Applicable AC-02, AC-09 through AC-14, AC-19. _Not started. Automated 1024/1440/1920 overflow and shortcut-scoping checks exist from earlier slices, but the full hardening pass and physical assistive-tech testing remain._

### M7 - Optimization and hardening

- [ ] Profile real frames, assets, draw calls, heap/GPU proxies, and long-session behavior on the agreed devices.
- [ ] Tune geometry/material sharing, instancing/culling, bounded DPR, effect caps, and Automatic quality hysteresis.
- [ ] Verify resource cleanup, failed/late loads, context loss/restoration, repeated retry, and hidden-tab recovery.
- [ ] Establish deterministic visual fixtures across seed/time/weather/quality; check scene and UI regressions.
- [ ] Record the measured result and any approved budget revisions; leave no claim supported only by a screenshot.

**Done when:** the applicable full [acceptance matrix](ACCEPTANCE_CRITERIA.md) passes or explicit limitations are approved and documented. No hidden analytics, backend, commercial features, or unlicensed runtime assets. _Not started. Resource cleanup and context-loss handling are implemented and unit-covered, but real-frame/heap profiling and the long-session soak are outstanding._

### M8 - NYC-inspired world and interface

Replace the initial garden-village feel with an **original fictional NYC-like neighborhood**, not a literal map or a recreation of named buildings. Execute this visual pass before the final M6/M7 accessibility and performance sign-off so measurements cover the final artwork.

- [ ] Create a denser street-wall silhouette with original brick/brownstone and limestone mid-rises, varied cornices, fire escapes, rooftop water tanks, and restrained taller accents.
- [ ] Rework streets and public space toward asphalt, concrete sidewalks, curb details, railings, small tree pits, and pocket parks. Keep all vehicle/walker paths and crossings physically aligned.
- [ ] Give ordinary cars a restrained yellow-cab visual cue without copying taxi-company branding, logos, or commercial signage. Preserve buses, pedestrians, and the rare airplane; no drone or camera-follow actions.
- [ ] Replace the soft garden palette and decorative UI voice with an understated urban/transit-inspired desktop control system: clear typography, charcoal/stone surfaces, warm brick, and limited yellow accents. Keep the world dominant, not a marketing page.
- [ ] Update landmark names/descriptions/forms and camera compositions coherently; preserve stable semantic IDs where possible and explicitly migrate/revalidate changed references.
- [ ] Regenerate the original static illustration, revise asset provenance/versioning, and inspect overview, focused, night, rain, and mist views.
- [ ] Re-run scene budgets, desktop accessibility, deterministic visuals, and resource-lifetime checks after the art change.

**Done when:** the scene and chrome read as one NYC-inspired experience at supported desktop sizes, not just a color swap; no exact real-city layout, source artwork, branded billboard, directory, or commercial feature has been introduced; camera/actor/fallback behavior remains correct. _Not started. The live world still uses the garden-village identity; this pass replaces the art and palette before final M6/M7 sign-off._

## Estimate interpretation

These are rough planning proposals for an experienced developer with original procedural-art work, iteration, and testing included. They are neither verified author effort nor delivery guarantees. A **visual prototype might take 40-80 hours**, overlapping the early milestones; do not add that range to the 120-220 hour total.

The earlier 250-450 hour full-commerce concept is **not the scoped estimate** and should not drive staffing or the backlog. Removing payments, advertiser workflows, identities, moderation, and analytics changes the project substantially. Additional original art complexity, demanding low-end devices, or extensive audio work may increase effort; any expansion needs an explicit decision.

## Scope-change gate

Do not fill perceived gaps with a backend, directory, multiplayer, editor, real map data, live weather, or monetization. A future user request can change scope, but an archived reference screen or starter prompt cannot. Prefer completing the next ambient vertical slice to expanding the feature list.
