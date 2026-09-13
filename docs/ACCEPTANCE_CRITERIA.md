# Acceptance criteria and verification plan

**Status: M5 plus extended weather/dock work; final browser and broader hardening gates pending.** The live M1-M5 build has automated coverage for camera/clock/input/lifecycle, original content/art, bounded actors, and the now-integrated environment/audio/quality and occasional airplane; the world was enlarged around the tuned core within budget. Unit and component tests establish live integration and deterministic behavior, but do not substitute for physical-device FPS, two-hour stability, cross-combination legibility, and screen-reader/assistive-tech verification, which remain outstanding (M6/M7). Production readiness is not yet claimed. Camera-follow and the drone were removed at the user's request.

Use this matrix when implementing each [roadmap](ROADMAP.md) milestone. Numerical budgets are working targets; name the reference devices and record actual results before declaring them met. The [experience spec](EXPERIENCE_SPEC.md) is authoritative for pause/camera behavior.

## Behavior matrix

| ID | Acceptance criterion | Planned verification |
| --- | --- | --- |
| AC-01 | Product is an original ambient city. No directory, listings, ads/sponsors, commercial landing sections, commerce, identity, moderation, analytics, or presence counters. No backend/database/login dependency. | Review runtime routes/content and network requests: only required static app/assets, no captured source APIs or tracking calls. Confirm original asset provenance. |
| AC-02 | Every visible control is named, keyboard reachable, operable, and not intercepted by another layer. Overlay interaction never pans, zooms, raycasts, or selects the world. | RTL semantics plus Playwright hit-testing of control centers/edges and event assertions. Exercise touch/pointer cancellation and scroll inside panels. |
| AC-03 | Pan reaches all modeled map edges; zoom, 360-degree orbit, 30-75 degree tilt, reset, and focus stay inside valid bounds and do not clip into buildings at authored views. | Unit bounds/pivot tests plus browser Command-drag and control-parity checks at supported desktop sizes. |
| AC-04 | Only one camera mode drives the pose. Manual input cancels focus transitions/tours on the next rendered frame; no competing transition continues. Stop retains current pose. Modal dismissal does not automatically restart a tour. | State-machine tests for all mode pairs and integration tests issuing rapid conflicting commands. Assert no stale controller writes afterward. |
| AC-05 | Original POI focus resolves stable IDs. Missing targets produce a visible explanation. Actor IDs remain stable across regeneration and quality changes; no camera-follow action is exposed. | Manifest validation and actor identity checks; keyboard and pointer landmark selection parity. |
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
| AC-18 | Long sessions do not accumulate actors, histories, timers, resources, or stale frame work. | Two-hour visible/hidden/pause stress session with periodic quality/weather/focus changes and resource snapshots. Investigate monotonic growth. |
| AC-19 | Unsupported WebGL/load error/context failure shows an original static fallback, explanation, help, and noncommercial landmark focus navigation; no directory. Unavailable controls explain why. | Disable WebGL, fail assets, lose context, retry, and use keyboard/screen reader at mobile width. Verify original assets, no copied source poster. |
| AC-20 | Same seed, simulation tick, weather, time, quality, viewport, and asset version reproduce the same composed scene within agreed raster tolerance. | Deterministic screenshots and state assertions; no wall-clock/random drift in fixtures. |

## Viewports and accessibility targets

Current automated desktop targets: **1024 x 768, 1440 x 900, and 1920 x 1080 CSS px**. The user explicitly excluded mobile edge-case work on 2026-09-12. Earlier phone/tablet targets are superseded; do not treat them as acceptance gates.

No page-level horizontal overflow at supported desktop widths; panels fit within the visual viewport and scroll internally as needed. Enlarged text must not conceal close/stop actions. Panel content can scroll; scene navigation must not intercept it. Existing small-screen reflow is retained without a phone-specific support claim.

Proposed touch targets are at least **44 x 44 CSS px** with adequate separation. Target WCAG AA text contrast (4.5:1 normal text, 3:1 large text) and 3:1 for meaningful controls/focus indicators. State cannot depend on color alone. Check text zoom to 200% and reflow at an effective 320 px width. Use semantic controls and readable accessible names, not unlabeled icon canvases.

Keyboard walkthrough must include initial guide, pan/zoom/rotate/reset, Previous/Next landmark, tour/guided views, pause, time/weather, audio, quality, help, fullscreen/expanded view, and fallback as their milestones become available. Bus/drone follow buttons and B/D shortcuts must remain absent. No essential feature may be mouse-only. This walkthrough is not a directory requirement.

Automated Chromium is necessary but insufficient for physical-device performance claims: record a named computer and its browser/OS versions before declaring those budgets met. Screen-reader checks should include the supported desktop platform combination, not only an automated accessibility scan. Physical-phone testing is outside the current request.

## Performance budgets

These proposals need calibration on named devices. Measure a production build with a fixed scene seed and asset version; record quality, DPR, resolution, power mode, browser, ambient temperature where relevant, and test duration. Do not compare headless Chromium resource observations to physical-device frame rates.

