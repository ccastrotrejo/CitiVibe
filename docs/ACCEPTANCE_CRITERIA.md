# Acceptance criteria and verification plan

**Status: street names, population diversity, removed landmark selection and night lighting pass combined local automated checks. Served-browser and physical-device gates remain open.** The current scene retains thirty-six intersections, twenty-four blocks, 94 buildings and a 78 x 176 m park within a 220 x 340 m map. It has 224 active/posable people (260 rigs including vehicles), eight resting neighbors, two balls, full-size courts with six light poles, eight compact subway entrances, unchanged scaffolding and twenty-four street-name blades on twelve existing signal poles. Previous feature and merge records below are historical. Automated coverage does not substitute for physical-device FPS, long-session, cross-combination or assistive-technology verification. Production readiness is not claimed; landmark selection, camera-follow and the drone remain excluded.

Use this matrix when implementing each [roadmap](ROADMAP.md) milestone. Numerical budgets are working targets; name the reference devices and record actual results before declaring them met. The [experience spec](EXPERIENCE_SPEC.md) is authoritative for pause/camera behavior.

## Lighting and street-sign integration - 2026-09-13

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
