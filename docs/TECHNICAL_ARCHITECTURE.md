# Technical architecture

**Status: M1-M5 foundation with a connected NYC-inspired neighborhood.** The application uses React, strict TypeScript, Vite, direct Three.js, and npm with exact locked versions. The expanded street simulation, original neighborhood art, five-landmark navigation/tours, environment/audio, quality presets, occasional airplane, and persistent local preferences are integrated. Physical-device and long-session hardening remain, as does adaptive-quality integration/calibration. No services or backend exist; the app ships as a static Vite build (see Deployment).

## Current implementation

### Connected-city expansion

The central village/vehicle loop is removed. `src/content/streets.ts` defines the surrounding six-by-six street grid, thirty-six intersections, twenty-four blocks, protected bike offsets, and a bounded actor manifest. `src/world/traffic.ts` owns neighborhood movement and intersection state. `src/content/park.ts` defines shared walking curves, open gates, outside sidewalks, the reservoir running loop, and the eighteen-walker/twelve-runner manifest. `src/world/actors.ts` enforces same-route headway and geometric spacing. The separated walking circuits no longer require the former south-merge reservation. Spline distance tables include every control-point knot to avoid speed spikes where long straights meet short bends. `ActorSimulation` steps both systems on the same fixed clock and exposes all traveling actors through one retained collection. Rendering recovery never constructs a replacement simulation.

`src/world/streetscape.ts` builds original perimeter blocks and road details from that shared street contract, not independently positioned decorative roads. Traffic lights display simulation-owned signal states. `src/world/park.ts` renders the shared curves as path ribbons and owns its landscape surfaces/materials. `src/world/pavement.ts` owns two reusable original stencil geometries; paint materials and static instance buffers belong to the parent scene. `ActorInstances` batches all 132 people/vehicle rigs and two sports balls while borrowing scene geometries/materials. Running is a distinct distance-driven gait in `locomotion.ts`, not per-frame React state or a new scheduler. Hidden source meshes retain their rig transforms; dynamic instance matrices update imperatively. Instance buffers are disposed separately from the shared geometry/material owners.

The scene, overview camera, shadow coverage, and bounded rain/cloud footprint grow together. Five original landmarks share one focus/tour interface; the matching `rainlight-004.svg` is a simplified original fallback. The fixed actor population, protected-lane geometry, and signal/clearance rules are fictional miniature design choices, not an implementation of NYC traffic engineering standards. The shared `bikeLaneOffset` resolves both directions onto the same park-side track on the two selected horizontal streets. Art, stop bars, pavement symbols and cycling routes must use this same signed offset. See [NYC research](NYC_CITY_RESEARCH.md) for source-backed distinctions and future options.

The combined population is 132 animated people/vehicles: six buses, thirty other road vehicles, 66 walkers (eighteen in the park), twelve runners, twelve cyclists and six court players. Seeded street simulations exercise full-footprint spacing, painted stop bars, intersection exclusivity and forward progress; five fifteen-minute park simulations verify spacing, bounded waits, repeated gate entry/exit and sustained running. Green duration is eight seconds; occupied reservations retain priority through all-red clearance. Stop bars at 8.5 m and turn boundaries at 7 m are deliberately distinct. Neighborhood walkers stay on sidewalks, and buses do not have scheduled stops. Routes are authored continuous circuits, not an arbitrary destination-routing service.

`src/content/courts.ts` shares both court footprints, net/hoop positions and six player definitions with art and motion. `CourtActivity` samples basketball and pickleball choreography from `ActorSimulation.elapsed` before actor matrices are uploaded. It owns no timers or GPU allocations; scene-owned meshes use the existing instance batches. Two bounded ball props and planted player stances remain separate from traveling-actor routing and collision reservations. Rebuilding the artwork samples the retained time, while reduced motion uses a fixed still.

