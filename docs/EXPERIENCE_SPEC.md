# Experience specification

**This document is the LivingCity behavior contract**, not recovered source algorithms. The current checkpoint implements core navigation/orbit, city-wide tours/guided views, pause, reduced motion, help/settings, fullscreen/expanded view, visibility, and an honest loading/error still. Camera-follow features and the drone were explicitly removed by the user on 2026-09-12. Environment controls, ambient audio, and the occasional airplane are integrated into the live runtime, alongside the expanded NYC-inspired neighborhood. The earlier user-facing "static view" opt-out was removed, though the original still remains as a loading and WebGL-failure backdrop without landmark navigation. Physical-device accessibility/performance, long-session sign-off, adaptive quality, and the broader UI redesign remain outside this completed slice. [Product scope](PRODUCT_BRIEF.md) takes precedence; the [reference analysis](REFERENCE_ANALYSIS.md) records what was actually observed.

Afternoon/Sunny and sound-off are first-visit defaults, with live weather/time and optional sound controls. Versioned preferences are persisted locally with visible storage-error notices; saved audio consent never enables sound. Help remains modal; Settings is a compact non-modal dock. Both interrupt existing camera automation on opening without restarting it on close. The city-wide tour includes Juniper Court and Crosstown Steps. On 2026-09-13 the user removed landmark selection, its bar, map-click targets, bracket shortcuts, highlights, descriptions and contextual tours. The original descriptive companion illustration remains the fallback, without selection markers or a catalog. This reconciles the connected-city and incoming-main behavior contracts; final merged validation is recorded separately in [acceptance criteria](ACCEPTANCE_CRITERIA.md).

**Platform scope:** the latest user direction prioritizes desktop/laptop computers and excludes mobile edge-case work. Mouse/trackpad and keyboard are the supported verification priority. Touch and mobile-sheet guidance below is retained as future reference, not a current implementation gate.

## Initial experience and UI

Show an original lightweight still with a readable loading state while the renderer and assets load. Make progress indeterminate unless actual totals are known. Preserve visible retry/fallback controls if loading fails. Do not pretend a static poster is a live scene.

First-visit defaults: overview camera, fixed Afternoon, Sunny, natural weather off, Automatic quality, sound muted. World motion starts normally unless reduced motion is requested; in that case start paused. A compact dismissible guide explains pan, zoom, rotate, and pause. It must not cover the majority of the mobile scene or resemble a marketing hero.

Keep pause, camera navigation, and an entry to settings/help discoverable. Settings has its own lower-left button inside the city, removed from the bottom-right Pause/Tour/Fullscreen row. Its compact, internally scrolling dock opens above that button in the former "Around the square" position, without a dimming backdrop. The bottom control strip contains Pause/Tour/Fullscreen and, while guided views are active, Previous/Next view controls. There is no landmark-navigation section. The world remains the dominant surface. No directory, advertising panel, commercial CTA, or engagement/presence counter.

The scene-title card (district label, city name and tagline) is removed at the user's request. Retain a screen-reader-only level-one heading and the named navigation region, without covering the map. The application header, environment badge and manual camera controls remain.

The header wordmark and browser title use **CitiVibe**, matching the repository identity; Rainlight Square remains the fictional place name. The separate Field guide header helper is removed. Keyboard shortcuts remain discoverable in Settings, and `?` opens control help from the focused navigation region with focus restored there on close.

## State boundaries

Maintain independent state for:

| State | Values or contents |
| --- | --- |
| Renderer lifecycle | Loading, ready, load error, unsupported WebGL, context lost, restoring, disposed. The original still backs the loading and error states; there is no user-selectable static mode. |
| Camera mode | `overview`, `free`, `guided`, and `tour`. No landmark selection state. |
| World run state | User pause preference plus temporary suspension reasons such as hidden page/context loss. |
| Environment | Weather preset/natural mode, time mode, simulated cycle phase. |
| Preferences | Quality, motion preference, sound volume/mute choice, guide visibility, weather/time choices. |
| UI | Open panel and focus-return target. |

Effective simulation running requires a ready renderer, a visible page, and no user pause. Camera automation additionally requires no open modal. UI actions can still request a single render while the world is paused. Never infer camera ownership from whichever component last wrote a transform.

## Camera modes and transitions

