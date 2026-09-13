# Technical architecture

**Status: main integration was published at `48dc3fe`; full-size courts, denser pedestrian activity and compact subway/shed refinements are under current-slice verification.** The application uses React, strict TypeScript, Vite, direct Three.js, and npm with exact locked versions. Preserve the expanded simulation, original art, five-landmark navigation/tours, weather physics and accumulating snow/water, optional audio, compact Settings dock, quality presets, occasional airplane, and local preferences. Historical checkpoints do not verify a later revision. Physical-device, long-session and adaptive-quality work remain deferred outside this session's requested slice. No services or backend exist; the app ships as a static Vite build (see Deployment).

## Current implementation

### Night lighting follow-up

`vehicleLighting.ts` samples head/tail/brake/indicator levels from the retained environment, traffic state and simulation clock. `traffic.ts` exposes upcoming turn and brake-held/deceleration metadata without changing routes, speeds or reservations. `scene.ts` defines lamp sockets on real vehicle bodies, separates non-emissive vehicle glazing from window materials and lights taxi/subway fixtures.

`LightingVisual` owns three instanced draws (420 lenses, up to 507 halos and 183 ground footprints), a fixed 680x680 RG float height/retention texture, one small procedural halo mask and eight unshadowed inverse-square spotlights. No per-light timers, React frame updates, post-processing dependencies or new shadow maps are added. Ground footprints use a smooth finite falloff, height masking and snow support. Ranked local-light selection fades to zero at its boundary and by overview zoom; Lightweight sets detailed-light intensities to zero while retaining cues. All allocations have idempotent disposal. Locomotion memory survives graphics restoration and reapplies the same body poses before rebuilding the lamp transforms.

`COURT_LAMPS` keeps the six recreation fixtures separate from the main park manifest, preserving park-boundary validation. Court-derived pole locations and inward targets drive both pitched twin-head geometry and soft footprints/local spots; allocation remains six public plus two vehicle spotlights. Validation includes base-radius clearance from the parcel edge, both runoffs and the shared passage.