Static shadows are cached and invalidated on initialization, reconstruction and quality changes. The shadow camera's projection matrix is explicitly refreshed after setting expanded bounds; merely assigning its limits leaves the default small projection active. Moving actors do not cast shadows, avoiding stale actor shadows in the cached map; Lightweight disables shadows. Unchanged poses are not resubmitted between the 30 Hz simulation ticks. Rapid navigation commands update camera intent immediately but coalesce rendering into one requested animation frame, including while paused. Hidden pages schedule no frames. Non-bfcache page exit disposes GPU resources; bfcache suspension retains the world for resumption.

The camera uses a 340 m pivot distance, 850 m far plane, 30-75 degree elevation, and zoom up to 10. Its target bounds match the rectangular map independently on each axis. Focus anchors at zoom 3.5-5.2 retain zoom-in headroom. Tour travel scales with ground distance rather than speeding across the larger city. The airplane corridor extends from (-1200, 46, -900) to (1200, 46, 900), keeping entry/exit beyond expanded zoom-out and edge-pan views; its speed and 90-180-second quiet gaps are unchanged. Fog density compensates for the larger camera distance; the sky-matched backdrop is unlit.

### Retained foundation

`src/app/App.tsx` owns React status, help/focus, and lazy renderer loading with late-load cancellation. A retained `WorldModel` owns the camera controller and actor simulation, so retry/context restoration retains pause, selection, route progress, and pose. `createWorld.ts` owns one RAF chain, a fixed-step clock, GPU resources, scene-only input, and visibility/context listeners. `input.ts` locks gestures and clears pointer capture on cancellation, blur, and suspension. UI changes publish semantic status; frame updates do not run through React.

`src/content/city.ts` keeps versioned semantic IDs and bounded landmark/tour anchors separate from `scene.ts` geometry; street and park routes live in their own shared content modules. `CITY.busId` aliases the existing street bus `city-vehicle-6`; the removed `square-bus` and `car-1..3` are not restored. The M2 reproducible workflow is direct authored TypeScript geometry, not a downloaded or opaque GLB. Vite hashes the generated application chunks. The current SVG is separately versioned as `rainlight-004.svg`; earlier stills remain historical originals.

The clock runs at 30 simulation steps/second with at most three steps per rendered frame; actors render at the latest completed tick. Sub-tick visual interpolation is not claimed. The initial scene is Afternoon/Sunny with capped DPR 1.5. The quality selector is implemented: High/Automatic currently share the capped default rendering policy, while Lightweight uses DPR 1 and fewer effects. The separately tested adaptive-quality algorithm is not yet connected to runtime frame sampling.

## Recommended stack and exclusions

Use React for the accessible control layer, strict TypeScript for contracts, Vite for a static browser build, and Three.js for rendering. Tailwind with original design tokens or a small custom-token stylesheet is sufficient; choose one coherent styling approach. Use Base UI for complex accessible primitives and Lucide for icons only as needed. Select compatible versions when implementation is authorized, not from source-version observations alone.

Direct Three.js is a simple starting point. Do not add R3F, a physics engine, ECS framework, global-state library, animation library, or multiple render abstractions speculatively. A small imperative world runtime and typed command/event boundary should cover the first milestones. Add a dependency only after a concrete limitation and tradeoff are established.

The source uses Vinext/RSC signatures, but this app has no server-rendered business state to justify copying that complexity. Use static versioned assets and local preferences. **No backend, database, login, API routes, presence service, commerce, analytics, moderation, or advertiser systems.** Browser resource loading is not a reason to add a backend.

## Ownership model

| Owner | Owns | Must not own |
| --- | --- | --- |
| React UI | Panel state, settings choices, selected semantic ID, lifecycle/status text, focus management. | Per-frame actor transforms, geometry mutation, particle arrays, camera interpolation. |
| World runtime | Renderer lifecycle, frame scheduling, simulation clock, systems and their resources. | DOM focus, commerce data, source-site APIs. |
| Camera controller | Camera pose and transitions; mode arbitration and safe framing. | Independent component-specific camera writers. |
| Actor systems | Route progress, speed/dwell state, instance transforms, deterministic variation. | React state updates every frame. |
| Environment/audio systems | Light/weather progression, effects, sound graph and scheduling. | Hidden-tab catch-up or audio without consent. |
| Quality manager | Local frame samples, effective tier, bounded allocation budgets. | Remote telemetry, silent invalidation of selected actors. |