Use one camera controller with bounded pan, zoom, height/tilt, and near/far distances. The implementation uses an orthographic projection. The expanded ground and camera targets span +/-110 m on X and +/-170 m on Z, with an overview sized to show the six-by-six district. Orbit covers all azimuths, with elevation bounded to 30-75 degrees at a fixed 340 m distance from the ground pivot. An 850 m far plane covers the map even when panning to its edges. World bounds and target anchors determine limits; no camera clipping through buildings or flying indefinitely off the district.

Tour anchors use zoom 3.5-5.2 with a maximum of 10, leaving useful zoom-in headroom. Names belong to tour viewpoints, not selectable place IDs. Manual navigation updates intent immediately and coalesces repeated input into one requested render; it never starts a paused simulation loop.

| Mode | Meaning | Entry | Exit |
| --- | --- | --- | --- |
| `overview` | Stationary framing of the original district. | Initial ready state or Reset. | Manual input or tour. |
| `free` | Viewer-controlled pose, stationary without input. | Manual navigation or Stop automatic view. | Tour or Reset. |
| `guided` | A static city-wide tour composition without automatic travel. | Guided views under reduced motion. | Manual navigation, Stop, Reset or another explicit view step. |
| `tour` | City-wide sequence of composed views; only this controller drives it. | Explicit Start tour while running. | Manual navigation, Stop or Reset. |

**Arbitration:** commands are serialized; a new user camera command cancels the previous transition before taking ownership. Pan, wheel/pinch zoom, rotate, and their button/keyboard equivalents immediately cancel reset transitions/tours or guided views, enter `free`, and start from the current rendered pose. Do not restart automation when input ends or when a panel closes.

Clicking scenery only focuses the keyboard-navigation region; it does not select a place or move the camera. Moving actors do not expose selection or camera-follow actions. Repeated commands must not create stacked tweens.

Reset cancels all transitions and returns to the overview composition without changing weather, time, audio, quality, or world pause. Stop retains the current pose and switches to `free`. There is no selection status or Clear selection action.

### City-wide tours

The ordered camera manifest supplies validated IDs, subject labels and bounded poses for the city-wide tour. No landmark registry, semantic click volumes, selection raycaster or highlight resources are retained.

Reset transitions take 750 ms with gentle ease-out while running. While paused or reduced-motion is active, reset moves to the overview immediately. Guided-view steps are always immediate.

Global tour mixes overview/high angles, restrained street-level glides within safe anchors, and brief original-landmark holds. Suggested segments are 12-20 seconds, with 4-8 second holds; timing and choices are seeded for reproducibility. Skip unavailable segments with a bounded fallback to a known valid static anchor; stop with a visible message if no segment is valid.

The current global route includes overview, pavilion, crosstown, terrace, garden and court. Longer neighborhood travel extends the segment rather than accelerating the camera; travel time is at least ground distance / 3.6, followed by a five-second hold.

### Park and street activity

**Weather-aware people (2026-09-16):** street/park walkers and runners adapt to actual precipitation and cold with stable individual rainwear/umbrella preferences and winter layers. Reactions are staggered. Rain may modestly increase desired walking pace, but snow cover and existing queues take priority; cautious runners use walking poses. Rain at 0 mm/h does not trigger umbrellas. Cold weather can retain a coat after sunshine, and brief preset toggles do not continuously open and close equipment.

The eight existing seated picnic neighbors visibly stand before walking out through the east gate. They remain visible on the park's surrounding sidewalks and return through the south gate to their original seats only after sustained sunny, warm-enough, dry-enough conditions. Returning travelers recheck conditions before sitting; renewed precipitation prevents a new sit or reverses the current sit transition. Travel may take several simulated minutes, never a teleport. No indoor destination or new person is introduced. These eight join the retained actor simulation, raising its collection from 354 to 362 rigs while total population stays 328. The [weather research and authored policy](PEOPLE_WEATHER_RESEARCH.md) supersede the older description of permanently static picnic figures below.

Weather-reaction, stand/sit, outside-walk and return timers freeze under pause and page suspension. Explicit paused weather choices update the static outfit without moving the person or progressing a stand/sit transition. Reduced motion suppresses decorative weather gestures and uses an immediate posture transition when a resumed visitor changes between standing and sitting; the default still starts paused.