| Metric | Proposed target | Method |
| --- | --- | --- |
| Reference laptop | Approximately 60 FPS: median at least 55 FPS and p95 frame interval no more than 20 ms at agreed desktop settings. | Warm for 60 s, then sample at least 60 s each for overview, landmark focus, tour, and rain. Also inspect missed frames and CPU/GPU work. |
| Control responsiveness | Visible state feedback within 100 ms; camera automation yields by the next rendered frame after input handling. | Input-to-state/frame instrumentation and real interaction review, including under rain/load. |
| DPR | High <= 1.75; Automatic <= 1.5 initially; Lightweight <= 1.0. | Assert actual drawing-buffer size relative to CSS dimensions at DPR 1/2/3 device settings. |
| Primary geometry | Aim for 3-5 MB compressed district bundle. | Actual assets and decoder overhead; record both compressed delivery and decoded memory. |
| Draw calls/materials | Initial art goals: <= 100 main-pass calls laptop, <= 60 Lightweight, roughly 12-24 shared world materials. | Renderer statistics plus GPU profile; count extra passes separately. See [art](ART_AND_ASSETS.md). |
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

## Verified pause checkpoint - 2026-09-12

- Full strict TypeScript and ESLint checks pass.
- The full Vitest run passes **153 tests in 11 files**, including pure subsystem tests for features not yet connected to the UI/runtime.
- The production build succeeds. Its lazy Three.js renderer chunk remains approximately **584 KB minified / 150 KB gzip** and triggers Vite's 500 KB chunk warning; no warning suppression or completed bundle optimization is claimed.
- **11 Chromium/Playwright scenarios pass**: live navigation, keyboard/reduced motion and axe checks, unsupported-WebGL fallback, no-JavaScript still, real context loss/restoration, deterministic paused rendering/no external requests, Command-drag orbit around a stable pivot, ordinary mouse/overlay isolation, and layouts at 1024x768, 1440x900, and 1920x1080.
- Tour arbitration, guided views, preferences, modal focus, and expanded-view behavior have unit/component coverage. Native fullscreen rejection/escape across desktop browsers, real sound policy, complete settings integration, and final NYC visuals remain outside this completed browser set.
- The final expanded-view notice cleanup is covered by the seven App component cases plus a renewed typecheck/lint pass.

The browser suite uses software-rendered Chromium and a production bundle, not the development server. These historical results do not establish physical-computer FPS, screen-reader usability, long-session memory stability, or a finished M1-M8 product. The subsequent user requests resumed the weather/settings slices described below, not unrelated milestones.

## Weather depth and controls checkpoint - 2026-09-13

- The final integrated run after the intensity UI handoff passes strict TypeScript, ESLint, production build, and **272 unit/component tests across 14 files**.
- Physics tests cover the verified rain-speed table, drag relaxation, bounded wind/pools, sampled roof collision, water/SWE and complete catchment/pool conservation, melting/drying, intensity bounds, 30/60 Hz determinism, and bounded snow-ground support without cumulative walker elevation.
- Renderer-adapter tests cover snow-shell color/shadow shader wiring, retained depth uniforms, canopy transform following, borrowed-resource ownership/disposal, actual holes/paraboloid beds, rising/spreading pool transforms, graphics rebuilds, and reduced-motion ripple suppression. Shader-string tests are not GPU compilation.
- Intensity controls have coverage for zero/max dispatch, persistence/reload, backward-compatible v1 preferences, invalid-data notices, Rain/natural-mode visibility, live-status audio coupling and fresh sound consent. Zero rain stops new rain input without clearing existing stored water.
- Earlier browser work exercised the original weather coating, pause, recovery, persistence, night contrast and accessibility. The combined browser run reached 13 passing cases; its remaining exact-image case passed separately after fixing the test's comparison of UI hover/focus pixels and replacing enormous raw-PNG assertion diffs with hashes. Capture now waits for requested rendering and excludes UI overlays when comparing the world.
- **Current browser blocker:** both installed Chromium headless-shell and full Chromium crash with `SIGSEGV` before loading a page. Native app observation also returned unavailable content; no unsupported claim about the host's exact cause is made. This blocks the latest geometry/shadow, intensity and final integrated dock browser pass. Authored browser tests are not counted as passed.
- New browser scenarios assert one lower-left Settings trigger, compact dock bounds, no modal/backdrop, internal scroll isolation, city keyboard/pause access, focus return and axe checks at 1024x768, 1440x900 and 1920x1080. The weather probe observes actual snow-depth uniforms and ground-pool model matrices without adding a production debug global.
- The current build retains Vite's 500 KB chunk warning (**508.84 KB minified / 150.80 KB gzip** for its largest chunk; lazy renderer **396.75 KB / 100.67 KB gzip**). No warning suppression or completed optimization is claimed.

All 11 supplied research artifact byte counts and SHA-256 hashes were verified unchanged; checked-in JSON parses and documentation links resolve. This is not final visual, physical-device FPS, assistive-technology, or two-hour memory sign-off.

## Smoother weather transitions - 2026-09-13

- Replaced the two-second/restarted smoothstep with a retained two-stage blend: manual changes reach 99% in about eight simulation seconds; natural changes in about thirty. Retargeting preserves current values and blend velocity, including natural/manual handoff.
- Regression tests first reproduced the old timing and velocity reset, then passed with the new model. Coverage includes interrupted bounds, 30/60 Hz atmospheric equivalence, rain/snow/cloud/lighting projection, mid-blend renderer rebuilding, pause/resume without catch-up, and immediate paused/reduced-motion selections without clearing snow.
- Strict TypeScript, ESLint, the production build and **279 tests across 14 files** pass. The largest chunk is **509.17 KB minified / 150.89 KB gzip**; the existing bundle warning remains.
- The browser weather probe now checks actual fog uniforms during the gradual transition and allows the snow fixture forty simulation seconds to accumulate. These browser assertions are **authored, not passed**: renewed headless-shell and full-Chromium startup probes both time out before page creation. The previous draft's GPU/visual readiness gate remains unresolved.
