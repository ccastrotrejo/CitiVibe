# CitiVibe

An original, interactive miniature city for exploring or leaving on a second screen: traffic, pedestrians, aerial activity, distinctive architecture, changing light and weather, optional ambient sound, and controls that put the viewer in charge.

**NYC is the continuing visual direction.** The building-fabric pass closes 57 incidental gaps into narrow party-wall joints, connecting 75 of the existing 94 buildings into denser groups. The neighborhood now distinguishes **19 office buildings**, **32 buildings with ground-floor stores**, and **43 residential buildings**. Offices have broad glazing, masonry or curtain-wall elevations and glazed lobbies; stores have display windows, transoms, goods, canopies and separate upper-floor entrances. Meaningful planted openings, subway approaches, bicycle access, sidewalks and courts remain clear. The [research and real NYC photo references](docs/NYC_BUILDING_FABRIC_RESEARCH.md) distinguish verified source guidance from design interpretation; no reference photograph or branding is shipped in the application.

**Park scenery refinement:** the pond bridge now has a continuous shallow arch, curved dark railings and stone landings, ending before the fountain instead of running through it. A hollow, rimmed fountain and two complete timber pergolas replace the stacked disks and bare frames. Shallow-to-deep pond colors, clustered reeds, shoreline rocks and lily pads retain the original miniature style. Paths, gates, people, weather and controls are unchanged; the bridge remains scenery, not a new walking route. See [art details](docs/ART_AND_ASSETS.md#lakeside-refinement---2026-09-14) and [verification limits](docs/ACCEPTANCE_CRITERIA.md#lakeside-refinement---2026-09-14).

**Controls update:** landmark selection is removed, including the "Find a quiet place" bar, map clicks, bracket shortcuts, highlights and landmark-specific tours. Manual camera controls, the six-view city-wide tour and reduced-motion guided views remain. The original buildings, park, courts and street signs are unchanged.

**Current work: denser street life and two-way sidewalk walking.** The original city gains curbside parked cars, sidewalk food carts, rounded blue mailboxes, more street/park benches, varied building facades and shared-blue bicycle stations. These are original unbranded models informed by the supplied photographs and [independently verified references](docs/NYC_CITY_RESEARCH.md#street-life-reference-study---2026-09-13), not copied assets or commercial features. The existing grid, car-free park, courts, signals, street names, weather, lighting and controls remain.

Neighborhood walkers travel in both directions on the same sidewalks, retaining seeded destinations, varied trip paces, brief rests and real zebra-crossing trips. Locally widened building-side paving and adjusted fixtures keep both full body envelopes clear. Vehicles and bicycles remain stopped until a crossing and its landing clear. Block capacity and bounded waiting keep a blocked destination from freezing a sidewalk. See [people, behavior and research](docs/PEOPLE_AND_ACTIVITY.md).

Rainlight Square now has **277 people**: 168 neighborhood walkers, 48 park walkers, 24 runners, twelve road cyclists, six court players, eight meadow family figures, three bike-station users and eight resting picnic neighbors. **48 moving motor vehicles** circulate outside the park; twelve parked cars occupy the spare non-cycling curbs. Four cabless food carts stand in clear sidewalk corner pockets, with counters, striped canopies and food displays. Six new mailboxes and eighteen additional benches add street-level detail. Thirteen fictional work roles and independent ages, skin tones, statures, builds, clothes and accessories remain. The older target of **464 people** remains a separate [planned task](docs/ROADMAP.md#next-planned-task---double-the-people), not an implemented doubling.

Three unbranded bike stations each have **ten bicycles and eleven side-by-side docks**, including beside Juniper Court. Classic blue bikes now mix with silver electric bikes with heavier step-through frames, battery housings, handlebar displays and larger front lamps. Docked and ridden versions retain the same bike type; both pedal on the controlled routes. The existing three station riders walk their bikes to the cycle lanes and return to their own stations, leaving nine bikes docked while one is away. Juniper's former indefinite departure wait is replaced by a retained crossing reservation that lets existing traffic and walkers clear, then holds approaching bodies until the rider clears. Hands follow the actual moving bicycle instead of pointing toward the first dock. See the [bike research](docs/NYC_CITY_RESEARCH.md#classic-and-electric-shared-bikes---2026-09-16) and [activity contract](docs/PEOPLE_AND_ACTIVITY.md). No brands, rentals, payments or new actors are added.

The 220 x 340 m city retains its six-by-six street grid, 94 buildings, 78 x 176 m car-free park, reservoir running loop, protected two-way cycling, compact subway entrances and full-size basketball/pickleball courts. Commuters generally have a brisker desired pace than sightseeing walkers; queues still take priority. Runners wear shorts, exposed lower legs, socks and trainers, with shorter strides for shorter figures. Six children play in separate small meadow circuits near two guardians. The title overlay remains removed; existing camera, weather, pause and sound controls are unchanged.

React, strict TypeScript, Vite, and direct Three.js remain the stack. Camera controls, tours, pause, weather/time, optional sound, quality settings, fullscreen, and the occasional airplane remain intact. Camera-follow features and drones remain excluded. See the [NYC research and image references](docs/NYC_CITY_RESEARCH.md), [roadmap](docs/ROADMAP.md), and [verification record](docs/ACCEPTANCE_CRITERIA.md). Reference photographs inform original geometry only; no source-site model, photo, map or branded artwork is shipped.

**Night-lighting follow-up:** [sixteen-source lighting research](docs/LIGHTING_RESEARCH.md) informs softer street/park illumination, restrained source halos and bounded local spotlights. Every motor vehicle now has headlights, red tail/brake lamps and route-driven amber indicators; bicycles, taxi roof signs and subway globes also light after dark. Vehicle windows no longer glow like apartments. Rain/mist/snow can activate driving lights by day. Pause and recovery retain light state; reduced motion holds indicators steady. These are physically informed miniature effects, not calibrated lighting or traffic certification.

Juniper Court has six inward-facing, twin-head light poles: four around basketball and two around pickleball. Soft overlapping illumination switches on at dusk, with poles outside both runoff areas and the shared walking passage.

The merged weather extension adds Snow and Windy alongside existing presets, wind-driven precipitation and foliage, rooftop impacts, growing snow depth on roofs/streets/canopies, rain-fed ground pools, a 0-30 mm/h rain-intensity control, wet surfaces, garden ripples, and cautious wet/snowy traffic. Its compact non-modal Settings dock preserves access to the city. See the [physics research and limitations](docs/WEATHER_PHYSICS_RESEARCH.md).

**Verification boundary:** earlier merge results are historical, not verification of later changes. Earlier isolated in-memory WebKit rendering succeeded, but the current bounded retry timed out; the standard Chromium browser suite still fails during startup. Current results and limitations are recorded in [acceptance criteria](docs/ACCEPTANCE_CRITERIA.md). Stable served-browser, physical-device frame-rate and long-session sign-off remain outstanding.

## GitHub destination

The canonical GitHub destination is [ccastrotrejo/CitiVibe](https://github.com/ccastrotrejo/CitiVibe). The city expansion landed in [PR #2](https://github.com/ccastrotrejo/CitiVibe/pull/2), population diversity in [PR #5](https://github.com/ccastrotrejo/CitiVibe/pull/5), and city/vehicle lighting in [PR #7](https://github.com/ccastrotrejo/CitiVibe/pull/7) at main `06ecb95`. The street-sign and controls branch integrates these changes in [PR #6](https://github.com/ccastrotrejo/CitiVibe/pull/6), with remaining browser/performance limitations documented. Deployment is not part of this request.

The local checkout remains `/Users/carloscastro/Desktop/LivingCity`; do not rename the Desktop folder or project. The ambient-only product scope below is unchanged.

## Product boundary

The user's direction is a city that is "dynamic," has "lots of user controls," and "feels alive," without the directory or marketing side of the reference. The reference is [opportunity.city](https://opportunity.city/); the new city must have its own composition, architecture, identity, and assets.

In scope: camera exploration, ordinary street activity, city-wide tours, believable routes, pause/resume, day/night and simulated weather, public street/park lighting and varied lit windows at night, optional sound, quality settings, fullscreen, responsive controls, keyboard access, reduced motion, and a useful noncommercial rendering fallback. Actor camera-follow and drones are excluded. The neighborhood uses original architecture and fictional streets, not NYC GIS or copied landmarks.

**Out of scope:** directories and listings; advertiser or sponsored placements; ad cards and monetized signs/billboards; marketing and commercial landing-page sections; payments, auctions, bidding, checkout, buyer identities or purchase recovery; ad moderation, advertiser analytics and business metrics. The scoped MVP needs **no backend, database, login, commerce, presence service, or analytics**. Multiplayer, city editing, real GIS, and live weather APIs also remain excluded unless the user explicitly changes scope. Accessibility is not a reason to add a directory.

## Agent reading order

1. [AGENTS.md](AGENTS.md) - operational rules and precedence.
2. [Product brief](docs/PRODUCT_BRIEF.md) - scope, intended experience, success conditions.
3. [Experience specification](docs/EXPERIENCE_SPEC.md) - proposed interaction and lifecycle behavior.
4. [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md) and [art/assets](docs/ART_AND_ASSETS.md) - recommended implementation boundaries and original asset pipeline.
5. [Roadmap](docs/ROADMAP.md) and [acceptance criteria](docs/ACCEPTANCE_CRITERIA.md) - bounded milestones and verification targets.
6. [Reference analysis](docs/REFERENCE_ANALYSIS.md), [sources](docs/SOURCES.md), and [research catalog](research/README.md) - evidence, caveats, and attribution.

The [agent starter prompts](docs/AGENT_STARTER_PROMPTS.md) remain bounded templates. Implement only authorized milestones.

## Run locally

Use Node.js 22.12+ or 24+ and npm. Exact dependency versions are recorded in `package-lock.json`.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Drag to pan; Command/Control-drag or right-drag to rotate and tilt; scroll to zoom. All map edges are reachable, with safe outer bounds. The visible camera buttons offer the same controls. Focus the navigation region for shortcuts, including Q/E for rotation, W/S for tilt, and R for reset. Keyboard shortcuts are available in Settings; `?` opens full control help from the navigation region. The header and browser title use CitiVibe, without a Field guide header button. Reduced motion starts paused. Ambient sound stays off until you enable it from Settings (a deliberate user gesture); mute and volume then persist locally.

Settings has its own lower-left button inside the city. Its compact dock opens above it without dimming or blocking the world. The bottom toolbar contains Pause, Tour and Fullscreen, plus explicit Previous/Next view controls during reduced-motion guided tours. Choose **Weather → Snow** and keep the city running to accumulate depth. Snow melts in warmer weather; rainfall and runoff fill the shallow ground pools, which drain and dry gradually. Rain intensity is available for Rain and natural weather. Sound still requires explicit permission each visit.

The first street-name design adds NYC-inspired **green, double-sided blades** to twelve key junctions, covering all six avenues and six cross streets. Zoom toward a park corner to see original names such as **Rainlight Av / Orchard St**, white lettering, metal edges and mounting collars on the existing signal poles. These roads remain two-way, so the photo's “ONE WAY” plates are intentionally not copied. The grid, traffic, park and controls are unchanged; see the [sign design and provenance](docs/ART_AND_ASSETS.md#street-name-design---street-signs-001).

The supported priority is **desktop and laptop computers**. Browser layout checks target 1024, 1440, and 1920 px widths. Basic responsive styles remain, but mobile edge cases and physical-phone testing are outside the current request.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

If Playwright reports a missing browser, run `npx playwright install chromium` and retry. The browser suite builds and serves the production bundle on port 4178, so development hot reloads cannot reset an interaction midway through a test. If another worktree owns that port, choose an unused one with `PLAYWRIGHT_PORT=4186 npm run test:e2e`; never stop another session's server. `npm run preview` serves a production build.

## Vercel configuration (deployment separate)

The app is a static single-page Vite build with no backend, so any static host works; `vercel.json` configures Vercel directly:

- **Framework preset:** Vite
- **Build command:** `npm run build` (runs `tsc -b && vite build`)
- **Output directory:** `dist`
- **Rewrites:** all paths fall back to the app shell
- **Caching:** hashed `/assets/*` files use one-year immutable caching; `/city/*` illustrations use a one-day cache; `/index.html` must revalidate.
- **Response headers:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: SAMEORIGIN`.

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

First-visit appearance remains Sunny/Afternoon with sound off and DPR capped at 1.5. Quality selection is implemented, but Automatic runtime calibration, final merged/browser verification, physical-device FPS, assistive-technology checks, and long-session hardening remain outstanding. The requested original world/detail pass does not imply completion of a broader desktop UI redesign. No meteorological-accuracy or production-readiness claim is made.

Screenshots are attributed research references from Opportunity.city, associated with creator Leonardo Gomes Cardoso / @leocardz. No license to reuse the source artwork, branding, fonts, model, or code is established. Never ship research captures as runtime assets or trace the original city. See [provenance and limitations](docs/SOURCES.md).