The center is car-free: no internal asphalt circuit, vehicle stop, bus/car loop, or crossing signals. Forty-eight walkers follow two continuous circuits through open north/east/south/west gates onto adjacent city sidewalks. Sightseeing visitors pause briefly; shared-route headway and geometric spacing prevent overlap and permanent queues. The gate connections remain step-free and free of trees, fence segments and construction props.

Twenty-four runners use the dedicated reservoir circuit at roughly 2.4-2.65 m/s. Walking desired paces depend on purpose: 1.22-1.56 m/s for commuters, 0.86-1.10 for tourists, and 0.94-1.29 for other walkers; headway can slow any of them. These are authored ranges, not occupation/age measurements. Running has bent arms, shorts, exposed lower legs, socks, trainers, a longer stride and a short interval with both feet airborne. Stature scales both the skeleton and traveled-distance gait input so shorter people take shorter steps without foot sliding. Reduced motion uses conservative stepping instead of running bounce/flight. Pause and hidden-tab suspension freeze runner travel and gait just like other actors. Four original runner pictograms mark this track; they are not the running behavior itself. The pale lake bridge is scenery, not an implemented bridge-crossing route.

All motor vehicles and cyclists remain on the surrounding six-by-six grid: 36 junctions, 24 blocks and 94 buildings around a 78 x 176 m park in the 220 x 340 m map. Its 48 moving motor vehicles, twelve cyclists and 168 neighborhood walkers share the same pause/visibility clock as park visitors. Twenty-eight junctions are signalized and use north-south, east-west, pedestrian and all-red clearance phases; occupied reservations survive phase changes. The other eight quiet corners, chosen once from a fixed seed away from the park-fronting avenues and cross streets, are posted all-way stops with no signal hardware. Every driver there must come to a complete halt at the painted bar and dwell 0.8 s before the junction is granted, and waiting drivers are served in arrival order regardless of axis. Walkers at a posted corner cross when the box is free and no driver is being served; any crossing in progress gives the next turn back to a waiting driver, so neither mode starves. Bumpers stop behind the shared 8.5 m painted bars, while the separate 7 m turn boundary keeps bicycle turns inside the road. Wet/snowy traction changes must preserve stopping, full-body clearance and the park/counterflow exclusions. Street buses have no scheduled dwell stops. These are explicit miniature simplifications, not NYC traffic-standard compliance.

Neighborhood walkers travel in both directions on each block's sidewalks, select seeded destinations one to three block hops away and use 144 directed links across the painted crosswalks. The two lane centers are 6.2 and 7.2 m from road centers, with full body clearance and locally widened building-side paving. At signalized corners walkers enter only during the pedestrian phase after both road traffic and the landing corridor have cleared; at posted all-way stops they enter only on the published walk flag, which requires an empty junction box and no driver being served. One walker reserves the intersection through its crossing and two metres of landing travel; the all-red phase holds until this completes. A blocked attempt lasts at most twelve seconds before the person walks on and replans, never forcing right of way. Destination capacity includes incoming reservations and is capped at eight people per block. Trip paces vary within 90-100% of profile pace. Arrival brings a 1.5-6 second standing rest or gentle looking-around pause at a varied mid-sidewalk position. Reduced motion suppresses the gesture. Pause, hidden time and recovery retain direction and the complete trip state; continuous traveled distance keeps gait phase intact when changing blocks. Park/court/family activities retain their existing routes.

Juniper Court contains full-size 28.6512 x 15.24 m basketball and 13.4112 x 6.096 m pickleball playing surfaces in the wide parcel south of the park. Clear runoff areas and a continuous 2 m passage surround six unchanged human-sized skeletons with varied sportswear and two balls. Basketball players dribble into drives, pass, shoot, pursue rebounds and reposition over a 24-second practice cycle. Pickleball players move to meet a 5.6-second rally cycle with net crossings, receiving-side bounces and moving paddle contacts. Readable grounded footwork is required, not fixed standing rigs with only arm animation or sliding poses. These are non-interactive ambient scenes, not competitive sports simulations or facility-code certification. Pause, hidden pages and context loss freeze their retained clock; restoration reconstructs the same pose. Reduced motion holds the entire court scene still. Snow raises player supports and ground bounces without raising fixed rim/net targets. Help and the illustration's accessible description provide a nonvisual account without announcing each play.

