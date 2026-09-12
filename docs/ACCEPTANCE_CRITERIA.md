# Acceptance criteria and verification plan

**Status: proposed targets, not executed application tests.** This repository contains documentation and research only. There are no current FPS results, implemented controls, passing app tests, or production readiness claims.

Use this matrix when implementing each [roadmap](ROADMAP.md) milestone. Numerical budgets are working targets; name the reference devices and record actual results before declaring them met. The [experience spec](EXPERIENCE_SPEC.md) is authoritative for pause/camera behavior.

## Behavior matrix

| ID | Acceptance criterion | Planned verification |
| --- | --- | --- |
| AC-01 | Product is an original ambient city. No directory, listings, ads/sponsors, commercial landing sections, commerce, identity, moderation, analytics, or presence counters. No backend/database/login dependency. | Review runtime routes/content and network requests: only required static app/assets, no captured source APIs or tracking calls. Confirm original asset provenance. |
| AC-02 | Every visible control is named, keyboard reachable, operable, and not intercepted by another layer. Overlay interaction never pans, zooms, raycasts, or selects the world. | RTL semantics plus Playwright hit-testing of control centers/edges and event assertions. Exercise touch/pointer cancellation and scroll inside panels. |
| AC-03 | Pan, zoom, rotation, reset, and focus stay inside valid bounds and do not clip into buildings at authored views. | Unit bounds tests plus browser checks at each viewport, orientation, and representative target. |
| AC-04 | Only one camera mode drives the pose. Manual input cancels follow/tour on the next rendered frame; no competing transition continues. Stop retains current pose. Modal dismissal does not automatically restart a tour. | State-machine tests for all mode pairs and integration tests issuing rapid conflicting commands. Assert no stale controller writes afterward. |
| AC-05 | Original POI focus and bus/drone follow resolve stable IDs. Missing targets produce a visible explanation. A followed actor survives a quality reduction or ends explicitly, never silently switches identity. | Manifest validation and simulated target removal/quality changes; keyboard and pointer selection parity. |
| AC-06 | User pause freezes actors, signals, autonomous camera, event timers, weather progress, accelerated clock, and audio; manual view/settings and reduced-motion guided views remain useful. New follow/continuous tour is explained as unavailable while paused. Resume has no catch-up jump. | Inject clock: after 30 seconds paused, simulation tick/progress are unchanged; first resumed movement is no more than normal fixed-step travel. Test manual interruption and guided views while paused. |
| AC-07 | Hidden/pagehide suspends frame/audio work, preserves user pause, and resets elapsed timing. Blur alone does not stop a visible second-screen world. | Test a five-minute hidden interval, return, and compare state to the next expected tick. Confirm no hidden RAF chain or burst of queued events. Clear held keys on blur. |
| AC-08 | Route loops are continuous, speeds/dwell times are bounded, and conflicting road/crossing actors do not simultaneously occupy authored exclusive conflict zones. Populations/events are capped. | Seeded multi-minute simulation tests, boundary/loop/stop tests, and visual traffic review. No teleport-through-conflict workaround. |
| AC-09 | Reduced motion starts the world paused, stops cinematic camera effects, replaces automatic tours with stepwise views, and retains all feature access. Explicit conservative motion/follow is possible. | Emulate media query, change it while running, test local override, and check no hidden autoplay/overshoot/rapid rain. |
| AC-10 | Sunny/Cloudy/Rain/Mist and all four time modes work. Natural weather is opt-in; manual weather disables it. Local-clock lighting resumes with a 10-second blend instead of changing actors' elapsed time. | Inject date/clock/weather and compare fixtures for presets, transition boundaries, pause, resume, and hidden-page return. |
| AC-11 | Audio is initially silent on every load, including returning users. Only explicit enable makes sound. Pause/hidden fades/suspends it; blocked resume/failure is visible. | Spy on audio creation/resume/gain and confirm in a real browser. Check mute/volume persistence never bypasses a fresh gesture and teardown leaves no active nodes/schedulers. |
| AC-12 | Fullscreen UI reflects actual API state, handles rejection, and offers honestly labeled expanded view when unsupported. Escape performs one layer's action at a time. | Test request rejection and `fullscreenchange`; manually exercise browser Escape/native controls on supported devices. |
| AC-13 | Non-sensitive preferences survive reload; invalid/unknown-version data and blocked storage produce a visible nonblocking notice and safe in-memory operation. No identity/event history is stored. | Unit schema/migration tests and browser localStorage denial/corruption cases; inspect stored keys and payload. |
| AC-14 | Help/settings have correct focus entry, containment where modal, and return. All features are reachable via a complete keyboard route, with no global single-character shortcuts while typing. | Keyboard-only walkthrough, RTL focus tests, and screen-reader check. Live regions announce meaningful transitions, not every frame or clock tick. |
| AC-15 | Quality modes respect bounded DPR/caps, do not change simulation speed, and retain core interaction and target validity. Automatic uses hysteresis and no network telemetry. | Inject frame samples, assert no tier flapping or unbounded DPR; profile High/Auto/Lightweight and compare actor travel over equal simulation time. |
| AC-16 | Initial district geometry aims for 3-5 MB compressed; loading state/still is honest and useful. | Record encoded/transferred/decoded sizes separately, cold and warm loads, compression/decoder overhead, and asset version. No fabricated loading percentages. |
| AC-17 | Retry, late-load cancellation, unmount, and context restore never create duplicate worlds. All GPU/audio/listener/timer resources are released by disposal. | Ten mount/unmount and failure/retry cycles; inspect resource counts after settling. Trigger WebGL context loss/restoration where supported and verify explicit fallback on failure. |
| AC-18 | Long sessions do not accumulate actors, histories, timers, resources, or stale frame work. | Two-hour visible/hidden/pause stress session with periodic quality/weather/follow changes and resource snapshots. Investigate monotonic growth. |
| AC-19 | Unsupported WebGL/load error/context failure shows an original static fallback, explanation, help, and noncommercial landmark focus navigation; no directory. Unavailable controls explain why. | Disable WebGL, fail assets, lose context, retry, and use keyboard/screen reader at mobile width. Verify original assets, no copied source poster. |
| AC-20 | Same seed, simulation tick, weather, time, quality, viewport, and asset version reproduce the same composed scene within agreed raster tolerance. | Deterministic screenshots and state assertions; no wall-clock/random drift in fixtures. |