The renderer explicitly uses sRGB output, Neutral tone mapping and PCF soft directional-shadow filtering. Weather material hooks and existing sky/time interpolation remain intact. This is a hybrid approximation: no calibrated photometry, complete occlusion, volumetric scattering or ray-traced reflections. See [lighting research](LIGHTING_RESEARCH.md) and the current [verification record](ACCEPTANCE_CRITERIA.md#night-lighting-follow-up---2026-09-13).

### Connected-city expansion

The central village/vehicle loop is removed. `src/content/streets.ts` defines the surrounding six-by-six street grid, thirty-six intersections, twenty-four blocks, protected bike offsets, and a bounded actor manifest. The map is 220 x 340 m, with 94 buildings outside the 78 x 176 m car-free park. `src/world/traffic.ts` owns neighborhood movement and intersection state. `src/content/park.ts` defines shared walking curves, open gates, outside sidewalks, the reservoir running loop, and the twenty-four-walker/twelve-runner manifest. `src/world/actors.ts` enforces same-route headway and geometric spacing. The separated walking circuits no longer require the former south-merge reservation. Spline distance tables include every control-point knot to avoid speed spikes where long straights meet short bends. `ActorSimulation` steps both systems on the same fixed clock and exposes all traveling actors through one retained collection. Rendering recovery never constructs a replacement simulation.

`src/world/streetscape.ts` builds original perimeter blocks and road details from that shared street contract, not independently positioned decorative roads. Traffic lights display simulation-owned signal states. `src/world/park.ts` renders the shared curves as path ribbons and owns its landscape surfaces/materials. `src/world/pavement.ts` owns two reusable original stencil geometries; paint materials and static instance buffers belong to the parent scene. `ActorInstances` batches all 186 people/vehicle rigs and two sports balls while borrowing scene geometries/materials. Running is a distinct distance-driven gait in `locomotion.ts`, not per-frame React state or a new scheduler. Hidden source meshes retain their rig transforms; dynamic instance matrices update imperatively. Instance buffers are disposed separately from the shared geometry/material owners.

The scene, overview camera, shadow coverage, and bounded rain/cloud footprint grow together. Five original landmarks share one focus/tour interface; the matching `rainlight-005.svg` is a simplified original fallback. The fixed actor population, protected-lane geometry, and signal/clearance rules are fictional miniature design choices, not an implementation of NYC traffic engineering standards. The shared `bikeLaneOffset` resolves both directions onto the same park-side track on the two selected horizontal streets. Art, stop bars, pavement symbols and cycling routes must use this same signed offset. See [NYC research](NYC_CITY_RESEARCH.md) for source-backed distinctions and future options.

The combined population is 186 animated people/vehicles: six buses, thirty other road vehicles, 120 walkers (twenty-four in the park), twelve runners, twelve cyclists and six court players. The traveling-actor collection contains 180 entries; court players and two balls are sampled separately. Seeded street simulations exercise full-footprint spacing, painted stop bars, intersection exclusivity and forward progress; five fifteen-minute park simulations verify spacing, bounded waits, repeated gate entry/exit and sustained running. Green duration is eight seconds; occupied reservations retain priority through all-red clearance. Stop bars at 8.5 m and turn boundaries at 7 m are deliberately distinct. Neighborhood walkers stay on sidewalks, and buses do not have scheduled stops. Routes are authored continuous circuits, not an arbitrary destination-routing service.

`src/content/courts.ts` shares full-size playing/runoff footprints, net/hoop positions and six player definitions: basketball 28.6512 x 15.24 m at (-18, 113.5), pickleball 13.4112 x 6.096 m at (15, 113.5). The basketball cycle is 24 seconds; pickleball repeats in 5.6 seconds. `CourtActivity` samples absolute retained time before actor upload, including grounded movement and moving hand/paddle contacts. It owns no timers or GPU allocations. Player supports and bounce floors accept retained snow lift while rim/net targets stay fixed. Scene-owned paddle blades retain the local contact center (0, -0.65, 0) after resizing. A bounded rectangular semantic volume covers both courts and runoffs without selecting adjacent streets; Juniper's focus anchor is (-5, 113.5). Rebuilding samples the retained clock, while reduced motion uses a fixed still.

`src/content/metro.ts` shares eight compact entrance positions, cardinal orientations and 1.9 x 4.5 m openings. Static art supplies low railings and twelve genuinely descending treads. `scene.ts` cuts matching holes through both the island and the unlit backdrop, so neither fills the stairwells. Weather capture initializes below the lowest static geometry rather than clipping deep treads to the former -0.96 m backdrop floor. Crosstown's existing semantic ID and camera anchor follow its shared entrance coordinates; the other entrances remain scenery, not new directory entries or underground simulation.

Scene shadows are cached and invalidated on initialization, reconstruction, quality changes and retained weather revisions. Weather-driven canopy movement and snow depth therefore refresh the shadow map rather than treating the scene as permanently static. The shadow camera's projection matrix is explicitly refreshed after setting expanded bounds; merely assigning its limits leaves the default small projection active. Moving actors do not cast shadows, avoiding stale actor shadows in the cached map; Lightweight disables shadows. Unchanged actor poses are not resubmitted between the 30 Hz simulation ticks. Rapid navigation commands update camera intent immediately but coalesce rendering into one requested animation frame, including while paused. Hidden pages schedule no frames. Non-bfcache page exit disposes GPU resources; bfcache suspension retains the world for resumption.

The expanded shadow map needs a matching depth offset: bias is 1.25 world-space shadow texels divided by the orthographic depth range, with the existing 0.06 m normal bias retained. Isolated WebKit comparison exposed strong ground/roof self-shadow striping with the old small offset; the scale-aware offset removes that observed striping without increasing map resolution or disabling shadows. This is not a physical-device performance claim. The base-scene ceiling remains 550,000 triangles, 110 visible submissions and 36 materials. Feature checkpoint `eabf072` measured 507,474 / 88 / 31 before main's weather effects; shell/pool/particle work and extra passes require separate current measurements.

The camera uses a 340 m pivot distance, 850 m far plane, 30-75 degree elevation, and zoom up to 10. Its target bounds match the rectangular map independently on each axis. Focus anchors at zoom 3.5-5.2 retain zoom-in headroom. Tour travel scales with ground distance rather than speeding across the larger city. The airplane corridor extends from (-1200, 46, -900) to (1200, 46, 900), keeping entry/exit beyond expanded zoom-out and edge-pan views; its speed and 90-180-second quiet gaps are unchanged. Fog density compensates for the larger camera distance; the sky-matched backdrop is unlit.

### Retained foundation

`src/app/App.tsx` owns React status, help/focus, and lazy renderer loading with late-load cancellation. A retained `WorldModel` owns the camera controller and actor simulation, so retry/context restoration retains pause, selection, route progress, and pose. `createWorld.ts` owns one RAF chain, a fixed-step clock, GPU resources, scene-only input, and visibility/context listeners. `input.ts` locks gestures and clears pointer capture on cancellation, blur, and suspension. UI changes publish semantic status; frame updates do not run through React.

`src/content/city.ts` keeps versioned semantic IDs and bounded landmark/tour anchors separate from `scene.ts` geometry; street and park routes live in their own shared content modules. `CITY.busId` aliases the existing street bus `city-vehicle-6`; the removed `square-bus` and `car-1..3` are not restored. The M2 reproducible workflow is direct authored TypeScript geometry, not a downloaded or opaque GLB. Vite hashes the generated application chunks. The current SVG is separately versioned as `rainlight-005.svg` to avoid stale cached composition; earlier stills remain unchanged historical originals.

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

Current vehicle routes include stop lines, contained turns and merge/intersection conflict groups, but no scheduled bus stops. A simple deterministic right-of-way or traffic-light schedule is sufficient. Clamp advancement before a blocked stop line; don't move into an occupied conflict zone and correct it afterward. Give actors stable spacing and bounded acceleration/deceleration, including under weather traction. Neighborhood walkers remain on sidewalks; park visitors use the shared gate-connected circuits. A pedestrian signal phase does not imply an implemented walking road crossing.

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

Lighting maps a normalized day phase to key/ambient light, sky/background, and selective lit-window appearance. Public street and park lamps are static fixtures ([`lighting.ts`](../src/content/lighting.ts)): cobra-head luminaires along the avenue kerbs and short globe lamps beside park paths, each with an emissive head plus an additive ground pool. The environment layer ramps every fixture's emissive intensity and pool opacity by the same normalized `night` value that drives the sky, so they glow from dusk and go dark by day with no per-lamp dynamic lights. Building windows carry a deterministic per-instance glow attribute so roughly a third read as unlit and the rest span several warm-to-cool tints; a small shader patch reinterprets the shared glazing emissive per window while preserving the day->night ramp. Weather changes cloud density, fog and modest rain effects; keep weather state separate from the time mode. Fixed presets remain testable under every quality tier.

The incoming weather extension keeps `WeatherPhysics` inside the retained `EnvironmentController`. Fixed CPU pools hold 600 rain particles, 420 snow particles, and 48 recycled impact slots; only active precipitation pools advance. A bounded coherent wind field, cloud offsets, and two surface reservoirs share the fixed-step clock. `WorldModel` passes reduced-motion policy into the physics step and derives a bounded road-traction factor from retained wetness/snow before advancing vehicles. Apply that coupling to the retained grid/park simulation, not a restored garden bus/car loop; full-body clearances and two-way bicycle offsets remain authoritative. Simulation never depends on render quality or visible particle counts.

Precipitation uses the rectangular `CITY_EXTENT` bounds, +/-110 m on X and +/-170 m on Z; fixed rain/snow/impact pool capacities are unchanged. Cloud and rain coverage expand to that district. Separately, `scene.ts` captures static geometry before moving actors/semantic hit volumes into the square `WeatherSurface` height/retention grid: extent 170 m on each axis, resolution 680x680, preserving 0.5 m cells. The two Float32 arrays contain 3,699,200 bytes together; this is allocation arithmetic for heights/retention only, not measured total runtime memory or GPU cost. The incoming-main 192x192 grid over a 96 m square remains a historical small-district setting.

The retained physics uses this grid plus current snow/water height for sampled 2.5D collisions; it is not an exact wall/overhang solver. `SurfaceVisual` borrows tagged standard-material shader hooks for exposure, wetness, roughness and snow coverage. One shared float texture supplies the exposure heights. Final CPU/memory and GPU measurements for the larger grid remain pending.

`SnowVolumeVisual` adds source-geometry-sharing shell batches for roofs, terrain, paving and vegetation, including the park's lawn and path materials. Its color and depth/shadow shaders displace exposed vertices using retained SWE-derived depth. Instanced shells own their copied buffers and update them only when the source version changes; tree snow therefore follows foliage instead of floating at the rest pose. It borrows source geometry and the exposure texture, owns its materials/instance buffers, and disposes before the exposure adapter and original art. Main's earlier 33-shell count is historical; expanded-scene counts and GPU shader compilation need new verification.

`GroundWater` keeps three fixed volume/depth/radius states, fed by direct rain/melt and representative runoff. The merge relocates their X/Z centers to Great Lawn points (4, -3), (13, -4) and (5, 6), with rim Y=-0.035. Matching openings cut through both lawn overlays and the island base, exposing the paraboloid beds rather than leaving the former small-district basins hidden under the park. The authored placements avoid the shared paths/gates, courts, buildings, sidewalks and bike tracks; final integrated clearance and visual verification are still required. `GroundWaterVisual` draws three shared-geometry water surfaces and at most six ripple instances. Combined conservation tests distinguish internal drainage/melt transfers from true evaporation, drainage and overflow leaving the modeled domain. These are small explicit catchments, not terrain-wide hydrology.

`EnvironmentVisual` projects CPU particle pools into shared rain-line/snow-point buffers, uses six shared cloud meshes, and draws bounded impact/ripple instances. Lightweight caps rain/snow/impacts/garden rings at 160/120/16/4, versus 600/420/48/12 at High; it does not change physical input. Rain count scales with `sqrt(intensity/30)` inside those caps, while the controller's independent 0-30 mm/h forcing drives water volume. Reservoir ripples now align with the actual water surface at Y=0.018. `FoliageWind` drives the shared tree/reed instance batches from their immutable rest matrices rather than accumulating transforms. Repeated draws without a simulation revision do not upload particle/foliage buffers again.

GPU restoration rebinds the rebuilt surface sampler without reseeding precipitation or resetting reservoirs. Effect disposal restores borrowed lights, material hooks and foliage before disposing owned geometries, textures, materials and instance buffers. The renderer's separate environment elapsed timer has been removed; all progression now lives in retained CPU state. The mathematical basis and deliberate simplifications are in [weather physics research](WEATHER_PHYSICS_RESEARCH.md).

Particle and actor travel use ordinary simulation seconds; surface accumulation, melt, drainage and evaporation alone use 60x time compression. Retained two-stage weather blending reaches about 99% in eight simulation seconds for manual changes and thirty for natural changes. Retargeting retains the current blend and velocity; paused/reduced-motion selections apply once without advancing or clearing stored snow/water.

Audio is owned by one graph with a master gain. Require an explicit user gesture before audible output; saved preferences do not authorize autoplay. Suspend/fade on pause/hidden/context loss and close/disconnect on dispose. Use original synthesis initially or clearly licensed audio if needed; Web Audio usage in the source does not prove its whole sound design was synthesized.

Quality controls DPR, render cadence, shadows, particle budgets, and population/detail tiers. Proposed initial ceilings: High DPR 1.75, Automatic no higher than 1.5 until profiled, Lightweight 1.0 and a 30 FPS render target. Do not couple simulation speed to frame rate.

Automatic quality samples a rolling local frame-time window (for example five seconds), downgrades after sustained budget misses, upgrades only after longer stable headroom (for example 20 seconds), and waits at least 30 seconds between tier changes. Ignore hidden/startup samples. Preserve semantic identity and routes when reducing density. Exact thresholds are calibration proposals.

## Preferences and input coordination

Store a small versioned preferences object in localStorage: time/weather modes, natural-weather choice, rain intensity (0-30 mm/h, default 8), quality preference, motion mode (`system`/`reduced`/`full`), volume/mute preference, and guide visibility. No user identifiers, interaction history, analytics consent identifiers, purchase state, API tokens, or actor replay logs.

Parse as unknown, validate an allowlisted schema, and bound numeric values. Migrate known versions or reset invalid preferences with a visible nonblocking notice. If storage is unavailable/quota-limited, continue in memory and explain that settings will not be saved. A new visit always requires explicit audio enable, regardless of saved mute preference. Session camera pose, user pause, and tour progress need not persist across reloads.

Input routing checks overlay ownership before world hit testing. Use one command path for pointer, buttons, and keyboard. Scope shortcuts to the named scene navigation region, ignore composing/editable targets, clear key state on blur, and keep reduced-motion and modal policies centralized.

Settings has one standalone lower-left trigger inside the scene, with a non-modal dock stacked above it, internal scrolling and no backdrop. Opening sends `stop-camera` once, not `open-panel`; only Help uses the world's modal `open-panel`/`close-panel` commands. Settings owns focus entry and Escape within its boundary, without containing Tab or disabling city controls. Landmark cycling and concise selection status live in the bottom toolbar, including the unsupported-WebGL fallback.

The header/browser title remain CitiVibe. The title overlay and Field guide header button stay removed; an offscreen h1 preserves the world's accessible name. Settings exposes keyboard help, and `?` opens Help from the focused city navigation region. Neither the dock merge nor weather controls restore removed camera-follow features.

## Test seams

Pure units: clock/pause math, route interpolation, stop/conflict arbitration, seeded events, camera state transitions, content/preference validation, and quality hysteresis.

Component tests: accessible control names/states, settings changes, modal focus return, errors/fallback, and no world input through overlays. Browser tests: actual canvas hit routing, WebGL lifecycle, pointer/touch/keyboard, visibility, audio gating, fullscreen, and deterministic visual captures. Real devices: GPU/frame behavior, thermal/long-session stability, mobile Safari and Android interaction.

The complete matrix and implementation verification record are in [acceptance criteria](ACCEPTANCE_CRITERIA.md). Current tooling is Vitest + React Testing Library + Playwright, with ESLint and TypeScript checks. Physical-device profiling remains outstanding.

## Deployment

The app is a static single-page bundle with no backend, so any static host serves it. `vercel.json` at the repository root configures Vercel directly: framework preset `vite`, build command `npm run build` (`tsc -b && vite build`), output directory `dist`, and an SPA rewrite so every path resolves to the app shell. Vercel reads the Node version from `package.json` `engines`. No environment variables or runtime services are required; local-only preferences persist in the browser. This deployment configuration introduces no backend, database, analytics, or commercial system, consistent with the product boundary.

Retain main's response policies: `/assets/*` gets `public, max-age=31536000, immutable`; `/city/*` gets `public, max-age=86400`; `/index.html` gets `public, max-age=0, must-revalidate`. Global headers are `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Frame-Options: SAMEORIGIN`. These describe the checked-in configuration, not a deployed-header observation or comprehensive security certification. Finishing, merging and pushing the existing PR #2 does not authorize a preview or production deployment.