The fixed human total is 277, including eight resting picnic neighbors and three bike-station users. There are 48 moving motor vehicles, twelve parked cars, four sidewalk food carts, thirty station bicycles and two sports balls. Six children play in three separated small meadow circuits near two stationary adult guardians, away from gates, walking channels, water and courts. Their absolute-time activity follows the retained simulation clock and becomes a fixed still under reduced motion. People have thirteen fictional work roles, five age bands, varied statures/builds/skin/hair and actual accessory geometry. Age affects stature, not a blanket assumption about fitness; occupations never choose skin tone or body type. Work roles are visual context, not actual emergency responses, services, schedules or selectable identities.

Three unbranded stations each own ten classic/electric bicycles with eleven parallel docks. One occupies the apron beside Juniper Court and two occupy inter-building pockets. The existing station riders walk through access spurs, ride controlled road circuits and return to their own dock; nine bikes stay docked while one is away. Juniper reserves its shared roadway/sidewalk access only after existing bodies clear, holds approaching traffic/walkers outside and releases after the rider clears. This replaces its indefinite departure wait, not the ordinary traffic signals. Hands follow actual saddle/release targets; bike kind, cumulative travel, inventory and crossing state survive pause and restoration. Reduced motion holds a docked still. Electric riders pedal, use larger existing lamp sockets, and retain the same safety/speed limits. No rental UI or station-to-station destination system is added. See [people and activity](PEOPLE_AND_ACTIVITY.md).

Parked cars occupy only the spare non-cycling curbs of the park-border streets. Twelve white bay outlines and original P markings/signs distinguish parking from live lanes. Four compact, cabless food carts instead sit in sidewalk corner pockets with counters, small wheels, food displays and striped canopies, clear of through-walking routes. These signs do not assert real parking permissions, fees or operating restrictions.

The park-adjacent north and south cross streets each carry one 2.1 m-wide protected two-way cycle track on the park side. Opposing lane centers are 1 m apart on the same green surface, with paired direction arrows and a dashed yellow divider. A low separator distinguishes the track from motor traffic. Cyclists follow the actual counterflow geometry through controlled turns, not merely opposite-facing decorative paint. The other streets retain their one-way lanes.

Tour always follows the same city-wide route. Tour status identifies the current subject and always exposes Stop. With reduced motion, replace automatic travel/advance with **stepwise guided views** and explicit Previous/Next actions. Guided views use `guided` mode without an active tour clock and remain usable while paused.

Starting new automation or resuming camera intent canceled by modal interaction requires an explicit action. Temporary user pause, hidden-page suspension, and context loss follow the preservation/resume rules below; they do not require starting a new tour.

### Modal and dock input interruption

Opening Help suspends camera automation and disables scene input while its native dialog is modal; world actors continue unless separately paused. Closing Help leaves the camera stationary in `free` mode. Opening Settings stops the current camera automation once, but does not hold the world in a modal state. Pointer, keyboard, camera buttons, and Pause remain available outside the dock. Closing Settings does not restart automation or cancel a subsequent explicit city action.

The Settings trigger reports expansion and its controlled panel. Opening focuses Close settings. Tab is not trapped; Escape from within the dock closes it and returns focus to the trigger. Escape while navigating the city follows the city's ordinary tour/fullscreen contract, not an unrelated dock-close shortcut. Scrolling or editing within the dock must not reach scene navigation. Help keeps modal containment and focus return.

Selecting a new mode or using manual navigation discards that resumable camera intent. User pause, page hiding, and context loss instead retain valid camera intent for the resume rules below. A modal-open event must not overwrite an existing user pause.

## Proposed pause and time contract

**Pause freezes autonomous world progression, not the interface.**

