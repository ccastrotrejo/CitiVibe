# Ambient-only roadmap

**Status: entirely unimplemented. All tasks intentionally remain unchecked.** This is a bounded plan for when the user requests implementation, not authorization to start now. Read [AGENTS.md](../AGENTS.md) and the [product boundary](PRODUCT_BRIEF.md) first.

Dependencies favor working vertical slices. Accessibility, cleanup, failure handling, and basic profiling start in milestone 1; the later hardening milestones broaden coverage rather than postponing those responsibilities.

## Milestones

| ID | Milestone | Depends on | Rough effort |
| --- | --- | --- | --- |
| M1 | Small interactive original slice | Explicit implementation request; confirm reference devices | 16-28 h |
| M2 | Original coherent district | M1 | 24-42 h |
| M3 | Believable street and aerial activity | M2 route/anchor contracts | 22-40 h |
| M4 | Complete controls and contextual views | M1 camera contract; M2/M3 targets | 16-30 h |
| M5 | Weather, light, and optional sound | M1 clocks; M2 art; M3 activity | 14-26 h |
| M6 | Responsive and accessibility hardening | M4/M5 complete feature surfaces | 14-26 h |
| M7 | Performance and long-session reliability | M1-M6 | 14-28 h |
| Total | Polished ambient scope | No commercial systems | **120-220 h** |

### M1 - Small interactive original slice

- [ ] Confirm a modest original scene concept, camera projection, named laptop/mobile reference devices, and implementation stack/package manager.
- [ ] Build one small original block, one original landmark, and one closed route with an ordinary bus.
- [ ] Connect real pan/zoom/rotate/reset, landmark focus, bus follow/stop, pause/resume, and keyboard alternatives.
- [ ] Provide an original loading still and useful static fallback; implement error and teardown paths, hidden-tab suspension, muted-by-default behavior even before audio exists.
- [ ] Add camera/clock tests and a small browser interaction path.

**Done when:** the slice is genuinely interactive, not a fake poster/demo; navigation cancels follow predictably; pause and a hidden-tab return cause no actor jump; controls are operable at 375 px and desktop; mount/unmount leaves no active loop. Satisfy applicable AC-01 through AC-07 and AC-17 through AC-20 in [acceptance criteria](ACCEPTANCE_CRITERIA.md).

### M2 - Original district

- [ ] Author a new seeded generation pipeline or equivalent reproducible original-art workflow.
- [ ] Add a coherent small street graph, contrasting building families, plaza/landscape, and several original POIs.
- [ ] Export versioned geometry plus separate POI/route/tour anchors with stable IDs and validation.
- [ ] Replace the blockout with optimized original assets; regenerate the original fallback/poster.
- [ ] Review overview silhouette and multiple focus views; align stop lines, sidewalks, and routes with art.

**Done when:** regeneration retains semantic references, asset provenance is complete, no source artwork or names are copied, the district is navigable without clipping, and the initial geometry budget is measured. Applicable AC-03, AC-05, AC-15, AC-16, AC-19.

### M3 - Street and aerial activity

- [ ] Add cars, pedestrians, bus stop dwell, and explicit crossing/intersection conflict rules.
- [ ] Vary speeds and route phases deterministically; include a few waiting/sitting people.
- [ ] Add one ordinary drone route and follow target; keep population bounded.
- [ ] Add restrained micro-animation and occasional seeded events after core movement is stable.
- [ ] Treat cyclists, motorcycles, skating figures, balloons, and aircraft as optional density/art refinements, not parallel systems required before completion.

**Done when:** route loops are continuous, cars and crossing pedestrians obey the chosen conflict rules, bus stops are believable, target IDs survive quality changes, and the seeded scene runs ten minutes without runaway spawning or deadlock. Applicable AC-04, AC-05, AC-08, AC-15, AC-18.

### M4 - Controls and contextual tours

- [ ] Complete original-landmark focus cycling and concise contextual status without a directory/card catalog.
- [ ] Implement global/contextual tour segments and explicit follow/stop for bus and drone.
- [ ] Wire interruption, modal-close, pause, unavailable-target, and reduced-motion guided-view behavior through one camera state machine.
- [ ] Complete help, fullscreen or clearly labeled expanded-view fallback, and preference controls.
- [ ] Add cross-input parity tests so toolbar, shortcuts, and touch invoke the same commands.

**Done when:** all camera transitions follow the experience contract; no camera resumes unexpectedly after manual input/modal dismissal; all actions have discoverable keyboard-operable controls. Applicable AC-02 through AC-06, AC-10 through AC-14.

### M5 - Weather, light, and optional sound

- [ ] Add Sunny/Cloudy/Rain/Mist with explicit presets and optional seeded natural changes.
- [ ] Add Afternoon/Night/Local clock/Day-night cycle with clear fictional-weather labeling.
- [ ] Implement pause-safe environment clocks and local-time lighting resynchronization.
- [ ] Add a small original audio design, master volume/mute, explicit enable, and visible failure/retry state.
- [ ] Tie effects to quality and reduced-motion settings without removing essential control.

**Done when:** every weather/time combination remains legible, no environment effect catches up through hidden time, sound is silent until explicitly enabled each load, and audio suspends/disposes correctly. Applicable AC-06 through AC-11, AC-15, AC-17, AC-18.

### M6 - Responsive and accessibility hardening

- [ ] Exercise 320/375/390/414/768 px widths and desktop 1440 px; landscape, safe areas, and enlarged text.
- [ ] Check every control's visibility/hit target and prevent overlay input leaking to the world.
- [ ] Complete modal focus, shortcut scoping/help, meaningful status announcements, and screen-reader fallback.
- [ ] Test reduced-motion transitions, stepwise tours, static focus navigation, and sound-independent operation.
- [ ] Test physical iOS Safari and Android Chrome, not only emulated Chromium.

**Done when:** the complete keyboard route and fallback are usable without adding a directory; no primary control is obscured; mobile panels scroll without moving the scene. Applicable AC-02, AC-09 through AC-14, AC-19.

### M7 - Optimization and hardening

- [ ] Profile real frames, assets, draw calls, heap/GPU proxies, and long-session behavior on the agreed devices.
- [ ] Tune geometry/material sharing, instancing/culling, bounded DPR, effect caps, and Automatic quality hysteresis.
- [ ] Verify resource cleanup, failed/late loads, context loss/restoration, repeated retry, and hidden-tab recovery.
- [ ] Establish deterministic visual fixtures across seed/time/weather/quality; check scene and UI regressions.
- [ ] Record the measured result and any approved budget revisions; leave no claim supported only by a screenshot.

**Done when:** the applicable full [acceptance matrix](ACCEPTANCE_CRITERIA.md) passes or explicit limitations are approved and documented. No hidden analytics, backend, commercial features, or unlicensed runtime assets.

## Estimate interpretation

These are rough planning proposals for an experienced developer with original procedural-art work, iteration, and testing included. They are neither verified author effort nor delivery guarantees. A **visual prototype might take 40-80 hours**, overlapping the early milestones; do not add that range to the 120-220 hour total.

The earlier 250-450 hour full-commerce concept is **not the scoped estimate** and should not drive staffing or the backlog. Removing payments, advertiser workflows, identities, moderation, and analytics changes the project substantially. Additional original art complexity, demanding low-end devices, or extensive audio work may increase effort; any expansion needs an explicit decision.

## Scope-change gate

Do not fill perceived gaps with a backend, directory, multiplayer, editor, real map data, live weather, or monetization. A future user request can change scope, but an archived reference screen or starter prompt cannot. Prefer completing the next ambient vertical slice to expanding the feature list.