## Viewports and accessibility targets

Minimum automated width set: **320, 375, 414, 768, and 1440 CSS px**. Include **390 px** as an extra hit-target regression case derived from the reference observation. Test mobile portrait at height 844, the source-like 390 x 664 short viewport, tablet landscape, and desktop 1440 x 900 and 1440 x 1000. Also test a short landscape phone, such as 844 x 390.

No page-level horizontal overflow; panels fit within the visual viewport and scroll internally as needed. At narrow widths, core pause and navigation entry points remain visible. Safe-area insets, onscreen keyboards, orientation changes, and enlarged text must not conceal close/stop actions. Panel content can scroll; scene navigation must not intercept it.

Proposed touch targets are at least **44 x 44 CSS px** with adequate separation. Target WCAG AA text contrast (4.5:1 normal text, 3:1 large text) and 3:1 for meaningful controls/focus indicators. State cannot depend on color alone. Check text zoom to 200% and reflow at an effective 320 px width. Use semantic controls and readable accessible names, not unlabeled icon canvases.

Keyboard walkthrough must include initial guide, pan/zoom/rotate/reset, Previous/Next landmark, bus/drone follow and Stop, tour/guided views, pause, time/weather, audio, quality, help, fullscreen/expanded view, and fallback. No essential feature may be mouse-only. This walkthrough is not a directory requirement.

Emulated Chromium is necessary but insufficient: physically test an agreed midrange phone, including iOS Safari and Android Chrome coverage where available. Record browser/OS/device versions. Screen-reader checks should include the supported platform combination, not only an automated accessibility scan.

## Performance budgets

These proposals need calibration on named devices. Measure a production build with a fixed scene seed and asset version; record quality, DPR, resolution, power mode, browser, ambient temperature where relevant, and test duration. Do not compare headless Chromium resource observations to physical-device frame rates.

| Metric | Proposed target | Method |
| --- | --- | --- |
| Reference laptop | Approximately 60 FPS: median at least 55 FPS and p95 frame interval no more than 20 ms at agreed desktop settings. | Warm for 60 s, then sample at least 60 s each for overview, follow, tour, and rain. Also inspect missed frames and CPU/GPU work. |
| Agreed midrange mobile | Approximately 30 FPS: median at least 28 FPS and p95 frame interval no more than 40 ms in Automatic/Lightweight. | Same scenarios on a physical phone; repeat after ten minutes for thermal degradation. |
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

Record results when tests exist. For this handoff, only documentation integrity checks can be completed.