| System | While user-paused | On resume |
| --- | --- | --- |
| Actors, route phases, traffic signals, event scheduler | Freeze positions, dwell counters, phases, and event timers. | Continue from the same simulation tick; no catch-up. |
| Weather effects and natural transitions | Freeze particles, cloud drift, and transition progress. | Continue; no skipped storms or bursts. |
| Accelerated day/night cycle | Freeze phase and lighting changes. | Continue from the stored phase. |
| Local-clock scene lighting | Hold the displayed lighting. Actual clock text may still show device time. | Blend toward current device-time lighting over 10 seconds. |
| Autonomous camera motion and decorative animation | Freeze pose/progress, including in-flight reset transitions and tours; clear manual inertia. | Continue preserved valid mode/transition, unless a new camera command or modal dismissal canceled it. |
| Sound | Fade output to silence over approximately 150 ms, retaining current-session consent and volume. | Fade back only if the viewer had enabled sound this session and browser policy allows it. |
| UI and manual camera controls | Remain usable. Direct navigation, guided views and reset may render a new static view. | No queued navigation replays. |
| Explicit weather/time changes | Apply the selected static appearance once; particles remain stationary/off. | Progress under the newly selected mode. |

Starting a continuous tour is unavailable while paused, with a visible explanation to resume the city first. An existing tour can remain suspended. Stop, Reset, manual navigation, settings, and reduced-motion guided views still work. The main pause control uses a meaningful label/state such as "Pause city" / "Resume city"; do not communicate pause through an icon alone.

For device-clock lighting, compute local time from the browser; do not request location. A fresh page in Local clock mode can initialize directly to the current local phase. Resuming from pause/visibility uses the 10-second blend above. Do not apply elapsed wall time to actor positions.

### Visibility, focus, and recovery

On `visibilitychange` to hidden or `pagehide`, suspend simulation, animation frames, and audio; discard the frame accumulator and record existing user pause/mode without changing them. On return, rebase timing before the next tick. If the user had paused, remain paused. Otherwise resume the valid prior world state; local-clock lighting is the only wall-time resynchronization exception.

An actual page exit outside the back-forward cache also disposes the renderer. A persisted bfcache page retains its suspended world and resumes through `pageshow`.

Losing window focus alone clears pressed keys and pointer gestures, but a **visible second-screen city may keep running**. Do not conflate blur with a hidden document. Release pointer capture on cancellation, blur, and lifecycle changes.

Context loss uses the same suspension rules. Restoration must rebuild GPU resources and rebind valid IDs before resuming, without duplicate loops. If automatic restoration fails, show Retry and Static view; do not spin in an endless retry cycle.

## Environment, sound, and quality

| Control | Proposed behavior |
| --- | --- |
| Weather | Sunny, Cloudy, Rain, Mist, Snow, Windy. User selection is explicit and disables natural changes, including the saved preference. Transitions are subdued, with immediate static changes under reduced motion or pause. Never show simulated temperature as live local weather. |
| Rain intensity | 0-30 mm/h, default 8, stored locally. Visible for Rain or natural weather. Changes water input, bounded visible rain density/opacity, impacts, ground-pool filling, and consent-gated rain sound. Zero stops falling rain without deleting stored snow/water or changing the selected cloud/time setting. |
| Natural weather | Off initially. Seeded changes every 3-6 simulated minutes, reaching about 99% of the new conditions in thirty simulation seconds through the retained continuous blend. Manual preset selection turns natural changes off; the viewer can re-enable them. |
| Time | Afternoon, Night, Local clock, Day/night cycle. Public street and park lamps and varied lit windows fade up as the phase darkens and go dark by day, tracking the same night value as the sky. Proposed accelerated cycle: 12 simulated minutes for 24 hours, with continuous light interpolation. |
| Sound | Initially muted on every page load, even if a volume/mute preference was saved. Require a fresh intentional enable action to create/resume audible audio. Give a master volume and mute control; sound is never essential feedback. |
| Audio failure | Surface "Sound unavailable" with an explicit retry. Suspended browser audio after returning stays silent until a user action if resume is blocked. No fake enabled state. |
| Quality | Automatic, High, Lightweight. High is not unbounded native DPR. Automatic reports its effective tier and adjusts gradually based on local measurements, with hysteresis. Lightweight reduces effects/density, not essential controls. |
| Fullscreen | Use the standard API where available and permitted. Reflect actual `fullscreenchange`, handle rejection visibly, and offer a clearly labeled in-page expanded view if unsupported. Never claim browser fullscreen succeeded when it did not. |

Audio should be low-level ambience, not a notification channel. Use original synthesis or licensed recordings. Stop scheduling hidden/paused audio; dispose nodes on teardown. Quality measurement is local and ephemeral, not transmitted analytics.

