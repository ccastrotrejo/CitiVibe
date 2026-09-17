# Acceptance criteria and verification plan

## NYC emergency vehicle refinement - 2026-09-16

Five original service designs replace generic bodywork: patrol SUV, box ambulance, compact ambulance, pumper engine and fire-command SUV. Two sedan slots become patrol SUVs while retaining their IDs; the eight existing ambulance/fire IDs, 48 motor vehicles and all other actors remain. Source provenance and miniature-scale limitations are recorded in the [emergency-vehicle study](NYC_EMERGENCY_VEHICLES_RESEARCH.md).

New regression checks cover distinct bodywork/equipment, visible rather than buried windshields, non-emissive glazing, weather-aware paint, rear patient doors, grounded wheel pivots, eleven retained lamp sockets, full model/lamp safety envelopes, per-instance colors and repeatable reconstruction. The original regressions failed before the replacement bodywork was implemented. Existing traffic-soak, signal/crossing, actor, weather, resource-disposal and lifecycle checks remain in place; no budget or safety assertions are relaxed.

Strict TypeScript, whole-project ESLint and the production build pass. The final full Vitest run reports **577 passed and 14 skipped across 37 files**; skipped cases remain skipped, not claimed as executed. The build retains its existing large-chunk warning. The scoped design detector reports no findings.

CPU traversal at this checkpoint measures **638,803 base-scene triangles, 109 visible mesh submissions and 37 materials**, versus 632,843 / 109 / 37 before the refinement. The existing executable limits remain **less than 640,000 triangles, at most 110 submissions and at most 37 materials**. Older limits and counts elsewhere in this document are historical; these measurements exclude additional weather passes and are not desktop FPS evidence.

Served Chromium/SwiftShader checks pass for live navigation/tour interruption/pause, reduced-motion guided views/accessibility, nighttime rain labels, actual WebGL context recovery, and snow/wind settings with paused recovery. These five scenarios supersede the earlier browser-startup limitation for this follow-up, not for every historical scenario. A session-only front/rear model study uses actual source rigs, instance colors and the production lamp renderer; no debug route or screenshot asset is shipped.

Physical-device frame times, long-session profiling and fleet-accurate dimensions remain unverified. Warning lights are deliberately steady and there are no sirens, dispatch, pursuit, priority overrides or added emergency animations. Publication is authorized by the user's subsequent request; deployment is not. and verification plan

**Status: the street-life expansion and subsequent sidewalk, bike-row and food-cart corrections pass integrated source checks, extended by a 2026-09-14 population and ambient refinement. Served-browser and physical-device gates remain open.** The current scene retains thirty-six intersections, twenty-four blocks, 94 buildings and a 78 x 176 m park within a 220 x 340 m map. It has 328 people including eight resting neighbors, 48 moving motor vehicles, twelve parked cars, four sidewalk food carts, three ten-bike stations and two sports balls. The occasional airplane and an occasional high-altitude balloon bunch are ambient sky decor. Full-size courts, subway entrances, scaffolding, street names, weather, lighting and existing controls remain. Previous feature and merge records below are historical. Automated coverage does not substitute for physical-device FPS, long-session, cross-combination or assistive-technology verification. Production readiness is not claimed; landmark selection, camera-follow and the drone remain excluded.

Use this matrix when implementing each [roadmap](ROADMAP.md) milestone. Numerical budgets are working targets; name the reference devices and record actual results before declaring them met. The [experience spec](EXPERIENCE_SPEC.md) is authoritative for pause/camera behavior.

## Weather and shared-bike integration - 2026-09-16

Latest main `fa19f02` is combined with weather checkpoint `a85206b`. The three textual conflicts preserve both feature histories and both runtime recovery tests. Shared-bike crossing reservations still constrain weather-adjusted pedestrian pace; additional rain-hurry and snow-pace scenarios retain full body clearance and completed Juniper round trips. Classic/electric bikes, tapered docks, yellow signal frames, weather clothing and visible park departures/returns remain.

The first combined scene measured **646,475 triangles**, exceeding the unchanged 640,000 ceiling. Omitting unreachable umbrella meshes for runners and raincoat-only profiles removes **13,632 triangles** without changing visible outfits, six-panel canopies or population. Final CPU source-scene accounting is **632,843 triangles, 109 visible mesh submissions and 37 materials**, with 362 retained actor rigs. No budget or safety assertion was relaxed.

**Executed merge checks:** strict TypeScript and whole-project ESLint pass. The broad 13-file merge run passed 287 tests with 14 existing skips; its sole failure was the scene-budget overrun above. After that correction, all 117 tests across the seven final person/instance/scene/locomotion/model/runtime files pass, including budget, disposal and exact recovery. The complete repository suite was not rerun for this merge.

The final production build passes with the existing large-chunk warning: renderer 508.15 kB / 141.21 kB gzip; entry 550.97 kB / 166.23 kB gzip. Removing the now-unreachable runner-only umbrella grip branches also passes all eleven weather-art tests. Both selected production Chromium scenarios pass: real WebGL restoration preserving the paused manual camera, and persistent snow/wind settings through recovery. Physical-device FPS, all-angle visual approval and complete browser-suite sign-off remain open; no new pixel-inspection claim is made. Earlier records below describe their individual pre-merge checkpoints.

## Weather-aware people - 2026-09-16

Street/park walkers, runners and the eight existing picnic neighbors now respond to precipitation, temperature, wind and retained snow. Individual rainwear choices and reaction times remain seeded; weather-dependent desired pace remains subordinate to existing crossing and clearance rules. Picnic neighbors stand, leave through the east gate, walk outside, and return through the south gate after sustained suitable conditions. The same 328 people remain; the eight formerly static neighbors bring the retained simulation to 362 rigs. Court, meadow and cycling choreography is unchanged. The [research study](PEOPLE_WEATHER_RESEARCH.md) separates eleven inspected references from authored thresholds and seven retrieval gaps.

**Executed source checks:** strict TypeScript, whole-project ESLint and the production build pass. The final single-worker suite passed **550 tests with 14 existing skips across 36 files** in 259.59 seconds, including the final shared-helper cautious-runner correction and additional posture cases. Coverage exercises the exact previously airborne runner regression, restoration equivalence, interrupted sitting, reduced-motion posture, full-population departure/return cycles with seeds 2401 and 42, actual route/scenery clearance, zero-intensity rain, cold after sunshine, wind hysteresis, paused state and exact restored instance matrices.

| Base source-scene accounting | Measured | Unchanged ceiling |
| --- | ---: | ---: |
| Triangles, including allocated optional clothing | 633,143 | <640,000 |
| Visible mesh submissions | 109 | 110 |
| Visible materials | 37 | 37 |

These are CPU source-scene counts, not GPU draw calls, frame rates or extra weather/shadow-pass costs. Clothing retains the two shared person batches and existing scene ownership. The final production build retains the existing large-chunk warning: renderer 506.85 kB / 140.73 kB gzip; entry 549.38 kB / 165.62 kB gzip.

**Served-browser evidence:** two selected, unmodified production Chromium scenarios pass: real WebGL restoration preserving the paused manual camera, and persistent snow/wind settings through graphics recovery. A separate development capture exercised Sunny, Rain and Snow without page or console errors. Only the Sunny image was inspected; the image-view limit prevented Rain/Snow pixel inspection. Those browser checks preceded the final cautious-gait correction. All-angle weather-clothing appearance, physical-device FPS, long-session behavior and the complete browser suite remain open gates. The user subsequently authorized commit, push and a pull request; deployment is not authorized.

## Dock and signal appearance follow-up - 2026-09-16