React sends typed commands; the runtime publishes meaningful state changes and throttled summaries. Selection/mode/error changes can publish immediately. UI clock/status summaries should update at most a few times per second, usually once per second; frame instrumentation stays inside the runtime. Do not mirror every object into React.

## Proposed module layout

This remains the broader future layout sketch; current implemented modules above are deliberately smaller.

```text
src/
  app/                   React shell, panels, controls, fallback, error boundary
  world/
    createWorld.ts       Runtime creation, commands, subscriptions, disposal
    lifecycle.ts         Loading, context loss, restoring, single-loop ownership
    clocks.ts            Simulation ticks, wall clock adapter, suspension
    camera.ts            Exclusive camera mode controller
    input.ts             Scene gestures and semantic navigation commands
    actors/              Vehicles, pedestrians, aerial actors, route scheduling
    environment/         Lighting, weather, local-time mapping
    audio.ts             Explicitly enabled Web Audio graph
    quality.ts           Presets, measurements, hysteresis
  content/               Original POI, route, tour and anchor manifests
  preferences/           Versioned non-sensitive local preference validation
  styles/                Original UI tokens and styles
public/city/              Only original/licensed versioned geometry and stills
tools/art/                Future deterministic original-art generator
tests/                    Behavior, integration and visual regression tests
```

Do not copy `research/` into `public/`, import captures into source code, or load manifests directly from untrusted research. App manifests are new authored content and validated separately.

## Renderer lifecycle

`createWorld` should accept a canvas, validated authored content, preferences, and event callbacks, then return command and dispose methods. Initialization can lazy-load the renderer and geometry behind the original poster.

Own exactly one animation frame chain per mounted world. Use an abort signal or generation token so a late load cannot attach resources after disposal or retry. Cleanup must be idempotent and survive React development-mode mount/unmount cycles. Explicitly handle load rejection, WebGL creation failure, context loss, and restoration instead of returning a fake ready state.

On resize, measure the scene container rather than assuming full window dimensions; clamp DPR and update projection once per layout change. Use ResizeObserver with teardown. Clamp zoom and target bounds using the POI/scene manifest; recalculate framing when control panels or mobile safe areas change.

When paused with no active input, request renders only for changes such as resize, focus, settings, or context recovery. When hidden, stop the loop completely. Context loss prevents default browser disposal handling where appropriate, suspends systems, and rebuilds resources from retained CPU-side content on restoration. Allow one restoration attempt per loss before requiring explicit Retry if it fails. Report the failure and offer static fallback.

On dispose: cancel frame requests/timers, abort pending loads, release pointer capture, unsubscribe listeners/observers, stop audio scheduling, disconnect/close audio resources, and dispose unique geometries/materials/textures/render targets/renderer. Shared resources need explicit ownership; dispose once, not once per instance. Do not leave a global debug object or a detached canvas retaining the entire world.

## Clock and simulation

Separate **wall time** (device clock) from **simulation time** (paused progression). A proposed fixed simulation step is 1/30 second with interpolated rendering. Clamp accumulated elapsed work to 100 ms and at most three simulation steps per rendered frame; discard excess rather than causing a catch-up spiral. Test the chosen interpolation scheme at 30 and 60 Hz.

Page hiding, context loss, and resume reset the timestamp/accumulator. Do not advance actors, event timers, or accelerated weather/time through time spent hidden or user-paused. Local-clock lighting may blend toward current device time over 10 seconds after returning, as defined by the [experience contract](EXPERIENCE_SPEC.md). A visible second-screen window can continue even when unfocused.

Use a seedable PRNG for world variation and event schedules; do not call unseeded randomness inside frame updates. Tests need injected clock/seed/weather and a known simulation tick. Store route distance and event counters, not an ever-growing event history.