### Night and vehicle lighting

Public fixtures, taxi roof signs and subway globes follow the environment's continuous night value. Soft, depth-tested ground illumination follows near-ground elevation and snow retention. All 48 moving motor vehicles have paired forward lamps, red tail/brake lamps, separate amber front/rear indicators and side repeaters; all twelve road bicycles have smaller front/rear lights. Parked vehicles and station bicycles do not add driving-light slots. Vehicle glazing stays non-emissive.

Juniper Court uses four basketball and two pickleball light poles, 6.4 m high with shielded twin heads aimed into the courts. Their broad, overlapping ground illumination remains visible in Lightweight; focused views share the existing public-spotlight budget. Bases stay outside the complete runoffs and continuous 2 m passage. Court dimensions, players, access and daytime activity are unchanged; these are ambient recreation lights, not certified sports-facility photometry.

Night and poor visibility activate driving lights, including daylight rain, snow and mist. Braking is independent of headlight demand: rear red lamps brighten on traffic-solver deceleration and held stops. Indicators anticipate the next actual turn within 12 miniature metres, persist through queues/turns and cancel on exit; straight junctions do not signal a future turn. They flash at 75/minute with independent deterministic vehicle phases. Reduced motion uses a steady requested side. Pause, hidden pages and graphics recovery hold the same lamp state and mounted pose.

Six public and two vehicle spotlights add local material illumination in focused views; Lightweight retains all visible lamp/beam cues without these detailed contributions. The existing intersection schedule remains green/all-red/pedestrian, not a newly certified yellow-phase model. See [research, approximations and exclusions](LIGHTING_RESEARCH.md).

### Weather physics extension

Rain falls at diameter-dependent terminal speeds; snow settles more slowly with small flutter. Both respond to the same coherent synthetic wind that moves clouds and bends the shared tree/reed batches. Precipitation covers the enlarged rectangular map with fixed particle capacities. A static half-meter top-envelope of the original geometry stops precipitation at ground/canopy/roof height, rather than drawing it through roofs. Rain impacts and reservoir ripples aligned to the actual water surface are bounded cosmetic effects.

Exposed roofs, streets, ground, park lawns/paths and tree canopies gradually gain actual snow-shell depth as well as coverage. Snow shells follow canopy movement and have matching displaced shadows; roads carry a thinner layer. Retained weather revisions refresh cached shadows for canopy sway and changing depth. Depth derives from SWE with a declared fresh-snow density, 2x visual exaggeration, and a 0.45 m maximum. Route actors stay on nearby ground snow rather than being buried or lifted onto a canopy.

Water-equivalent bookkeeping tracks accumulation, positive-temperature melt, surface water, drainage, evaporation, and overflow. Three original shallow ground depressions collect direct precipitation/melt and runoff from bounded contributing areas. Water rises from the bed and spreads as the volume increases; these are not surface decals. Wet surfaces darken and become less rough. Selecting Sunny does not instantly erase snow, empty the pools or dry the streets. Surface processes use an explicitly artistic 60x physical-time scale; particle motion and traffic retain the normal simulation clock. Internal temperature and humidity are preset parameters, not a weather measurement.

Vehicles reduce their speed and acceleration/braking budget as retained wetness/snow lowers grip, keeping the existing signal, clearance, stop and spacing rules. Walkers are not forced to slide or fall, and there are no crashes, road closures, flooding or destructive weather. Windy is a stronger breeze, not a severe-storm simulation.

Pause/hidden/context loss freeze every weather timer, particle, impact, and reservoir. Explicit preset changes while paused alter atmospheric appearance once but do not advance accumulation or melt. Reduced motion keeps stationary precipitation cues and disables foliage sway, cloud travel, splashes and ripples, including if conservative actor movement is resumed. CPU weather state survives renderer restoration/retry; only preferences survive page reloads. A once-per-simulated-second status publication updates natural-weather/time labels and audio without per-frame React state.

While running, manual weather changes ease through roughly eight simulation seconds to reach 99% of the new conditions; natural changes take roughly thirty. Sky, fog, clouds, light, precipitation and wind share the same continuous blend. Selecting another preset preserves the current mix and its rate of change rather than restarting an easing curve. Pausing holds that progress; explicit paused/reduced-motion selections still apply immediately. Saved startup weather has no entrance animation, and existing snow/water is never cleared by a transition.

