# Experience specification

**This document is the LivingCity behavior contract**, not recovered source algorithms. The current checkpoint implements core navigation/orbit, focus, tours/guided views, pause, reduced motion, help/settings, fullscreen/expanded view, visibility, and an honest loading/error still. Camera-follow features and the drone were explicitly removed by the user on 2026-09-12. The environment (weather/time/quality), ambient audio, and occasional airplane modules are now integrated into the live runtime, and the world was enlarged around the tuned core. The app is always full-live: the earlier user-facing "static view" opt-out was removed, though the original still remains as a loading and WebGL-failure backdrop with landmark navigation. Remaining unfinished work: complete M4 tours/preferences, the NYC-inspired visual pass, and final M6/M7 accessibility and performance sign-off. [Product scope](PRODUCT_BRIEF.md) takes precedence; the [reference analysis](REFERENCE_ANALYSIS.md) records what was actually observed.

For the current live slice, Afternoon/Sunny and sound-off are explicit fixed status, not nonfunctional controls. Versioned motion and guide preferences are persisted locally with visible storage-error notices; saved audio consent never enables sound. Native modal help/settings interrupt camera movement without restarting it on close. The fallback uses original landmark markers and concise descriptions, not a catalog.

**Platform scope:** the latest user direction prioritizes desktop/laptop computers and excludes mobile edge-case work. Mouse/trackpad and keyboard are the supported verification priority. Touch and mobile-sheet guidance below is retained as future reference, not a current implementation gate.

## Initial experience and UI

Show an original lightweight still with a readable loading state while the renderer and assets load. Make progress indeterminate unless actual totals are known. Preserve visible retry/fallback controls if loading fails. Do not pretend a static poster is a live scene.

First-visit defaults: overview camera, fixed Afternoon, Sunny, natural weather off, Automatic quality, sound muted. World motion starts normally unless reduced motion is requested; in that case start paused. A compact dismissible guide explains pan, zoom, rotate, focus, and pause. It must not cover the majority of the mobile scene or resemble a marketing hero.

Keep pause, camera navigation, and an entry to settings/help discoverable. Less frequent controls may live in a popover or mobile sheet. The world remains the dominant surface. No directory, advertising panel, commercial CTA, or engagement/presence counter.

## State boundaries

Maintain independent state for:

| State | Values or contents |
| --- | --- |
| Renderer lifecycle | Loading, ready, load error, unsupported WebGL, context lost, restoring, disposed. The original still backs the loading and error states; there is no user-selectable static mode. |
| Camera mode | `overview`, `free`, `focus`, and `tour`. |
| Selection | An original POI ID or none; independent of camera motion. |
| World run state | User pause preference plus temporary suspension reasons such as hidden page/context loss. |
| Environment | Weather preset/natural mode, time mode, simulated cycle phase. |
| Preferences | Quality, motion preference, sound volume/mute choice, guide visibility, weather/time choices. |
| UI | Open panel and focus-return target. |

Effective simulation running requires a ready renderer, a visible page, and no user pause. Camera automation additionally requires no open modal. UI actions can still request a single render while the world is paused. Never infer camera ownership from whichever component last wrote a transform.

## Camera modes and transitions

Use one camera controller with bounded pan, zoom, height/tilt, and near/far distances. The implementation uses an orthographic projection. All four map edges are reachable by panning; the target stays within the original district's +/-28 m bounds. Orbit covers all azimuths, with elevation bounded to 30-75 degrees at a fixed distance from the ground pivot. World bounds and target anchors determine limits; no camera clipping through buildings or flying indefinitely off the district.

| Mode | Meaning | Entry | Exit |
| --- | --- | --- | --- |
| `overview` | Stationary framing of the original district. | Initial ready state or Reset. | Manual input, focus, or tour. |
| `free` | Viewer-controlled pose, stationary without input after optional short damping. | Manual navigation or Stop automatic view. | Focus, tour, Reset. |
| `focus` | Fixed composition around one original landmark; transition then hold. | Landmark selection or Focus action. | Manual navigation, another target, tour, Reset. |
| `tour` | Contextual sequence of composed views; only this controller drives it. | Explicit Start tour while running. | Manual navigation, Stop, new selection, Reset. |

**Arbitration:** commands are serialized; a new user camera command cancels the previous transition before taking ownership. Pan, wheel/pinch zoom, rotate, and their button/keyboard equivalents immediately cancel focus transitions/tours, enter `free`, and start from the current rendered pose. They do not clear the selection. Do not restart automation when input ends or when a panel closes.

Selecting a landmark cancels automation, sets the selection, and enters `focus`. Moving actors do not expose selection or camera-follow actions. Repeated commands must not create stacked tweens.

Reset cancels all transitions, clears selection, and returns to the overview composition without changing weather, time, audio, quality, or world pause. Stop retains the current pose and selection, switching to `free`. Closing the landmark/actor status clears selection and stops any automation that depends on it; it does not move the camera back.

### Focus and tours