## Actor, route, and intersection systems

Use authored lane/footpath graphs and arc-length parameterized paths. Precompute sampled lengths/tangents rather than repeatedly measuring splines per actor. Actors hold route ID, distance/progress, desired speed, current speed, dwell state, and a small finite behavior state such as moving/waiting/dwelling.

Vehicle routes include stop lines, turn constraints, bus stops, and merge/crossing conflict groups. A simple deterministic right-of-way or traffic-light schedule is sufficient. Clamp advancement before a blocked stop line; don't move into an occupied conflict zone and correct it afterward. Give actors stable spacing and bounded acceleration/deceleration. Pedestrians use sidewalk paths and crossing phases; waiting is part of the scene's life.

Prioritize simple rules over full physics. Test crossing exclusivity, loop continuity, stop dwell, target validity, and bounded population counts. Avoid deadlocks through explicit conflict ordering and maximum-wait diagnostics during development, not teleporting actors through conflicts.

Aerial routes use safe altitude bands and scripted loops; they do not need aerodynamics. Optional rare events are seeded and bounded with minimum gaps. Parked people, plants, and props can have cheaper animation/detail tiers than moving actors.

## Semantic manifests and example contracts

Geometry must not be the database of interaction identity. Store original POIs, routes, and camera/tour anchors separately from the geometry. IDs survive geometry regeneration and mesh batching; never use a mesh array index as a persistent selection ID.

Proposed conventions: meters, Y-up, right-handed coordinates, versioned schema, explicit asset version, seed, and bounded scene extents. Validate unique IDs, finite coordinates, references, route continuity, positive durations, and camera bounds before showing ready. Report malformed authored content as a load error.

Illustrative TypeScript contracts, not executable project files:

```ts
type Vec3 = readonly [number, number, number];
type CameraMode = "overview" | "free" | "focus" | "tour";

interface Landmark {
  id: string;
  name: string;
  description: string;
  position: Vec3;
  focusAnchorId: string;
  hitRadius: number;
}

interface RouteStop {
  distanceMeters: number;
  dwellSeconds: number;
  conflictGroupId?: string;
}

interface ActorRoute {
  id: string;
  kind: "vehicle" | "pedestrian" | "aerial";
  points: readonly Vec3[];
  loop: boolean;
  speedMetersPerSecond: readonly [number, number];
  stops: readonly RouteStop[];
}

type WorldCommand =
  | { type: "set-paused"; paused: boolean }
  | { type: "focus-landmark"; id: string }
  | { type: "start-tour" }
  | { type: "stop-camera" }
  | { type: "reset-view" };

interface WorldStatus {
  cameraMode: CameraMode;
  userPaused: boolean;
  effectiveRunning: boolean;
  selectedId: string | null;
}
```

This command union is a small example, not the complete input/settings API. Production contracts must cover every action in the experience spec. No buyer, placement, advertiser, price, availability, or external business URL belongs in a POI contract.

Example of **new proposed content**, not source-city names or coordinates:

```json
{
  "schemaVersion": 1,
  "assetVersion": "district-001",
  "seed": 2401,
  "units": "meters",
  "upAxis": "Y",
  "bounds": { "min": [-60, 0, -60], "max": [60, 45, 60] },
  "landmarks": [
    {
      "id": "civic-observatory",
      "name": "Civic Observatory",
      "description": "A quiet rooftop above the garden walk.",
      "position": [12, 16, -8],
      "focusAnchorId": "observatory-view",
      "hitRadius": 7
    }
  ],
  "cameraAnchors": [
    {
      "id": "observatory-view",
      "position": [32, 30, 18],
      "target": [12, 12, -8],
      "viewHeight": 36
    }
  ]
}
```

## Rendering and asset efficiency

Batch static geometry by material when beneficial, but retain spatial chunks for culling and loading. Use shared geometry/materials and instancing for repeated windows/trees/props/actors where practical. Semantic hit volumes remain separate from visual batches. Avoid per-object material clones to highlight one POI; use a separate marker/outline representation.