See [weather physics research](WEATHER_PHYSICS_RESEARCH.md) for equations, source evidence, tunings, and approximations.

## Pointer, touch, keyboard, and focus

On the scene, one-finger drag pans, pinch zooms, and a deliberate two-finger sideways gesture rotates. Mouse primary drag pans. Command-primary-drag on Mac, Control-primary-drag, and secondary drag orbit: horizontal movement rotates and vertical movement changes tilt. The modifier is captured when dragging begins, so releasing it mid-drag does not switch modes. Wheel zooms, and Shift-wheel rotates. Ground-plane pan scaling follows the current camera tilt and zoom instead of using a fixed vertical multiplier. Lock the gesture after an intent threshold; do not alternate between pinch and rotation mid-gesture. Safari-specific twist is not required; explicit rotate/tilt buttons are the reliable fallback.

Apply restrictive touch handling only to the interactive scene, not to the entire document or panels. Scrolling a settings sheet must not zoom the world. UI hits never reach scene camera controls; there is no selection raycasting. Honor pointer cancellation, pinch/browser conflicts, and safe areas.

Proposed shortcuts apply **only while the scene navigation region has focus**, never while editing a field or operating a panel:

| Key | Action |
| --- | --- |
| Arrow keys | Pan. |
| `+` / `-` | Zoom in/out. |
| `Q` / `E` | Rotate left/right. |
| `W` / `S` | Tilt toward overhead/street level. |
| `R` | Reset overview. |
| `T` | Start/stop tour; guided views under reduced motion. |
| Space | Pause/resume world. |
| `M` | Mute or explicitly enable sound. |
| `F` | Request fullscreen/leave fullscreen. |
| `?` | Open shortcut help. |

Every shortcut has a visible, keyboard-operable control equivalent. Tab moves through semantic controls; the canvas navigation region is a named focus stop, not hundreds of individual actors in the tab order. Previous/Next view controls appear only during reduced-motion guided tours, announce their subject, and wrap through the six viewpoints. The former bracket shortcuts are not handled.

Escape resolves one applicable layer: close an open modal (or Settings when focus is inside that dock) and return focus to its trigger; otherwise allow the browser to exit fullscreen without also stopping a tour; otherwise Stop an active tour or guided views. With no applicable layer, leave the camera unchanged. Do not steal Escape from native controls. Use actual fullscreen events to prevent a single Escape from firing multiple actions.

Dialogs/sheets have an accessible name, bounded scrollable content, initial focus, focus containment where modal, and focus return. Hidden panels are not tabbable. Important status changes use a restrained polite live region; do not announce per-frame positions, every actor, or a ticking clock.

## Reduced motion and non-WebGL fallback

Honor `prefers-reduced-motion` by default, with an explicit local preference override. Entering reduced mode pauses the world, cancels inertia and automatic camera motion, and exposes a clear Resume action. The viewer may opt into conservative actor movement; disable decorative bobbing, camera lag/overshoot, fast particles, and automatic tour travel. Explicit reset and guided-view changes are immediate.

The fallback is an **original static city illustration or poster**, a concise accessible scene description, readable status, retry and controls/help that remain meaningful. It has no selectable landmarks, navigation bar or focus markers. A no-JavaScript state provides the original still and plain explanatory text.

| Failure | Required presentation |
| --- | --- |
| Asset/network failure | Clear reason where known; offer Retry. The original still remains as a backdrop; no endless spinner. |
| Unsupported/disabled WebGL | Explain reduced rendering capability; show the original descriptive still immediately. |
| Context lost | Suspend and show "Restoring city"; retain preferences, pause and camera pose. Offer retry/fallback if restoration cannot finish. |
| Fallback active | Label it Static view. Disable unavailable camera navigation/tours with explanations, not silent no-ops. Keep the static scene description and help available; do not present the illustration as a live rendering. |
| Return to live view | Revalidate assets and context on explicit Retry; start only one renderer/loop. Preserve user pause and current-session sound consent. |

Implementation and verification boundaries are in [architecture](TECHNICAL_ARCHITECTURE.md) and [acceptance criteria](ACCEPTANCE_CRITERIA.md).