The approved original dock design has silver tapered cheeks, capped heads, dark inset faces and open wheel channels; all three station layouts, bikes, contacts and rider motion remain intact. Existing vehicle/pedestrian signals now have yellow frames around dark recessed faces. There are no new bicycle-specific signals or changes to signal meanings, timing or controllers. The [reference record](NYC_CITY_RESEARCH.md#dock-and-signal-reference-refinement---2026-09-16) explains the visible signal illustration and the user's approval of an original station design after its image could not be inspected.

**Executed checks:** all **143 affected tests across six files** pass: content/bike-share, station art, streetscape, scene, runtime restoration and locomotion. New coverage checks inward taper, recessed faces, actual front-wheel clearance, active-slot indicators under snow, dark empty docks and signal rims in every orientation. Existing all-station departures, inventory, ownership/disposal, station geometry below 25,000 triangles and unchanged whole-scene ceilings pass. TypeScript, ESLint and production build pass. The 538-test complete-suite result below predates this appearance-only follow-up; it was not rerun for these static-art changes.

All three selected final-production Chrome scenarios pass: reduced-motion controls/accessibility, real WebGL restoration, and reproducible paused rendering without external resources. A separate live development probe captured dock and signal views with no page/console errors and confirmed Juniper was riding at 45 seconds. Its temporary module interception was updated to accept Vite's cache-query suffix; no diagnostic instrumentation entered application code. Screenshots were captured but their pixels remain uninspected because of the image-viewing limit. Broader browser/device and aesthetic gates remain open. Existing large-chunk warnings persist; no budget was raised. Work remains local and unpublished.

## Park-side bike motion and electric fleet - 2026-09-16

Juniper's station rider no longer waits indefinitely for simultaneous road/sidewalk/cycling gaps. A retained access reservation lets existing occupants and traffic unable to brake clear before admitting the walking rider, then holds approaching bodies outside until the rider clears. A floating-point interior tolerance prevents stopped bodies from leaking across the reservation boundary. Hands follow the actual bicycle transform and the confirmation marker follows its active slot. Original blue classic and silver electric models share existing geometry/material owners, pedal contacts and lamp slots; stable IDs preserve bike type between docked and riding representations. Existing actors, routes, inventories, scene-budget limits and controls are unchanged.

**Executed final checks:** `npm run typecheck`, `npm run lint` and `npm run build` pass. `npm test -- --maxWorkers=1` passed **538 tests with 14 existing skips across 33 files** in 292.81 seconds. Coverage includes real departures from all three stations, ten 1200-second Juniper round-trip/body-clearance scenarios across eight seeds and dry/snow traction, repeated departure after docking dwell, bicycle-local hand contact around bends and under snow support, mixed station inventory, electric pedal contact, shared resource ownership, unchanged scene budgets and paused graphics restoration during an active crossing. The extended wet-road window is intentional: one rider was still moving about 12 m from its dock at 900 seconds, not stuck. No safety or progress requirement was replaced with a stationary fallback.

**Served-browser checks:** all three selected production Playwright scenarios pass against the final build: live navigation/tour/help/pause, reduced-motion guided views/DPR/accessibility, and real WebGL restoration with retained paused camera. The command used `PLAYWRIGHT_PORT=4197 npm run test:e2e -- --config=<session-artifacts>/bike-playwright.config.ts --grep 'live navigation|reduced-motion city-wide|real WebGL context'`. A session-only configuration selected installed Chrome 153 because the bundled Chromium download timed out; repository browser configuration is unchanged. An earlier development probe also recorded Juniper progressing from docking to pushing out at 20 seconds and riding at 45 seconds without page/console errors.

**Limits:** the session image-viewing limit prevented inspecting the captured pixels and operator reference photographs. Official classic/electric operation was researched, but precise colors, battery placement and proportions remain authored interpretations, not photo-verified replicas; see the [evidence record](NYC_CITY_RESEARCH.md#classic-and-electric-shared-bikes---2026-09-16). No all-angle aesthetic approval, complete browser-suite result or physical-device FPS sign-off is claimed. The existing large-chunk warning remains (renderer 504.02 kB / 139.73 kB gzip; entry 542.75 kB / 163.47 kB gzip). Changes remain local; no commit, push, PR or deployment was performed.

## NYC building fabric - 2026-09-15

The current local slice keeps all 94 building IDs, closes 57 incidental gaps to 0.06 m party-wall joints across 75 buildings, and creates 19 offices, 32 mixed-use storefront buildings and 43 residential buildings. Avenue fronts align; doors, stoops and fire escapes face public frontages instead of the closed gaps. Existing planted openings, trees, subway access/sightlines, bike bays, courts, sidewalks, people, traffic, controls and simulation state are retained. The NYC visual direction is now explicit in the root instructions, product brief, README and roadmap.

**Executed checks:** strict TypeScript, whole-project ESLint and production build pass. The final complete single-worker suite passed **522 tests with 14 existing skips across 33 files** in 196.49 seconds. New coverage checks actual joined spacing and paired lot lines, retained civic openings, aligned avenue fronts, rendered office/storefront geometry, separate upper-floor entrances, blank attached walls, detail/neighbor nonintersection, oriented brownstone doors/stoops, precipitation capture over expanded roofs and unchanged budgets. Existing all-sidewalk, shed, subway, court, tree, station, deterministic construction and disposal checks remain.

| Final base source-scene accounting | Measured | Existing code ceiling |
| --- | ---: | ---: |
| Triangles | 574,731 | <640,000 |
| Visible mesh submissions | 109 | 110 |
| Visible materials | 37 | 37 |

These are CPU source-scene counts, not GPU draw calls, frame rates or weather/shadow-pass costs. No ceiling was changed in this slice. The current repository already uses the 640,000 triangle allowance, superseding historical 600,000-triangle records below. Production retains its existing large-chunk warning: renderer 503.19 kB / 139.46 kB gzip; entry 541.17 kB / 162.93 kB gzip.

**Fresh served-browser evidence:** all four selected, unmodified production Playwright scenarios pass: live navigation/tour/help/pause, reduced-motion guided views and accessibility scan, real WebGL context restoration, and reproducible paused rendering with no external requests. This does not claim the entire browser suite is green. A separate development capture run produced 1440x900 overview, 1920x1080 street detail and 1024x768 night/rain images without page or console errors. The session's image-viewing limit prevented inspecting the resulting pixels, so aesthetic/all-angle approval remains unverified. Real-device FPS, broader weather combinations and long-session sign-off remain open. Changes remain local; no commit, push, PR or deployment was performed.

## Lakeside refinement - 2026-09-14

This local art-only slice replaces the stepped bridge slabs and fountain overlap with a continuous shallow arch ending at the terrace, complete curved railings and stone landings. It adds a hollow fountain, two slatted timber pergolas and richer pond/shore planting without changing paths, trees, population, traffic, controls or the simulation clock. The original lawn colors are retained on a shared material to stay within the existing resource limits.

**Executed source checks:** TypeScript, whole-project ESLint, the production build and the single-worker unit suite pass: **497 passed, 14 existing skips across 32 files** in 172.30 seconds. Five new park cases check the actual raycast deck profile and railing clearance, separated fountain/bridge bounds, all-path clearance for new direct meshes, hollow basin/rim heights, complete pergola supports/slats, water normals/color bands, retained lawn colors and weather/snow participation. The existing scene cases retain low-prop clearance, resource ownership, deterministic construction and budgets. No limits or assertions were relaxed in repository files.

| Base source-scene accounting | Measured | Existing ceiling |
| --- | ---: | ---: |
| Triangles | 586,659 | <600,000 |
| Visible mesh submissions | 109 | 110 |
| Materials | 37 | 37 |
| Visible geometries | 48 | No separate ceiling |

These CPU counts exclude extra weather/shadow passes and are not FPS measurements. The existing emergency-vehicle baseline already allows 37 materials; this slice does not raise it. The renderer bundle is 498.25 kB / 137.55 kB gzip; the entry is 538.09 kB / 162.33 kB gzip, retaining the existing chunk-size warning.

**Browser evidence and limits:** the unmodified production live-navigation/tour/help/pause scenario passes. The standard reduced-motion scenario exceeds its existing five-second readiness assertion; an isolated, untouched `a474f1b` archive reproduces the same failure. A session-only diagnostic with an explicitly longer 20-second assertion wait passes the guided-view/DPR/accessibility, real WebGL recovery, and deterministic paused-render/no-external-resource scenarios. The night/rain scenario reaches its weather controls but fails on the stale `.environment-badge` selector, which is already absent from baseline application code. The repository browser tests/configuration remain unchanged; these diagnostic results do not constitute a green standard browser suite.

Served development captures were generated at 1440x900 (day), 1920x1080 (rotated view), and 1024x768 (night/rain), with no captured page or console errors. The session's image-viewing limit prevented inspection of those captures, so final aesthetic/all-angle approval is **not claimed**. Physical-device performance and broader weather/long-session sign-off remain open. This verification record precedes publication; the user subsequently approved a commit, push and pull request. Deployment remains excluded.

## Cross-input command parity - 2026-09-13

This slice closes the outstanding M4 parity item. `src/app/commands.ts` is now the single source for every world command a person can invoke directly: the eleven camera actions plus pause and automatic views, each with its label, icon, shortcut keys, live-graphics requirement and held-key repeat rule. `Controls.tsx` renders its buttons from that table and `App.tsx` resolves shortcuts through it, so a button and its shortcut cannot drift apart. Behavior is unchanged: the same keys, command values, disabled states and repeat handling as before, including reset staying available on the static fallback.

`src/app/inputParity.test.tsx` verifies parity rather than restating the table. It checks that every action has a unique key set, an on-screen control and an entry in keyboard help; that each camera button and each of its shortcuts dispatch one identical command; that pause and tour produce the same toggle command from either surface in the same state; that live-only actions are both disabled and inert on the static fallback while reset still works from both inputs; that held camera keys repeat while pause and tour do not; and that pointer, wheel, pinch and two-finger gestures move the camera along the same axes and directions as the matching buttons.

**Executed checks:** strict TypeScript, whole-project ESLint and the `src/app` plus scene-input suites pass (**54 tests across 3 files**). The parity suite was mutation-checked: a wrong keyboard command, a toolbar button bypassing the shared table and an inverted shift-wheel rotation each made it fail, and all three were reverted. A full-suite run recorded 530 passing tests with 8 failures in `traffic`, `bikeShare`, `lightingVisual`, `model`, `createWorld` and `vehicleLighting`; a baseline run with this slice's changes removed failed the same long-running world-simulation scenarios, so they are pre-existing on `2a81866` and outside this slice. Their count varies between runs, which suggests timing sensitivity in those soaks rather than a parity regression. No browser or physical-device verification was performed here, so AC-02's served hit-testing gate stays open.

## Population and ambient refinement - 2026-09-14

This slice raises the bounded population and completes the optional M3 sky refinement. Street walkers grow to 200, park walkers to 55, and the shared-bike program to fifteen road cyclists plus nine roaming riders on the protected cycle tracks; runners hold at 24 and vehicles at 48. With three station users, six court players, eight meadow figures and eight resting neighbors the total is **328 people** (**354 traveling rigs**). The per-block pedestrian cap is raised from eight to eleven so cross-street flow survives the denser sidewalks; an empirical 120-second probe showed zero crossings at the old cap and healthy counterflow at eleven. The docked shared-bike neighbor gains a subtle deterministic torso-only weight-shift (feet planted, disabled under reduced motion, whole-cycle periodic so the 48-second loop still closes exactly) so it never reads as frozen. An ambient occasional balloon bunch (`src/world/balloons.ts`) mirrors the airplane's bounded, seeded, disposable, reduced-motion-aware pattern.

**Executed checks:** strict TypeScript, whole-project ESLint and the production build pass. Targeted Vitest suites pass: `bikeShare` (15 including a new docked-idle regression), `balloons` (20 new), and `model`/`createWorld` wiring (45). The full sim suite was not re-run this session; the long-running world-simulation soaks remain timing-sensitive under parallel contention as recorded below. No browser or physical-device verification was performed here, so the served hit-testing and device-performance gates stay open.

## Street-life expansion and corrections - 2026-09-13

The local slice increases the population to 200 street walkers, 55 park walkers, 24 runners and 48 moving motor vehicles, with fifteen road cyclists, nine roaming shared-bike riders and all six buses. Court/meadow/picnic people and three bike-station users bring the total to **328 people**; the traveling simulation contains **354 actors**. The separately planned 464-person target is not implemented.

All three bike stations have ten persistent bicycles docked side by side in parallel rows, with eleven docks per row. Two occupy clear inter-building pockets and the third sits beside Juniper Court. A 0.8 m checkout/check/redock animation preserves each person and bike; the road cyclists remain a separate riding system. The corrected food vendors are four cabless sidewalk carts with counters, open-front food displays, small wheels and striped canopies, not vans in parking bays. Twelve parked cars/bays, four pole-mounted parking signs, six mailboxes and eighteen additional benches remain. Image provenance and approximation boundaries are recorded in [the research study](NYC_CITY_RESEARCH.md#street-life-reference-study---2026-09-13).

Two-way walking uses 6.2/7.2 m lane centers, a retained direction per person, 144 directed crossing links and the unchanged full body envelope, destination cap and landing protection. Local building/stoop reductions, widened paving/zebras, shed supports, retained-ID lamp relocations, eight 0.30 m metro shifts, wind-safe crown headroom and a 0.40 m west court-fence shift provide clearance without removing scenery or shrinking courts. Architecture still contains all 94 buildings; one small annex moves 0.55 m.

**Executed checks:** strict TypeScript, whole-project ESLint and the production build pass. The complete single-worker Vitest run passed **517 tests across 29 files in 354.63 seconds**. Subsequent checks passed all seven person-model tests with expanded fixture coverage, and **62 scene/streetscape tests** including a late-added fence regression that reproduces the old overlap before verifying the correction. The complete suite was not rerun after that test-only addition. Person coverage includes 24 runner fixtures and 168 profile fixtures per walking/running context. Body envelopes, traffic headway and scene-budget limits are unchanged. Coverage includes deterministic initialization, traffic/weather and pedestrian soaks, actual counterflow/pole/shed/metro/canopy clearance, station inventory and parallel layout, cart approaches, pedal contact, pause/recovery and disposal.

| Final base source-scene accounting | Measured | Unchanged ceiling |
| --- | ---: | ---: |
| Triangles | 598,374 | <600,000 |
| Visible mesh submissions | 94 | 110 |
| Visible materials | 32 | 36 |
| Visible geometries | 40 | No separate geometry-count ceiling |

These are CPU `traverseVisible` counts, not measured GPU draws or FPS. Weather/snow/effect and shadow passes are separate. The renderer chunk is **477.68 kB / 130.23 kB gzip**; the entry chunk is **530.19 kB / 158.93 kB gzip**, retaining Vite's existing large-chunk warning.

**Browser limitation:** the final production Playwright attempt selected live navigation and deterministic paused-scene checks. Chromium crashed at startup with `SIGSEGV` before any application assertion; the second scenario did not run. Earlier in this slice, a bounded WebKit alternative also timed out. The HTTP-responsive preview and user-supplied screenshots are limited interactive evidence, not a fresh final visual or physical-device sign-off. No stable browser, accessibility-scan, all-angle visual, FPS or long-session pass is claimed. Changes remain local; no commit, push, PR or deployment was performed.

## Walking-trip and street-sign integration - 2026-09-13

Main `603495a` (connected walking trips) is merged into the street-sign/controls branch at `234a08d`. Application code merged without conflicts. Three documentation conflicts were resolved by preserving both the movement requirements and explicit landmark-selection removal, with upstream and earlier verification records labeled separately. Signs, lighting, manual camera controls and city-wide/guided tours remain intact; population doubling remains planned only.

Strict TypeScript, ESLint and the production build pass. Focused verification passes **118 tests**: 114 across eight pedestrian, locomotion, runtime/recovery, person, model, vehicle-lighting, sign and UI files (41.25 seconds), plus four seed-2401 twenty-minute traffic scenarios covering dry, wet, minimum and changing grip (37.18 seconds). These retain footprint separation, stop-line safety and progress requirements. The remaining traffic cases and complete suite were not rerun; this is targeted merge verification, not a new full-suite claim.

Browser checks were not repeated after the previously established Chromium startup crash and WebKit navigation timeout. No new browser, visual or physical-device result is claimed. Vite retains its existing large-chunk warning (entry 530.44 kB / 158.91 kB gzip; renderer 461.89 kB / 124.26 kB gzip).

## Lighting and street-sign integration - 2026-09-13

**Pre-walking-merge record (`234a08d`).**

Main `06ecb95` (city, vehicle and court lighting) is merged into the street-sign/controls branch at `bef6fb2`. Five conflicts were resolved by retaining lighting imports and vehicle-light rigs while keeping landmark selection, raycasting and highlights removed. Street signs retain their scene ownership; lighting retains pause, quality and graphics-recovery integration. Both branches' earlier verification histories remain below.

Strict TypeScript, ESLint, the production build and **all 463 tests across 25 files pass**. The complete single-worker suite took 298.47 seconds, without retries or relaxed limits. This covers signs, lighting, population, traffic, manual camera and city-wide/guided tours, removed selection, weather, resource budgets/disposal and restoration. Seven affected documents passed 87 relative-link-target checks and JSON-example parsing; no conflict markers or unmerged entries remain.

The applicable nighttime-rain/recovery Playwright attempt still fails at Chromium startup with `SIGSEGV`, before application assertions; the second scenario did not run. No new browser, isolated-render or physical-device pass is claimed for this merge. The existing large-chunk warning remains (entry 525.56 kB / 157.13 kB gzip; renderer 461.65 kB / 124.19 kB gzip).

## Landmark-selection removal - 2026-09-13

**Pre-lighting-merge record (`bef6fb2`).**

The user removed the whole feature, not just its toolbar: no landmark registry, selection commands/state, bracket shortcuts, scene raycaster, semantic hit volumes, highlight ring, static markers, descriptions or landmark-specific tours remain. Manual camera controls, the original six-view city-wide tour order and reduced-motion guided views are retained. Reservoir ripples now use the shared physical reservoir coordinates. Original scenery, signs, traffic and SVG illustrations remain unchanged.

Typecheck, ESLint and the production build pass. The complete single-worker run passed **445 of 446 tests across 23 files** in 252.92 seconds. Its sole failure was an airplane fixture that selected camera anchors by array position; it now selects the same four original views by stable ID, without changing flight behavior or visibility requirements. The subsequent airplane/UI run passed **all 48 tests**. The full suite was not rerun after this test-only correction. Scene budget, disposal, weather, population, tour, pause and restoration checks passed in that complete run. Eight changed documents passed 94 relative-link-target checks and JSON-example parsing; the original illustrations have no diff.

The fresh production Playwright attempt still fails at Chromium startup with `SIGSEGV`, before any app assertions; fourteen further scenarios did not run after the first failure. A bounded WebKit fallback also timed out navigating to the HTTP-responsive local app. No new served-browser, visual, accessibility-scan or physical-device pass is claimed. The preview server responds on port 4191. Vite retains its existing large-chunk warning (entry 521.89 kB / 155.93 kB gzip; renderer 451.12 kB / 120.90 kB gzip).

## Street-name design checkpoint - 2026-09-13

The subsequent main sync combines this feature with population commit `121817c`. Both the sign-resource ownership and the new person/meadow activity wiring are retained. Typecheck, lint and production build passed. The full single-worker run passed 447 of 448 tests across 23 files; the seed-42 dry-traffic soak exceeded its 30-second timeout under load. That exact test passed unchanged on an isolated retry (9.14 seconds for the run). The build retains its existing large-chunk warning. The scene budget checks pass against main's 600,000-triangle / 110-submission / 36-material limits. No new served-browser or physical-device result is claimed by this merge.

**Pre-merge record (`e7a49dc`).** The original street-sign follow-up started from main `b81eb32`. Twelve selected intersections carry twenty-four double-sided green blades; all six avenues and six cross streets have original names. No obsolete loop geometry, misleading one-way plates, new poles, traffic changes or extra UI controls were restored from the earlier draft.

- Strict TypeScript, ESLint, the production build and the **complete 423-test suite across 20 files** pass. The full suite ran with `--maxWorkers=1` in 127.52 seconds.
- Six new sign tests cover all-road name coverage, unique junction IDs, existing-pole positions, sidewalk/metro/park clearance, facade separation, road-overhang height, paired front/rear orientation, finite letter bounds, explicit missing-glyph errors and bounded static resources. Existing scene tests cover independent/idempotent disposal, deterministic geometry, and the unchanged whole-scene budgets; runtime tests retain pause and recovery behavior.
- CPU traversal counts **549,184 base-scene triangles, 98 visible mesh submissions, 34 visible materials and 39 geometries**. The signs add 5,672 triangles, four submissions and one shared material. No existing 550,000 / 110 / 36 ceiling was raised. This is not GPU/FPS accounting; snow/effect/shadow passes are separate.
- An isolated in-memory WebKit bundle rendered and was visually inspected in seven views: magnified front/reverse details, a supported maximum-zoom corner composition, Night, Rain, Mist/Lightweight and overview. There were no reported page or shader errors. The actual city/renderer/environment modules supplied the artwork; the diagnostic camera and captures remain session artifacts rather than production hooks.
- The targeted production Playwright scenario was retried against this revision, but Chromium crashed with `SIGSEGV` before page creation. Earlier full-Chromium probing also timed out at startup. The isolated WebKit captures do **not** establish served navigation, asset loading, storage behavior, UI interaction parity, all viewing angles or physical-device performance. Existing broader browser/device gates remain open.
- Vite's existing large-chunk warning remains: entry **522.85 KB / 155.66 KB gzip**, renderer **446.66 KB / 119.05 KB gzip**. No warning was suppressed and no general performance-optimization milestone is claimed.

## Connected pedestrian movement and main integration - 2026-09-13

**Upstream movement checkpoint (`603495a`), before this branch's merge.**

Latest `origin/main` (`06ecb95`, night/vehicle/court lighting) was fast-forwarded into this branch while the uncommitted movement work was preserved in a named stash. Three restored-file conflicts were resolved explicitly: retain indicator initialization alongside the new pedestrians, retain both lighting and crossing lifecycle tests, and replace obsolete road-only movement fingerprints with the new safety/progress checks. The incoming locomotion restoration now also uses uninterrupted pedestrian travel distance and retained activity poses. No lighting implementation, population, court geometry or existing controls were removed.

Strict TypeScript, ESLint and the production build pass. The complete single-worker run exercised **467 tests in 25 files: 466 passed, with one existing ten-mount/unmount test exceeding its unchanged five-second timeout** (5.251 seconds). A subsequent isolated run of all seventeen runtime/lifecycle cases passed in 19.61 seconds, without changing the timeout or assertions. These are a full run plus a successful targeted retry, not a claim of a single all-green 467-test run.

Coverage includes 72 connected crosswalks, continuous departure/landing positions and headings, seeded destination/activity variation, entry only on WALK, retained all-red clearance, destination/landing protection, body envelopes, uninterrupted gait, bounded rests, and pause/hidden/recovery behavior. Three twenty-minute pedestrian scenarios exercise all eight internal streets and multiple activity durations. Fourteen existing twenty-minute traffic/weather scenarios retain full-footprint separation, stopping bars, park exclusion, acceleration/braking limits and complete road circuits. Denied-crossing regression coverage prevents the floating-point corner stall discovered during development.

**Intentional timing change:** occupied crosswalks now extend real all-red time, so old road-only hashes and sub-second pedestrian-wait assumptions no longer apply. Walkers retain a 100-second overall queue bound and at least 0.3 m/s average progress across the twenty-minute scenarios, including rests. Dry road actors retain the 100-second bound; wet/snow road actors use a documented 180-second bound because slow vehicle clearance and pedestrian turns can span several cycles (the low-grip seed-2401 check observed approximately 156.77 seconds). Crossing admission itself times out after twelve seconds and reroutes safely. No collision or stop-line assertion was relaxed.

The merged production renderer chunk is 454.93 kB minified / 122.20 kB gzip; the entry chunk is 535.70 kB / 160.62 kB gzip. Vite's existing >500 kB warning remains. The movement slice adds no rendered geometry, materials, light slots or population; it does not claim new physical-device frame-rate or memory measurements.

**Browser evidence and limits:** the final merged Chromium smoke again fails during browser startup with `SIGSEGV`, before application assertions. An alternative WebKit served-navigation probe timed out. The shared browser did display the served app and responded to Pause/Resume; after hot reload it briefly failed to recreate WebGL, and Retry restored it. This is limited interactive evidence, not stable cross-browser acceptance. A separate pre-lighting-merge in-memory WebKit fixture rendered a pedestrian on an existing zebra crossing at 11.50 simulation seconds without reported page errors. That isolated fixture does not verify final merged lighting, loading, storage or long-session behavior. Physical-device performance, assistive technology and the full lighting/weather matrix remain open.

Five verified movement sources and their explicit approximation boundaries are recorded in [people and activity](PEOPLE_AND_ACTIVITY.md#movement-research-and-design-decisions). The requested doubling to 464 total people is a separate roadmap item, not an implemented or measured density increase. Commit/push and a new PR against main are user-authorized; deployment remains excluded.

## Juniper Court lighting follow-up - 2026-09-13

**Historical lighting-branch checkpoint, before integration into this branch.**

Six new twin-head poles illuminate the basketball/pickleball parcel shown in the user's follow-up image. All bases remain outside both full runoff areas and the shared passage, with no street, building, player or court-layout changes. Physical heads, smooth ground footprints and focused-view spotlights use the same inward targets. Dusk activation, Lightweight cues, weather/snow support and deterministic pause/recovery use the existing lighting lifecycle.

**Pre-merge lighting checkpoint:** all **434 Vitest cases in 21 files passed** with `--maxWorkers=1` in 131.74 seconds; typecheck, lint and production build passed. Added tests cover all six placements, invalid parcel/runoff/passage positions, inward footprint matrices, focused court lighting and daytime switch-off. An earlier full run had one 30-second traffic-soak timeout while 433 cases passed; the unchanged-timeout rerun passed completely. No simulation behavior or timeout was relaxed.

| Historical court-lighting CPU accounting | Triangles | Visible mesh submissions | Visible materials | Geometries |
| --- | --- | --- | --- | --- |
| Base scene | 541,958 | 93 | 32 | 34 |
| Night with lighting/weather adapters | 571,534 | 103 | 37 | 39 |
| Retained snow with lighting/weather adapters | 889,812 | 151 | 39 | 39 |

The same `traverseVisible` accounting and caveats below apply. The unchanged base ceilings still pass. Capacities are now 507 halos and 183 footprints for 87 public fixtures plus vehicle lighting; the fixed eight real-light slots and texture allocations are unchanged. The renderer chunk is 448.65 kB minified / 119.68 kB gzip; the entry remains 526.54 kB / 156.87 kB gzip with its existing warning.

**Visual evidence and limits:** focused in-memory WebKit captures cover both courts at night, in Lightweight, in rain and in the afternoon, without reported page/shader errors. They show all six poles, soft illumination and unobstructed play/access areas. The shared browser preview intermittently reports unavailable WebGL (`context.getContextAttributes()` on null); Retry briefly restored its live status, but did not establish stable operation. The applicable nighttime-rain E2E attempt again stopped at Chromium startup with `SIGSEGV`, before application assertions. Isolated rendering is not a served-browser or physical-device sign-off. Changes remain local and uncommitted.

## Night-lighting follow-up - 2026-09-13

Latest main was fetched before edits; the worktree was current at `b81eb32`. The [sixteen-source lighting study](LIGHTING_RESEARCH.md) supports the bounded follow-up rather than reopening city layout, sports or UI scope.

**Initial lighting checkpoint, before the court addition:** all **431 Vitest cases in 21 files passed** with `--maxWorkers=1` in 131.60 seconds. Strict TypeScript, ESLint and the production build passed. Lighting coverage includes all 36 motor vehicles and twelve bicycles, head/tail/brake separation, both turn directions, approach/queue/junction/exit state, independent signal phases, reduced-motion steady cues, weather activation, orientation, snow/height masks, bounded light allocations and idempotent disposal. Runtime coverage verifies unchanged lamp colors and positions through pause, hidden time and graphics reconstruction. The existing twenty-minute traffic fingerprints remain unchanged after excluding only new lighting metadata.

The first renderer inspection caught duplicated vehicle-light rig registration and overly bright overlapping footprints; both were corrected before the final run. The new recovery regression also exposed neutral suspension poses after rebuilding graphics. Retaining and reapplying locomotion memory fixes the attached lamp transforms without advancing time or resetting the scene.

| Initial lighting CPU accounting | Triangles | Visible mesh submissions | Visible materials | Geometries |
| --- | --- | --- | --- | --- |
| Base scene | 541,118 | 93 | 32 | 34 |
| Night with lighting/weather adapters | 569,914 | 103 | 37 | 39 |
| Retained snow with lighting/weather adapters | 887,952 | 151 | 39 | 39 |

These counts use `traverseVisible`, matching the existing base geometry test; they include semantic/color-write-disabled meshes and empty instance batches, not just actual GPU draws. The base scene remains within **550,000 triangles / 110 submissions / 36 materials**. Runtime effects are explicitly separate, not a relaxation or claim to meet base-only limits. The lighting adapter uses three batches, up to 420 lenses, 501 halo slots and 177 ground-footprint slots. It allocates eight unshadowed spotlights, one 64x64 mask and one 680x680 RG float texture (3,699,200 data bytes). No additional shadow-map pass is introduced. These are bounded CPU/object counts, not laptop FPS or total GPU-memory measurements.

The production renderer chunk is **447.37 kB minified / 119.16 kB gzip**; the entry chunk is **526.54 kB / 156.87 kB gzip**. The existing >500 kB entry warning remains unsuppressed.

**Visual evidence:** isolated in-memory WebKit rendering compiled the final lamp, ground-light, weather and snow shaders without reported page/shader errors. Captures cover night overview, street/park views, front and rear vehicle lamps, rain, accumulated snow, mist/Lightweight and afternoon. The rear view confirms paired red lamps, a cabin-mounted upper stop lamp and separate amber indication; the snow view confirms visible supported public-light footprints. These captures are renderer fixtures, not a successful served application walkthrough. The day fixture follows a wet/snowy sequence and retains its authored weather state rather than claiming a pristine first-load screenshot.

**Remaining environment limitations:** the applicable `test:e2e` command selected nighttime-rain and weather/recovery scenarios, but Chromium crashed at launch (`SIGSEGV`) before any application assertion; the second scenario did not run. WebKit launches but still times out navigating to the local served URL. The isolated renderer does not establish production loading, persistent browser preferences, physical-device FPS, all-angle occlusion or long-session behavior. No deployment, commit, push or new pull request was performed.

## Population diversity verification - 2026-09-13

**Pre-merge record (`121817c`).**

**442 tests in 22 files pass** in the complete single-worker Vitest run (180.93 s). Strict TypeScript, ESLint and the production build pass. The requested increase is 144 street walkers, 36 park walkers, eighteen runners, twelve cyclists, six court players and eight meadow family figures; eight picnic figures remain separately counted. Stable IDs, all thirteen work roles, five age bands, seven skin tones, independent appearance, actual clothing/accessory geometry and purposeful pace are covered. See [people and research](PEOPLE_AND_ACTIVITY.md).

Geometry tests verify age-scaled planted-foot contact, running flight, shorts/trainers, actual per-instance skin/clothing colors and a conservative 0.8 x 1.2 m swept body envelope. Expanding the old collision proxy revealed tight-park-bend overlaps; 1.9 m route headway and 1.65 m geometric clearance correct them. Fourteen twenty-minute traffic/weather scenarios and five fifteen-minute park seeds pass with the larger crowd, retaining existing road/cyclist/signal fingerprints. Sidewalk headway scans are grouped by route.

Meadow tests cover six smaller children and two guardians, two-minute dry/snow body-clearance samples, complete loop/gait seam continuity, bounded speed, grounded soles, invalid inputs and deterministic retained-time reconstruction. Scene checks verify all 232 human figures, including resting people, and clear paths/static props around the play envelope. Runtime coverage exercises actual meadow wiring through movement, pause, hidden time, snow support, graphics restoration and reduced-motion stills. Existing court contacts and full-size surfaces remain unchanged.

| Current source-scene accounting | Triangles | Visible submissions | Visible materials | Visible geometries |
| --- | ---: | ---: | ---: | ---: |
| Base scene | 582,904 | 88 | 32 | 36 |
| Accumulated snow | 901,614 | 143 | 36 | 38 |

The richer, roughly 49% larger active human population explicitly revises the base triangle allowance from 550,000 to **600,000** (+9.1%); 110 submissions and 36 materials remain the base limits. People use two shared primitive geometries and one neutral material with per-instance colors. Snow remains separately accounted, with 48 snow meshes and three foliage batches. These are CPU traversal/allocation results, not physical-device FPS or complete GPU/memory measurements.

Isolated in-memory WebKit rendering captures a 24-person appearance sheet, six children/two guardians in the meadow, reservoir runners, street detail and the city overview at 1440 x 1000, without reported page/shader errors. This directly verifies rendered original people, not served-app navigation or complete UI/browser acceptance. The regular Chromium smoke check crashes during browser startup (`SIGSEGV`) before any application assertions; HTTP-responsive local preview alone is not a substitute. No physical-device, long-session or complete weather/lighting matrix sign-off is claimed.

The production renderer chunk is 444.13 KB minified / 118.62 KB gzip; the entry chunk is 527.13 KB / 157.58 KB gzip. The existing >500 KB Vite warning remains visible. Documentation validation resolves 124 relative links across fifteen documents; all nine tracked JSON files parse, and all eleven original research artifacts retain their byte counts/hashes. No source assets or research images are shipped. The user approved committing, pushing and opening a pull request with the limitations above; deployment remains excluded.

## Historical version-005 integration - 2026-09-13

Basketball is 28.6512 x 15.24 m and pickleball 13.4112 x 6.096 m, with full runoff areas, a continuous 2 m passage and unchanged human scale. Grounded practice cycles, paddle/hand contacts, fixed rim/net targets under snow, pause/recovery and reduced-motion stills remain covered. The scene uses approximately 0.20 x 0.26 x 0.016 m paddle blades and a 0.037 m pickleball radius. Camera/semantic tests cover both court runoffs while excluding adjoining streets; the original fallback uses matching dimensions, placement and focus metadata.

The traveling population is 180: 96 neighborhood walkers, twenty-four park walkers, twelve runners, 36 motor vehicles and twelve cyclists. Six court players bring the rig count to 186. Fourteen twenty-minute traffic/weather seeds and five fifteen-minute park seeds retain body separation, progression, gates, traction behavior and existing vehicle/cyclist/signal fingerprints.

All eight metro openings are 1.9 x 4.5 m at sidewalk grade. Tests raycast first/middle/last treads and the -2.24 m landing through both the island and backdrop, and compare below-grade weather-grid heights with the actual exposed geometry. Seven additional sheds retain 2 m clear walking channels and at least 2.4 m headroom; four also have upper facade frames. The original construction scene, 94 buildings and retained street furniture remain.

| Current CPU snapshot | Triangles | Visible submissions | Visible materials | Geometries |
| --- | --- | --- | --- | --- |
| Base scene | 536,690 | 91 | 30 | 33 |
| Accumulated snow | 855,496 | 147 | 35 | 36 |

The complete base scene remains within the unchanged **550,000 / 110 / 36** ceilings. The streetscape-only guard explicitly changes from 430,000 triangles / 31,000 parts to 440,000 / 32,000 for six additional entrances, seven sheds and four upper scaffolds; the measured module is 437,092 triangles / 31,460 parts / 30 batches, with no new paint materials. This submodule allowance is not a relaxation of the whole-scene budget. Snow work and extra render passes remain separate, not a claimed device-performance result.

The grid remains 462,400 cells and 3,699,200 bytes, with three foliage batches and 48 snow meshes. Maximum captured static height is about 23.707 m, below the precipitation spawn plane. These are CPU/allocation counts, not GPU frame time, FPS or complete memory accounting.

Isolated WebKit screenshots cover the full-size court, compact Crosstown stairs and accumulated snow. Controlled shadow-on/off comparisons identified ground/roof self-shadow striping; scaling the depth bias to 1.25 shadow texels removed the observed bands in sunny and snowy views without increasing map resolution or disabling shadows. The earlier 2 mm snow-shell separation remains in both color and shadow passes. These captures use an in-memory local bundle, not successful served-URL navigation, and do not establish long-session flicker elimination.

The first combined run passed 406 of 407 tests; only the 900-second, two-world camera-tour test exceeded its 5-second wall-clock limit under shared load. All 28 model tests then passed in isolation without changing assertions or timeouts. A complete repeat is pending. Nine JSON files parse; 121 relative links across fifteen project documents resolve. All eleven original research artifacts remain byte-identical (3,004,002 bytes), and earlier SVG versions are unchanged.

## Historical version-004 feature checkpoint - 2026-09-13 (pre-merge)

Before synchronization with the newer weather/deployment work on main, the integrated city follow-up at `eabf072` passed **248 Vitest cases in 16 files**, strict TypeScript, ESLint and the production build. It included 94 buildings, 36 intersections, 24 surrounding blocks, 126 traveling actors, six court players and two sports balls. The park contained 87 trees with clear shared paths. This checkpoint also predates the smaller-pickleball/moving-player correction; it does not verify that follow-up.

Eight twenty-minute street seeds retain full-footprint separation, park exclusion, circuit completion and waits below 100 seconds at the increased population. Five fifteen-minute park seeds cover gate transitions, spacing and sustained running. Court checks verify continuous basketball dribble/pass/shot/rebound trajectories, shared-rim alignment, both pickleball directions, net clearance, receiving-side bounces, paddle contact, bounded play, retained-clock reconstruction and reduced-motion stills. Overview/shadow tests pass after explicitly refreshing the expanded shadow camera's projection.

The pre-merge base scene measured **88 visible mesh submissions, 507,474 triangles and 31 materials**, within the explicit 110 / 550,000 / 36 source-scene ceilings. These figures exclude extra renderer passes and runtime weather effects and are not physical-device FPS. The entry chunk was 505.13 KB minified / 150.62 KB gzip; the renderer chunk was 405.84 KB / 106.07 KB gzip. The >500 KB warning remained visible.

**Visual verification remains blocked.** Chromium startup still crashes or times out. An alternative WebKit binary was installed after its missing-executable error; it launches, but navigation to the local app times out before application assertions. Native browser inspection also fails closed because it cannot verify the page URL. No missing-permission workaround or final screenshot claim is made. The shared preview remains HTTP-responsive, but that alone is not visual acceptance. The final merged revision requires a new integrated verification record.

## Implemented merge adaptations

The code reconciliation now retains rectangular precipitation bounds of +/-110 X and +/-170 Z without increasing the fixed particle pools. The separate height/deposition grid uses square extent 170, resolution 680x680 and 0.5 m cells. Its heights/retention Float32 arrays total 3,699,200 bytes by allocation arithmetic; this is not a runtime-memory or GPU profile.

Shared tree/reed batches now receive wind, and volumetric snow includes park lawn/path materials. Three rain basins move to Great Lawn X/Z points (4, -3), (13, -4), (5, 6), rim Y=-0.035, with real holes through lawn overlays and the island base. Reservoir ripples align with water Y=0.018. Shadows refresh on retained weather revisions so canopy sway and snow depth are not permanently cached.

The compact non-modal Settings dock, bottom-only landmark controls, CitiVibe header without title card/Field guide button, and shortcuts inside Settings are retained. These are implemented merge semantics supplied during integration. The refreshed CPU accounting below includes the final metro changes; it does not establish final suite or browser/visual success.

## Historical published-merge CPU accounting - 2026-09-13

| Snapshot | Triangles | Visible mesh submissions | Visible materials | Geometries |
| --- | --- | --- | --- | --- |
| Base scene | 511,728 | 92 | 30 | 33 |
| Accumulated snow | 818,742 | 149 | 35 | 36 |

These are CPU-accounted geometry snapshots supplied by the integration run, **not measured GPU draw calls, frame time or FPS**. They exclude the runtime airplane. The base snapshot fits the stated base-scene accounting ceilings; the snow snapshot includes additional rendering work and must not be presented as meeting those same base-only limits or a verified device-performance budget.

The grid retains 462,400 cells and 3,699,200 bytes across its heights/retention arrays. There are three foliage batches and 49 snow meshes. These allocation/object counts are not a complete runtime-memory or GPU profile.

## Final local automated merge validation - 2026-09-13

The final local integration run passed **all 385 tests in 18 files** with `--maxWorkers=1` in **76.42 seconds**. Strict TypeScript, ESLint and the production build also passed. This is local automated validation, **not browser, screenshot, visual or physical-device sign-off**.

The earlier court paused-redraw test omitted the scheduled draw tick; the parent test now advances that tick before asserting. The concurrent tour test reached its default timeout under shared CPU load; its targeted run and the complete sequential suite passed without changing timeouts or weakening assertions. Interim suite counts are not retained as final results.

The production entry chunk is **521.71 KB minified / 155.31 KB gzip**; the renderer chunk is **426.08 KB minified / 112.09 KB gzip**. Vite's >500 KB warning remains visible; no warning suppression or completed bundle optimization is claimed.

Documentation validation checked **130 relative links across 16 Markdown documents**. All **nine JSON files** parse, and all **eleven original research artifacts** retain their recorded byte counts and hashes. The browser startup/navigation, final visual review, physical-device performance, assistive-technology and long-session blockers remain outstanding.

### Subsequent structural snow-render fix

A user-reported snow flicker was traced to copied facade skirts rising within the original wall plane. The structural fix adds 2 mm of normalized world-normal separation identically in the color and shadow vertex passes, without changing source geometry or physics. Fully accumulated snow uses opaque depth ordering; settling/melting retains a transparent fade, with shader invalidation only when the opacity mode changes. Zero-retention targets no longer create coplanar zero-thickness shells.

Three regression cases were added for depth margin at supported camera angles and color/shadow agreement, stable opaque/fade modes, and zero-retention exclusion. After the fix, 31 targeted weather-volume, environment and runtime tests, strict TypeScript, ESLint and the production build passed. The 385-test full-suite record above predates this fix; a full 388-test run is not claimed. The renderer chunk was 426.50 KB minified / 112.24 KB gzip; entry size and recorded geometry counts were unchanged.

### Isolated WebKit rendering probe

A fresh diagnostic rendered an inline HTML control successfully but timed out navigating even to an intercepted, locally fulfilled test URL. A separate in-memory document supports WebGL2. Bundling the local app with the existing Vite toolchain and injecting its JS/CSS into that owned document produced actual sunny overview and accumulated-snow overview/Crosstown screenshots without reported page or shader errors. The snow fixture used an inspection-only model hook to seed retained snow, then exercised the visible weather, pause and landmark controls. This hook and the generated captures remain session artifacts, not application code.

These initial captures established isolated renderer operation, not successful navigation to the served app, storage behavior, production loading, long-running flicker elimination or physical-device performance. Originless local-storage notices are expected in this harness. Later version-005 captures are recorded separately above.

## Remaining verification gates

- Rerun local automated checks after any further implementation changes. Do not add historical feature/main test counts together or reuse their passing status for a new revision.
- Complete browser/visual verification of the shared city, park, court and counterflow geometry with weather-aware motion: snow grounding, conservative traction, stopping bars, full-body reservations, ball/rim/net alignment, pause, reduced motion and graphics recovery.
- Complete served-browser review of the full-size basketball/pickleball surfaces, readable player drives/rebounds/repositioning, moving contacts and reduced-motion stills. Isolated renderer captures and geometry/motion assertions do not establish every browser/device combination.
- Inspect expanded precipitation/snow coverage and ground-pool openings against buildings, courts, gate approaches and walking/cycling paths. The incoming main's small-district grid and snow-batch counts are not current expanded-scene measurements.
- Keep version-005 base/snow accounting separate from shadow passes and GPU profiling; refresh it if artwork changes again. Historical feature and merge measurements are not current snapshots.
- Complete browser/accessibility review of CitiVibe naming, no title card or Field guide button, Settings/`?` help discovery, Help modality and non-modal Settings focus/input behavior. Retain Vercel cache/security headers; no deployment is authorized by these checks.
- Rerun browser startup and navigation before claiming application assertions or final screenshots. Preserve the documented blockers until an actual merged browser run establishes otherwise.

## Behavior matrix

| ID | Acceptance criterion | Planned verification |
| --- | --- | --- |
| AC-01 | Product is an original ambient city. No directory, listings, ads/sponsors, commercial landing sections, commerce, identity, moderation, analytics, or presence counters. No backend/database/login dependency. | Review runtime routes/content and network requests: only required static app/assets, no captured source APIs or tracking calls. Confirm original asset provenance. |
| AC-02 | Every visible control is named, keyboard reachable, operable, and not intercepted by another layer. Overlay interaction never pans or zooms the world. Scenery clicks have no selection behavior. | RTL semantics plus Playwright hit-testing of control centers/edges and event assertions. Exercise touch/pointer cancellation and scroll inside panels. |
| AC-03 | Pan reaches all modeled map edges; zoom, 360-degree orbit, 30-75 degree tilt, reset, and guided views stay inside valid bounds and do not clip into buildings at authored views. | Unit bounds/pivot tests plus browser Command-drag and control-parity checks at supported desktop sizes. |
| AC-04 | Only one camera mode drives the pose. Manual input cancels reset transitions/tours or guided views on the next rendered frame; no competing transition continues. Stop retains current pose. Modal dismissal does not automatically restart a tour. | State-machine tests for all mode pairs and integration tests issuing rapid conflicting commands. Assert no stale controller writes afterward. |
| AC-05 | City-wide tour anchors have unique IDs, readable subjects and valid bounded poses. No landmark-selection bar, commands/state, bracket shortcuts, raycaster, click volumes, highlights or contextual tours remain. Actor IDs remain stable; no camera-follow action is exposed. | Validate the ordered six-view tour and actor identity. Assert absent selection UI/resources, inert clicks/brackets, and preserved manual camera/guided-view behavior. |
| AC-06 | User pause freezes actors, signals, autonomous camera, event timers, weather progress, accelerated clock, and audio; manual view/settings and reduced-motion guided views remain useful. A new continuous tour is explained as unavailable while paused. Resume has no catch-up jump. | Inject clock: after 30 seconds paused, simulation tick/progress are unchanged; first resumed movement is no more than normal fixed-step travel. Test manual interruption and guided views while paused. |
| AC-07 | Hidden/pagehide suspends frame/audio work, preserves user pause, and resets elapsed timing. Blur alone does not stop a visible second-screen world. | Test a five-minute hidden interval, return, and compare state to the next expected tick. Confirm no hidden RAF chain or burst of queued events. Clear held keys on blur. |
| AC-08 | Route loops are continuous, speeds/dwell times are bounded, and conflicting road/crossing actors do not simultaneously occupy authored exclusive conflict zones. Populations/events are capped. | Seeded multi-minute simulation tests, boundary/loop/stop tests, and visual traffic review. No teleport-through-conflict workaround. |
| AC-09 | Reduced motion starts the world paused, stops cinematic camera effects, replaces automatic tours with stepwise views, and retains all feature access. Explicit conservative actor motion is possible. | Emulate media query, change it while running, test local override, and check no hidden autoplay/overshoot/rapid rain. |
| AC-10 | Sunny/Cloudy/Rain/Mist/Snow/Windy and all four time modes work. Natural weather is opt-in; manual weather disables it in saved and live state. Rain intensity is bounded to 0-30 mm/h and defaults to 8. Local-clock lighting resumes with a 10-second blend instead of changing actors' elapsed time. Retained water/SWE drives actual snow depth, wetness, rain-fed pool volumes and cautious traffic; quality cannot alter physical input. | Inject date/clock/weather and compare fixtures for presets, transition boundaries, pause, resume, and hidden-page return. Assert combined catchment/pool mass balance, bounded particles/depth/volumes, collisions above snow/water, meltwater, canopy attachment, snow-grounded actors, reduced motion and recovery. Compile both snow color/shadow shaders in a real browser and inspect pool geometry matrices and snow-depth uniforms. |
| AC-11 | Audio is initially silent on every load, including returning users. Only explicit enable makes sound. Pause/hidden fades/suspends it; blocked resume/failure is visible. | Spy on audio creation/resume/gain and confirm in a real browser. Check mute/volume persistence never bypasses a fresh gesture and teardown leaves no active nodes/schedulers. |
| AC-12 | Fullscreen UI reflects actual API state, handles rejection, and offers honestly labeled expanded view when unsupported. Escape performs one layer's action at a time. | Test request rejection and `fullscreenchange`; manually exercise browser Escape/native controls on supported devices. |
| AC-13 | Non-sensitive preferences survive reload; invalid/unknown-version data and blocked storage produce a visible nonblocking notice and safe in-memory operation. No identity/event history is stored. | Unit schema/migration tests and browser localStorage denial/corruption cases; inspect stored keys and payload. |
| AC-14 | Help has modal focus entry/containment/return. Settings is a bounded lower-left non-modal dock without backdrop or Tab trap; focus enters Close, and Escape within it returns to its trigger. City navigation/pause remain usable while Settings is open. All features are reachable via a complete keyboard route, with no global single-character shortcuts while typing. | Keyboard-only walkthrough, RTL focus tests, desktop dock bounds/hit-testing/scroll isolation, and screen-reader check. Live regions announce meaningful transitions, not every frame or clock tick. |
| AC-15 | Quality modes respect bounded DPR/caps, do not change simulation speed, and retain core interaction and target validity. Automatic uses hysteresis and no network telemetry. | Inject frame samples, assert no tier flapping or unbounded DPR; profile High/Auto/Lightweight and compare actor travel over equal simulation time. |
| AC-16 | Initial district geometry aims for 3-5 MB compressed; loading state/still is honest and useful. | Record encoded/transferred/decoded sizes separately, cold and warm loads, compression/decoder overhead, and asset version. No fabricated loading percentages. |
| AC-17 | Retry, late-load cancellation, unmount, and context restore never create duplicate worlds. All GPU/audio/listener/timer resources are released by disposal. | Ten mount/unmount and failure/retry cycles; inspect resource counts after settling. Trigger WebGL context loss/restoration where supported and verify explicit fallback on failure. |
| AC-18 | Long sessions do not accumulate actors, histories, timers, resources, or stale frame work. | Two-hour visible/hidden/pause stress session with periodic quality/weather/tour changes and resource snapshots. Investigate monotonic growth. |
| AC-19 | Unsupported WebGL/load error/context failure shows an original static fallback, explanation, help and a concise accessible scene description, without landmark navigation; no directory. Unavailable controls explain why. | Disable WebGL, fail assets, lose context, retry, and use keyboard/screen reader at supported desktop widths. Verify original assets, no copied source poster. |
| AC-20 | Same seed, simulation tick, weather, time, quality, viewport, and asset version reproduce the same composed scene within agreed raster tolerance. | Deterministic screenshots and state assertions; no wall-clock/random drift in fixtures. |

## Viewports and accessibility targets

Current automated desktop targets: **1024 x 768, 1440 x 900, and 1920 x 1080 CSS px**. The user explicitly excluded mobile edge-case work on 2026-09-12. Earlier phone/tablet targets are superseded; do not treat them as acceptance gates.

No page-level horizontal overflow at supported desktop widths; panels fit within the visual viewport and scroll internally as needed. Enlarged text must not conceal close/stop actions. Panel content can scroll; scene navigation must not intercept it. Existing small-screen reflow is retained without a phone-specific support claim.

Proposed touch targets are at least **44 x 44 CSS px** with adequate separation. Target WCAG AA text contrast (4.5:1 normal text, 3:1 large text) and 3:1 for meaningful controls/focus indicators. State cannot depend on color alone. Check text zoom to 200% and reflow at an effective 320 px width. Use semantic controls and readable accessible names, not unlabeled icon canvases.

Keyboard walkthrough must include initial guide, pan/zoom/rotate/reset, city-wide tour/guided views, pause, time/weather, audio, quality, help, fullscreen/expanded view, and fallback as their milestones become available. Bus/drone follow buttons and B/D shortcuts must remain absent. No essential feature may be mouse-only. This walkthrough is not a directory requirement.

Automated Chromium is necessary but insufficient for physical-device performance claims: record a named computer and its browser/OS versions before declaring those budgets met. Screen-reader checks should include the supported desktop platform combination, not only an automated accessibility scan. Physical-phone testing is outside the current request.

## Performance budgets

These proposals need calibration on named devices. Measure a production build with a fixed scene seed and asset version; record quality, DPR, resolution, power mode, browser, ambient temperature where relevant, and test duration. Do not compare headless Chromium resource observations to physical-device frame rates.

| Metric | Proposed target | Method |
| --- | --- | --- |
| Reference laptop | Approximately 60 FPS: median at least 55 FPS and p95 frame interval no more than 20 ms at agreed desktop settings. | Warm for 60 s, then sample at least 60 s each for overview, landmark focus, tour, and rain. Also inspect missed frames and CPU/GPU work. |
| Control responsiveness | Visible state feedback within 100 ms; camera automation yields by the next rendered frame after input handling. | Input-to-state/frame instrumentation and real interaction review, including under rain/load. |
| DPR | High <= 1.75; Automatic <= 1.5 initially; Lightweight <= 1.0. | Assert actual drawing-buffer size relative to CSS dimensions at DPR 1/2/3 device settings. |
| Primary geometry | Aim for 3-5 MB compressed district bundle. | Actual assets and decoder overhead; record both compressed delivery and decoded memory. |
| Source-scene accounting | Expanded base scene: <= 550,000 triangles, <= 110 visible mesh submissions, <= 36 materials. | CPU traversal including actor artwork; exclude runtime weather and extra passes from this specific accounting, then measure those separately. These are not FPS results. |
| Render work | Initial profiling goals: <= 100 main-pass calls laptop and <= 60 Lightweight; recalibrate explicitly for the merged weather/world workload. | Actual renderer statistics plus GPU profile, including snow/pool/particle work; count shadow and other extra passes separately. See [art](ART_AND_ASSETS.md). |
| Loading UI | Meaningful original still/status within one second after HTML is available; no more than ten seconds without a slow-load explanation and actionable fallback. | Controlled slow/failing resource tests; this is not a universal time-to-interactive promise. |
| Long-session memory | After a ten-minute warm-up, aim for no monotonic growth and <= 10% retained-memory growth after repeated scenarios at 60/120 minutes. | Compare equivalent settled states; document GC variability and GPU measurement limits, investigate resource counts rather than relying on one heap sample. |
| Hidden/paused work | Zero application RAF loop while hidden. Paused scene renders only on requested changes, not continuous actor/effect ticks. | Frame/timer counters; verify sound scheduling and event queues stop. |

Failing a proposed budget requires profiling and an explicit revised decision, not hiding the measurement or quietly deleting controls. Draw calls, FPS, compressed bytes, and heap size describe different costs. Do not label POSITION vertices as triangles or encoded resource sums as universal cold-load bandwidth.

## Test layers and repeatability

**Vitest:** deterministic route/intersection rules, bounded time accumulation, camera mode transitions, environment clocks, quality hysteresis, manifest validation, preferences, and cleanup ownership.

**React Testing Library:** user-facing labels/states, keyboard controls, modal focus, error announcements, storage failure feedback, and fallback semantics. Prefer user-level interactions; mock renderer/audio boundaries rather than internal product logic.

**Playwright:** real DOM/canvas input routing, viewport/layout/hit tests, screenshot fixtures, loading failures, visibility behavior, reduced motion, WebGL context events, and audio/fullscreen policy boundaries. Some OS/browser behaviors require manual tests and should not be marked covered by mocks.

**Real-device profiling:** sustained frames/thermal behavior, touch gestures, Safari fullscreen limitations, audio permissions, GPU memory proxies, and assistive technology. No test plan justifies collecting production analytics.

Visual fixture inputs must include seed, simulation tick, fixed date/time zone or explicit normalized phase, weather preset, natural-weather off or deterministic schedule, camera anchor, quality, viewport/DPR, asset version, and motion preference. Fix any audio randomness separately or disable audio in visual tests. Compare scene and control state, not only pixels.

## Historical verified pause checkpoint - 2026-09-12

- Full strict TypeScript and ESLint checks pass.
- The full Vitest run passes **153 tests in 11 files**, including pure subsystem tests for features not yet connected to the UI/runtime.
- The production build succeeds. Its lazy Three.js renderer chunk remains approximately **584 KB minified / 150 KB gzip** and triggers Vite's 500 KB chunk warning; no warning suppression or completed bundle optimization is claimed.
- **11 Chromium/Playwright scenarios pass**: live navigation, keyboard/reduced motion and axe checks, unsupported-WebGL fallback, no-JavaScript still, real context loss/restoration, deterministic paused rendering/no external requests, Command-drag orbit around a stable pivot, ordinary mouse/overlay isolation, and layouts at 1024x768, 1440x900, and 1920x1080.
- Tour arbitration, guided views, preferences, modal focus, and expanded-view behavior have unit/component coverage. Native fullscreen rejection/escape across desktop browsers, real sound policy, complete settings integration, and final NYC visuals remain outside this completed browser set.
- The final expanded-view notice cleanup is covered by the seven App component cases plus a renewed typecheck/lint pass.

The browser suite uses software-rendered Chromium and a production bundle, not the development server. This historical checkpoint does not establish physical-computer FPS, screen-reader usability, long-session memory stability, or a finished M1-M8 product. The user subsequently resumed implementation for the connected-city slice.

## Historical version-003 behavior coverage

The street system uses eight ten-minute seeds (`0`, `1`, `4`, `14`, `42`, `91`, `2401`, `0xffffffff`) to check full-footprint separation, continuous routes, acceleration/braking, per-actor progress, intersection usage, painted stop bars and maximum queue waits below 100 seconds. Green phases last eight seconds; a separate 8.5 m stop-line offset avoids moving the 7 m turn boundary into bicycle corner-cutting geometry. Occupied reservations survive phase changes until the actor's rear clears.

Five ten-minute park seeds check every visitor repeatedly enters/leaves through connected gates, stays continuously on shared paths, maintains spacing and avoids prolonged deadlock. No motor vehicle or cyclist enters the park. The old internal road, bus/car circuit and signals are absent. Street buses circulate without scheduled stops, and neighborhood walkers remain on sidewalks; pedestrian lamps do not imply implemented road crossings.

Public-lighting checks cover the shipped lamp manifest (66 street lamps clear of the park lawn, 15 park lamps inside the lawn and beyond every walking-path body clearance), rejection of duplicate/off-island/park-intruding/path-blocking fixtures, presence of dusk-tagged emissive heads and non-shadowing additive ground pools, per-window glow attributes carrying both unlit windows and several distinct tints, and the environment ramp driving lamp emissive and pool opacity from day to night and restoring them on disposal.

Geometry checks cover five landmark targets, original version-003 fallback references, path/render alignment, 48 lane markings clear of crossings, four pedestrian stencils on park paths, taxi dimensions/details, deterministic regeneration and independent idempotent disposal. Originality/provenance and image-observation limits are documented in [art](ART_AND_ASSETS.md) and [research](NYC_CITY_RESEARCH.md).

### Version-003 code verification - 2026-09-13

- Strict TypeScript and ESLint pass; **216 Vitest cases in 15 files pass**, including street/park soaks, signal-phase/art wiring, scaffold pedestrian clearance, tree/path clearance, deterministic geometry and resource ownership.
- The final base scene has **74 visible mesh submissions, 199,216 triangles and 29 materials**, below the explicit expanded-scene ceilings of 240 / 200,000 / 36. These CPU traversal counts exclude additional rendering passes and runtime effects; they are not physical-device FPS or GPU measurements.
- The production build passes. The entry chunk is **502.29 KB minified / 149.31 KB gzip**; the renderer chunk is **396.32 KB / 102.49 KB gzip**. The >500 KB Vite warning remains visible and is not suppressed. The shared walking-curve math is now also used by the retained model.
- Nine repository JSON files parse, 117 relative documentation links resolve, the SVG is self-contained, and all eleven original research artifacts retain their recorded sizes and SHA-256 hashes (3,004,002 bytes total).
- **Blocked: final Playwright/visual pass.** All twelve fresh browser scenarios failed at browser startup, before application assertions. Bundled Chromium 153.0.8010.12 reported `SIGSEGV / SEGV_ACCERR`; isolated blank-page launches with the bundled full browser and system Chrome also timed out, and disabling GPU did not resolve the headless-shell crash. No application changes were made to mask this environment failure.
- Earlier overview, court, Night/Rain and Mist/Lightweight captures passed inspection before the park/detail revisions; the car-free park was inspected before the final six-detail pass. These are **not** final-art screenshot sign-off. Rerun `npm run test:e2e` and inspect current overview, park, cab/signal/brownstone/scaffold closeups, Night/Rain and Mist after browser startup is restored.

Implementation confidence is high for the tested geometry/simulation contracts; visual/browser confidence remains limited until that blocked pass is completed. Physical computer FPS, assistive technology, automatic-quality runtime calibration and two-hour stability remain separate outstanding work.
The following incoming-main records describe the earlier weather/settings branch, before reconciliation with the expanded city. Their test totals, bundle sizes and browser observations are retained as historical evidence, not merged validation.

## Historical incoming-main weather depth and controls checkpoint - 2026-09-13

- The incoming-main run after the intensity UI handoff passed strict TypeScript, ESLint, production build, and **272 unit/component tests across 14 files**.
- Physics tests cover the verified rain-speed table, drag relaxation, bounded wind/pools, sampled roof collision, water/SWE and complete catchment/pool conservation, melting/drying, intensity bounds, 30/60 Hz determinism, and bounded snow-ground support without cumulative walker elevation.
- Renderer-adapter tests cover snow-shell color/shadow shader wiring, retained depth uniforms, canopy transform following, borrowed-resource ownership/disposal, actual holes/paraboloid beds, rising/spreading pool transforms, graphics rebuilds, and reduced-motion ripple suppression. Shader-string tests are not GPU compilation.
- Intensity controls have coverage for zero/max dispatch, persistence/reload, backward-compatible v1 preferences, invalid-data notices, Rain/natural-mode visibility, live-status audio coupling and fresh sound consent. Zero rain stops new rain input without clearing existing stored water.
- Earlier browser work exercised the original weather coating, pause, recovery, persistence, night contrast and accessibility. The combined browser run reached 13 passing cases; its remaining exact-image case passed separately after fixing the test's comparison of UI hover/focus pixels and replacing enormous raw-PNG assertion diffs with hashes. Capture now waits for requested rendering and excludes UI overlays when comparing the world.
- **Browser blocker at that checkpoint:** both installed Chromium headless-shell and full Chromium crashed with `SIGSEGV` before loading a page. Native app observation also returned unavailable content; no unsupported claim about the host's exact cause is made. This blocked the geometry/shadow, intensity and final integrated dock browser pass. Authored browser tests were not counted as passed.
- New browser scenarios assert one lower-left Settings trigger, compact dock bounds, no modal/backdrop, internal scroll isolation, city keyboard/pause access, focus return and axe checks at 1024x768, 1440x900 and 1920x1080. The weather probe observes actual snow-depth uniforms and ground-pool model matrices without adding a production debug global.
- That build retained Vite's 500 KB chunk warning (**508.84 KB minified / 150.80 KB gzip** for its largest chunk; lazy renderer **396.75 KB / 100.67 KB gzip**). No warning suppression or completed optimization is claimed.

All 11 supplied research artifact byte counts and SHA-256 hashes were verified unchanged; checked-in JSON parses and documentation links resolve. This is not final visual, physical-device FPS, assistive-technology, or two-hour memory sign-off.

## Historical incoming-main smoother weather transitions - 2026-09-13

- Replaced the two-second/restarted smoothstep with a retained two-stage blend: manual changes reach 99% in about eight simulation seconds; natural changes in about thirty. Retargeting preserves current values and blend velocity, including natural/manual handoff.
- Regression tests first reproduced the old timing and velocity reset, then passed with the new model. Coverage includes interrupted bounds, 30/60 Hz atmospheric equivalence, rain/snow/cloud/lighting projection, mid-blend renderer rebuilding, pause/resume without catch-up, and immediate paused/reduced-motion selections without clearing snow.
- Strict TypeScript, ESLint, the production build and **279 tests across 14 files** passed before the connected-city merge. The largest chunk was **509.17 KB minified / 150.89 KB gzip**; the existing bundle warning remained.
- The browser weather probe now checks actual fog uniforms during the gradual transition and allows the snow fixture forty simulation seconds to accumulate. These browser assertions are **authored, not passed**: renewed headless-shell and full-Chromium startup probes both time out before page creation. The previous draft's GPU/visual readiness gate remains unresolved.