Original POIs have a stable ID, name, one- or two-sentence environmental description, a focus anchor, and bounds. Raycast a dedicated semantic hit target, not every decorative window. Hover may reveal the same brief label available through keyboard focus; essential information cannot be hover-only. Selection is a subtle outline/marker plus compact status, never a directory/ad card.

Focus transitions take approximately 600-900 ms with gentle ease-out. While paused or reduced-motion is active, focus and reset move to the requested static view immediately. Do not use a long cinematic transition for routine controls.

Global tour mixes overview/high angles, restrained street-level glides within safe anchors, and brief original-landmark holds. Suggested segments are 12-20 seconds, with 4-8 second holds; timing and choices are seeded for reproducibility. Skip unavailable segments with a bounded fallback to a known valid static anchor; stop with a visible message if no segment is valid.

Starting tour with a selected landmark uses a slow bounded orbit of that landmark. Tour status identifies the current subject and always exposes Stop. With reduced motion, replace automatic travel/advance with **stepwise guided views** and explicit Previous/Next actions. Guided views use ordinary `focus` mode without an active tour clock and remain usable while paused.

Starting new automation or resuming camera intent canceled by modal interaction requires an explicit action. Temporary user pause, hidden-page suspension, and context loss follow the preservation/resume rules below; they do not require starting a new tour.

### Modal and input interruption

Opening settings/help suspends camera automation and disables scene input while the panel is modal; world actors continue unless separately paused. Closing the panel leaves the camera stationary in `free` mode. A future Resume tour action starts from the current pose and revalidates its anchor. There is no unsolicited camera movement after dismissing UI.

Selecting a new mode or using manual navigation discards that resumable camera intent. User pause, page hiding, and context loss instead retain valid camera intent for the resume rules below. A modal-open event must not overwrite an existing user pause.

## Proposed pause and time contract

**Pause freezes autonomous world progression, not the interface.**

| System | While user-paused | On resume |
| --- | --- | --- |
| Actors, route phases, traffic signals, event scheduler | Freeze positions, dwell counters, phases, and event timers. | Continue from the same simulation tick; no catch-up. |
| Weather effects and natural transitions | Freeze particles, cloud drift, and transition progress. | Continue; no skipped storms or bursts. |
| Accelerated day/night cycle | Freeze phase and lighting changes. | Continue from the stored phase. |
| Local-clock scene lighting | Hold the displayed lighting. Actual clock text may still show device time. | Blend toward current device-time lighting over 10 seconds. |
| Autonomous camera motion and decorative animation | Freeze pose/progress, including in-flight focus/reset transitions and tours; clear manual inertia. | Continue preserved valid mode/transition, unless a new camera command or modal dismissal canceled it. |
| Sound | Fade output to silence over approximately 150 ms, retaining current-session consent and volume. | Fade back only if the viewer had enabled sound this session and browser policy allows it. |
| UI and manual camera controls | Remain usable. Direct navigation, focus and reset may render a new static view. | No queued navigation replays. |
| Explicit weather/time changes | Apply the selected static appearance once; particles remain stationary/off. | Progress under the newly selected mode. |

Starting a continuous tour is unavailable while paused, with a visible explanation to resume the city first. An existing tour can remain suspended. Stop, Reset, manual navigation, settings, landmark focus, and reduced-motion guided views still work. The main pause control uses a meaningful label/state such as "Pause city" / "Resume city"; do not communicate pause through an icon alone.

For device-clock lighting, compute local time from the browser; do not request location. A fresh page in Local clock mode can initialize directly to the current local phase. Resuming from pause/visibility uses the 10-second blend above. Do not apply elapsed wall time to actor positions.

### Visibility, focus, and recovery

On `visibilitychange` to hidden or `pagehide`, suspend simulation, animation frames, and audio; discard the frame accumulator and record existing user pause/mode without changing them. On return, rebase timing before the next tick. If the user had paused, remain paused. Otherwise resume the valid prior world state; local-clock lighting is the only wall-time resynchronization exception.

Losing window focus alone clears pressed keys and pointer gestures, but a **visible second-screen city may keep running**. Do not conflate blur with a hidden document. Release pointer capture on cancellation, blur, and lifecycle changes.

Context loss uses the same suspension rules. Restoration must rebuild GPU resources and rebind valid IDs before resuming, without duplicate loops. If automatic restoration fails, show Retry and Static view; do not spin in an endless retry cycle.

## Environment, sound, and quality

