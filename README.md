# CitiVibe

CitiVibe is an interactive miniature NYC-inspired neighborhood built for exploring up close or leaving open on a second screen. Buses, yellow cabs, delivery vans, emergency trucks, cyclists, and 470 pedestrians move on their own clock while daylight and weather shift around them.

## What is in the city right now

The 220 x 340 m district sits on a six-by-six street grid with 94 buildings wrapped around a car-free 78 x 176 m central park. Seventy-five of those buildings meet along narrow party-wall joints instead of floating on isolated lots, mixing 17 offices, 31 ground-floor storefronts with apartments above, 43 residential buildings, and three civic buildings (a hospital, a firehouse, and a police precinct). See the [building-fabric study](docs/NYC_BUILDING_FABRIC_RESEARCH.md) and [architectural character notes](docs/ACCEPTANCE_CRITERIA.md#nyc-architectural-character---2026-09-17).

Close up, buildings cast interior room depth through a single-pass parallax window shader (`windowLighting.ts`), and box edges pick up a 2.4 cm world-space normal chamfer so cornices and brownstone stoops catch sunlight without blowing up the triangle count. Brick walls, concrete sidewalk flags, worn asphalt lanes, and pond ripples sample cached 128x128 Simplex normal and roughness maps with 16x anisotropic filtering, layered over the earlier [procedural finish and trim-plane pass](docs/ACCEPTANCE_CRITERIA.md#nyc-polish-autonomy-and-rendering-performance---2026-09-26). `Automatic` quality renders in one hardware-MSAA pass at 1.25x DPR so laptops stay responsive; switching to `High detail` in Settings lazy-loads a separate `postprocessing` + `n8ao` bundle for half-resolution horizon ambient occlusion and SMAA.

Out on the avenues, 48 moving motor vehicles and twelve curbside parked cars share clearcoated `MeshPhysicalMaterial` bodywork, lathed 16-segment tires, metallic alloy rims, grilles, mirrors, and route-driven lamps. Passenger cars split into sedans, hatchbacks, and crossovers; yellow cabs mix sedans and minivans; box trucks separate cab from cargo box; and fire engines carry pump panels, shutters, hose beds, and ladders. None of them carry real-world badges or ads. The [ordinary fleet notes](docs/NYC_ORDINARY_VEHICLES_RESEARCH.md), [emergency fleet study](docs/NYC_EMERGENCY_VEHICLES_RESEARCH.md), and [lighting research](docs/LIGHTING_RESEARCH.md) trace what came from reference photos and what was tuned by eye.

Three unbranded bike-share stations hold ten bikes across eleven parallel docks, mixing blue step-through frames with heavier silver electric bikes ([bike study](docs/NYC_CITY_RESEARCH.md#classic-and-electric-shared-bikes---2026-09-16)). Station riders walk a bike out to the green two-way cycle tracks and return it to its own dock, using a crossing reservation beside Juniper Court so nobody deadlocks at the curb.

Four hundred seventy articulated people populate the blocks and park: 240 intersection walkers who plan multi-block trips and wait for walk phases, 96 avenue and park-mall strollers, 55 park gate walkers, 30 reservoir runners who pace themselves and pass on the left, 27 cyclists, six basketball and pickleball players at Juniper Court, eight meadow family figures, and eight picnic neighbors. When rain or snow starts, walkers stagger umbrellas, raincoats, and winter hats; the eight picnic neighbors stand up, walk out the east gate, and wait for warm, dry weather before returning through the south gate ([people and weather study](docs/PEOPLE_WEATHER_RESEARCH.md), [people and activity](docs/PEOPLE_AND_ACTIVITY.md)). The older 464-person doubling item in the [roadmap](docs/ROADMAP.md#next-planned-task---double-the-people) was superseded on this branch by the 470-person crowd pass.

Street furniture sits inside interior plazas, forecourts, and curb pockets rather than along the outer map border: four stainless sidewalk food carts with sneeze-guards and striped canopies, vaulted blue mailboxes, cast-iron and slat benches, fifteen hydrants, thirty curb drains, and four venting steam stacks ([realism record](docs/NYC_REALISM_RESEARCH_PLAN.md#local-implementation-record---2026-09-17), [interior placement verification](docs/ACCEPTANCE_CRITERIA.md#nyc-realism-and-interior-placement---2026-09-17), [street-life references](docs/NYC_CITY_RESEARCH.md#street-life-reference-study---2026-09-13)). Inside the park, a shallow stone arch bridge stops short of the rimmed fountain, flanked by timber pergolas, reeds, lily pads, and sculpted boulders ([lakeside art](docs/ART_AND_ASSETS.md#lakeside-refinement---2026-09-14), [lakeside checks](docs/ACCEPTANCE_CRITERIA.md#lakeside-refinement---2026-09-14)).

Weather runs locally with Sunny, Cloudy, Rain (with a 0 to 30 mm/h slider), Mist, Snow, and Windy presets ([weather physics](docs/WEATHER_PHYSICS_RESEARCH.md)). Snow piles up on roofs, awnings, and streets, while rain feeds shallow puddles that drain once skies clear. Landmark click-selection and the old "Find a quiet place" bar are gone, as are camera-follow modes and drones. React, strict TypeScript, Vite, and Three.js power the app. Earlier merge runs do not verify later commits; see [acceptance criteria](docs/ACCEPTANCE_CRITERIA.md) for what each test runner actually covered.

## GitHub destination

The canonical GitHub destination is [ccastrotrejo/CitiVibe](https://github.com/ccastrotrejo/CitiVibe). The city expansion landed in [PR #2](https://github.com/ccastrotrejo/CitiVibe/pull/2), population diversity in [PR #5](https://github.com/ccastrotrejo/CitiVibe/pull/5), and city/vehicle lighting in [PR #7](https://github.com/ccastrotrejo/CitiVibe/pull/7) at main `06ecb95`. The street-sign and controls branch integrates these changes in [PR #6](https://github.com/ccastrotrejo/CitiVibe/pull/6), with remaining browser/performance limitations documented. Deployment is not part of this request.

The local checkout remains `/Users/carloscastro/Desktop/LivingCity`; do not rename the Desktop folder or project. The ambient-only product scope below is unchanged.

## Product boundary

The user's direction is a city that is "dynamic," has "lots of user controls," and "feels alive," without the directory or marketing side of the reference. The reference is [opportunity.city](https://opportunity.city/); the new city must have its own composition, architecture, identity, and assets.

In scope: camera exploration, ordinary street activity, city-wide tours, believable routes, pause/resume, day/night and simulated weather, public street/park lighting and varied lit windows at night, optional sound, quality settings, fullscreen, responsive controls, keyboard access, reduced motion, and a useful noncommercial rendering fallback. Actor camera-follow and drones are excluded. The neighborhood uses original architecture and fictional streets, not NYC GIS or copied landmarks.

**Out of scope:** directories and listings; advertiser or sponsored placements; ad cards and monetized signs/billboards; marketing and commercial landing-page sections; payments, auctions, bidding, checkout, buyer identities or purchase recovery; ad moderation, advertiser analytics and business metrics. The scoped MVP needs **no backend, database, login, commerce, presence service, or analytics**. Multiplayer, city editing, real GIS, and live weather APIs also remain excluded unless the user explicitly changes scope. Accessibility is not a reason to add a directory.

## Agent reading order

1. [AGENTS.md](AGENTS.md) covers operational rules and precedence.
2. [Product brief](docs/PRODUCT_BRIEF.md) defines scope, intended experience, and success conditions.
3. [Experience specification](docs/EXPERIENCE_SPEC.md) sets interaction and lifecycle behavior.
4. [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md) and [art/assets](docs/ART_AND_ASSETS.md) document module boundaries and the procedural asset pipeline.
5. [Roadmap](docs/ROADMAP.md) and [acceptance criteria](docs/ACCEPTANCE_CRITERIA.md) track milestones and verification gates.
6. [Reference analysis](docs/REFERENCE_ANALYSIS.md), [sources](docs/SOURCES.md), and [research catalog](research/README.md) preserve evidence, caveats, and attribution.

The [agent starter prompts](docs/AGENT_STARTER_PROMPTS.md) remain bounded templates. Implement only authorized milestones.

## Run locally

Use Node.js 22.12+ or 24+ and npm. Exact dependency versions are recorded in `package-lock.json`.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Drag to pan; Command/Control-drag or right-drag to rotate and tilt; scroll to zoom. All map edges are reachable within outer bounds, and the camera buttons do the same thing. Focus the navigation region for shortcuts: Q/E rotates, W/S tilts, and R resets. Keyboard shortcuts live in Settings, and `?` opens full control help from the navigation region. The header and browser title use CitiVibe without a Field guide button. Reduced motion starts paused. Ambient sound stays off until you enable it in Settings, after which mute and volume persist locally.

Settings sits on its own lower-left button inside the city and opens above it without dimming or blocking the map. The bottom toolbar holds Pause, Tour, and Fullscreen, plus Previous and Next view buttons during reduced-motion guided tours. Pick `Weather -> Snow` while the city runs to watch snow build up and later melt in warmer presets; rain fills shallow ground pools that drain and dry on their own.

Twelve junctions carry double-sided green street-name blades covering all six avenues and six cross streets, such as Rainlight Av / Orchard St, mounted on existing signal poles. Because these streets run two ways, we skipped the reference photo's "ONE WAY" plates. See the [sign design and provenance](docs/ART_AND_ASSETS.md#street-name-design---street-signs-001).

Desktop and laptop screens are the priority, with layout checks at 1024, 1440, and 1920 px widths. Basic responsive styles remain in place, though mobile edge cases and phone profiling are outside scope.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

If Playwright reports a missing browser, run `npx playwright install chromium` and retry. The browser suite builds and serves the production bundle on port 4178, so development hot reloads cannot reset an interaction midway through a test. If another worktree owns that port, choose an unused one with `PLAYWRIGHT_PORT=4186 npm run test:e2e`; never stop another session's server. `npm run preview` serves a production build.

## Vercel configuration (deployment separate)

The app compiles to a static single-page Vite bundle in `dist` (`npm run build` runs `tsc -b && vite build`), so any static host can serve it. `vercel.json` sets the Vite preset, routes unknown paths back to `/index.html` with revalidation, caches hashed `/assets/*` files immutably for one year and `/city/*` files for one day, and sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: SAMEORIGIN`.

For a future explicitly authorized deployment, import the repository at [vercel.com/new](https://vercel.com/new); no environment variables or settings changes are needed. Vercel reads the Node version from the `engines` field in `package.json`. A one-off preview can use `npx vercel`, or production can use `npx vercel --prod`, only when that deployment is requested. Retaining this configuration or pushing the PR is not a deployment claim.

## Repository map

```text
AGENTS.md                     Root operational source of truth
src/app/                      Accessible control layer and static fallback
src/content/                  Original versioned semantic content and route
src/world/                    Procedural art, simulation, camera, input, lifecycle
public/city/                  Original static illustration only
tests/                        Browser interaction and accessibility checks
docs/                         Product, experience, architecture, art, roadmap, evidence
research/findings.json         Curated, evidence-labeled findings
research/import-manifest.json  Exact imported file inventory, sizes, SHA-256 hashes
research/raw/                 Three unchanged JSON captures; mixed historical content
research/reference-images/    Four analysis-only captures; commercial elements excluded
research/excluded-scope/      Four commerce-heavy images and historical notes
```

All **11 supplied artifacts** are preserved: three JSON files and eight screenshots, totaling **3,004,002 bytes**. The excluded archive exists for historical completeness, not as a backlog. The raw JSON also contains historical commercial text; its presence does not authorize implementing it.

## Implementation boundary

The connected-city slice expands the M1-M5 foundation; it does not claim to simulate everything in NYC. Richer transit, service schedules, and waterfront activity remain future possibilities. Weather physics is a local, deterministic approximation: surface accumulation/melting advances at 60 times ordinary simulation time so changes are visible during a visit; particle travel uses ordinary simulation seconds. Snow/water persist through preset changes and graphics recovery, not page reloads. Weather is fictional, never fetched from a live service.

First-visit appearance starts at Sunny/Afternoon with sound off, rendering at up to 1.25x DPR in `Automatic` mode (1.5x in `High detail`, 1.0x in `Lightweight`). Quality selection works today, while automatic frame-time fallback, physical-device FPS profiling, assistive-technology checks, and long-session soak tests remain open. No meteorological-accuracy or production-readiness claim is made.

Screenshots are attributed research references from Opportunity.city, associated with creator Leonardo Gomes Cardoso / @leocardz. No license to reuse the source artwork, branding, fonts, model, or code is established. Never ship research captures as runtime assets or trace the original city. See [provenance and limitations](docs/SOURCES.md).