Use a restrained light setup and profile shadows before adding post-processing. Static surfaces, dynamic actors, and rain should not all cast expensive shadows by default. Reuse vectors/matrices and preallocate hot-path buffers. Never allocate unbounded particles, sounds, or events.

Use original optimized GLB assets with versioned filenames/content hashes and matching manifest versions. Cache immutable versioned files and invalidate manifests deliberately. This is a loading design, not a requirement for a service worker or offline mode. See [art pipeline](ART_AND_ASSETS.md) for generation and rights.

## Environment, audio, and quality

Lighting maps a normalized day phase to key/ambient light, sky/background, and selective lit-window appearance. Weather changes cloud density, fog and modest rain effects; keep weather state separate from the time mode. Fixed presets remain testable under every quality tier.

Audio is owned by one graph with a master gain. Require an explicit user gesture before audible output; saved preferences do not authorize autoplay. Suspend/fade on pause/hidden/context loss and close/disconnect on dispose. Use original synthesis initially or clearly licensed audio if needed; Web Audio usage in the source does not prove its whole sound design was synthesized.

Quality controls DPR, render cadence, shadows, particle budgets, and population/detail tiers. Proposed initial ceilings: High DPR 1.75, Automatic no higher than 1.5 until profiled, Lightweight 1.0 and a 30 FPS render target. Do not couple simulation speed to frame rate.

Automatic quality samples a rolling local frame-time window (for example five seconds), downgrades after sustained budget misses, upgrades only after longer stable headroom (for example 20 seconds), and waits at least 30 seconds between tier changes. Ignore hidden/startup samples. Preserve semantic identity and routes when reducing density. Exact thresholds are calibration proposals.

## Preferences and input coordination

Store a small versioned preferences object in localStorage: time/weather modes, natural-weather choice, quality preference, motion mode (`system`/`reduced`/`full`), volume/mute preference, and guide visibility. No user identifiers, interaction history, analytics consent identifiers, purchase state, API tokens, or actor replay logs.

Parse as unknown, validate an allowlisted schema, and bound numeric values. Migrate known versions or reset invalid preferences with a visible nonblocking notice. If storage is unavailable/quota-limited, continue in memory and explain that settings will not be saved. A new visit always requires explicit audio enable, regardless of saved mute preference. Session camera pose, user pause, and tour progress need not persist across reloads.

Input routing checks overlay ownership before world hit testing. Use one command path for pointer, buttons, and keyboard. Scope shortcuts to the named scene navigation region, ignore composing/editable targets, clear key state on blur, and keep reduced-motion and modal policies centralized.

## Test seams

Pure units: clock/pause math, route interpolation, stop/conflict arbitration, seeded events, camera state transitions, content/preference validation, and quality hysteresis.

Component tests: accessible control names/states, settings changes, modal focus return, errors/fallback, and no world input through overlays. Browser tests: actual canvas hit routing, WebGL lifecycle, pointer/touch/keyboard, visibility, audio gating, fullscreen, and deterministic visual captures. Real devices: GPU/frame behavior, thermal/long-session stability, mobile Safari and Android interaction.

The complete matrix and implementation verification record are in [acceptance criteria](ACCEPTANCE_CRITERIA.md). Current tooling is Vitest + React Testing Library + Playwright, with ESLint and TypeScript checks. Physical-device profiling remains outstanding.

## Deployment

The app is a static single-page bundle with no backend, so any static host serves it. `vercel.json` at the repository root configures Vercel directly: framework preset `vite`, build command `npm run build` (`tsc -b && vite build`), output directory `dist`, and an SPA rewrite so every path resolves to the app shell. Vercel reads the Node version from `package.json` `engines`. No environment variables or runtime services are required; local-only preferences persist in the browser. This deployment configuration introduces no backend, database, analytics, or commercial system, consistent with the product boundary.