| Control | Proposed behavior |
| --- | --- |
| Weather | Sunny, Cloudy, Rain, Mist. User selection is explicit; transitions are subdued, with immediate static changes under reduced motion or pause. Never show a temperature as live local weather. |
| Natural weather | Off initially. Seeded changes every 3-6 simulated minutes, crossfading over about 20 simulated seconds. Manual preset selection turns natural changes off; the viewer can re-enable them. |
| Time | Afternoon, Night, Local clock, Day/night cycle. Proposed accelerated cycle: 12 simulated minutes for 24 hours, with continuous light interpolation. |
| Sound | Initially muted on every page load, even if a volume/mute preference was saved. Require a fresh intentional enable action to create/resume audible audio. Give a master volume and mute control; sound is never essential feedback. |
| Audio failure | Surface "Sound unavailable" with an explicit retry. Suspended browser audio after returning stays silent until a user action if resume is blocked. No fake enabled state. |
| Quality | Automatic, High, Lightweight. High is not unbounded native DPR. Automatic reports its effective tier and adjusts gradually based on local measurements, with hysteresis. Lightweight reduces effects/density, not essential controls. |
| Fullscreen | Use the standard API where available and permitted. Reflect actual `fullscreenchange`, handle rejection visibly, and offer a clearly labeled in-page expanded view if unsupported. Never claim browser fullscreen succeeded when it did not. |

Audio should be low-level ambience, not a notification channel. Use original synthesis or licensed recordings. Stop scheduling hidden/paused audio; dispose nodes on teardown. Quality measurement is local and ephemeral, not transmitted analytics.

## Pointer, touch, keyboard, and focus

On the scene, one-finger drag pans, pinch zooms, and a deliberate two-finger sideways gesture rotates. Mouse primary drag pans. Command-primary-drag on Mac, Control-primary-drag, and secondary drag orbit: horizontal movement rotates and vertical movement changes tilt. The modifier is captured when dragging begins, so releasing it mid-drag does not switch modes. Wheel zooms, and Shift-wheel rotates. Ground-plane pan scaling follows the current camera tilt and zoom instead of using a fixed vertical multiplier. Lock the gesture after an intent threshold; do not alternate between pinch and rotation mid-gesture. Safari-specific twist is not required; explicit rotate/tilt buttons are the reliable fallback.

Apply restrictive touch handling only to the interactive scene, not to the entire document or panels. Scrolling a settings sheet must not zoom the world. UI hits never reach scene raycasting or camera controls. Honor pointer cancellation, pinch/browser conflicts, and safe areas.

Proposed shortcuts apply **only while the scene navigation region has focus**, never while editing a field or operating a panel:

| Key | Action |
| --- | --- |
| Arrow keys | Pan. |
| `+` / `-` | Zoom in/out. |
| `Q` / `E` | Rotate left/right. |
| `W` / `S` | Tilt toward overhead/street level. |
| `R` | Reset overview. |
| `[` / `]` | Previous/next original landmark; focus its view and announce name. |
| `T` | Start/stop tour; guided views under reduced motion. |
| Space | Pause/resume world. |
| `M` | Mute or explicitly enable sound. |
| `F` | Request fullscreen/leave fullscreen. |
| `?` | Open shortcut help. |

Every shortcut has a visible, keyboard-operable control equivalent. Tab moves through semantic controls; the canvas navigation region is a named focus stop, not hundreds of individual actors in the tab order. Previous/Next landmark controls cycle a finite manifest, announce the current original landmark, and wrap predictably. This is world navigation, not a searchable catalog.

Escape resolves one applicable layer: close an open modal and return focus to its trigger; otherwise allow the browser to exit fullscreen without also clearing selection; otherwise Stop a future tour; otherwise clear selection. Do not steal Escape from native controls. Use actual fullscreen events to prevent a single Escape from firing multiple actions.

Dialogs/sheets have an accessible name, bounded scrollable content, initial focus, focus containment where modal, and focus return. Hidden panels are not tabbable. Important status changes use a restrained polite live region; do not announce per-frame positions, every actor, or a ticking clock.

## Reduced motion and non-WebGL fallback

Honor `prefers-reduced-motion` by default, with an explicit local preference override. Entering reduced mode pauses the world, cancels inertia and automatic camera motion, and exposes a clear Resume action. The viewer may opt into conservative actor movement; disable decorative bobbing, camera lag/overshoot, fast particles, and automatic tour travel. Explicit focus/reset and guided-view changes are immediate.

The fallback is an **original static city illustration or poster**, concise scene description, readable time/weather/pause status, controls/help that remain meaningful, and keyboard Previous/Next landmark focus markers on that illustration. Show a brief noncommercial landmark description for the current focus, not a list of businesses or cards. A no-JavaScript state may provide the original still and plain explanatory text.

| Failure | Required presentation |
| --- | --- |
| Asset/network failure | Clear reason where known; offer Retry. The original still remains as a backdrop; no endless spinner. |
| Unsupported/disabled WebGL | Explain reduced rendering capability; show the original still and landmark navigation immediately. |
| Context lost | Suspend and show "Restoring city"; retain preferences/selection. Offer retry/fallback if restoration cannot finish. |
| Fallback active | Label it Static view. Disable unavailable camera navigation/tours with explanations, not silent no-ops. Keep theme/time depiction and landmark focus meaningful where supported. |
| Return to live view | Revalidate assets and context on explicit Retry; start only one renderer/loop. Preserve user pause and current-session sound consent. |

Implementation and verification boundaries are in [architecture](TECHNICAL_ARCHITECTURE.md) and [acceptance criteria](ACCEPTANCE_CRITERIA.md).
