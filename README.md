# CitiVibe

An original, interactive miniature city for exploring or leaving on a second screen: traffic, pedestrians, aerial activity, distinctive architecture, changing light and weather, optional ambient sound, and controls that put the viewer in charge.

**Current work: a larger NYC-inspired city and park with retained weather physics and compact settings.** Rainlight Square spans a 220 x 340 m map with six avenues, six cross streets, thirty-six intersections, twenty-four surrounding blocks and 94 buildings. The park is trimmed to 78 x 176 m, about 10% smaller per dimension than the first expanded layout, making more room for city streets and buildings. It retains a reservoir running loop, lawns, woodland, a lake and pale bridge, and a tree-lined mall leading to a fountain terrace. Eighteen visitors walk through real gates to the surrounding sidewalks; twelve runners circulate around the reservoir. The busier streets have 36 motor vehicles, twelve cyclists and 48 sidewalk walkers. Park-side two-way tracks carry opposing riders, paired arrows and a direction divider. At Juniper Court, four basketball players move through drives, passes, shots and rebounds beside a distinctly smaller pickleball court, where two players reposition to meet the rally. The games are bounded ambient animation, not interactive sports. The total is 132 people/vehicle rigs plus two sports balls. The title overlay is removed so it no longer covers the city.

React, strict TypeScript, Vite, and direct Three.js remain the stack. Camera controls, tours, pause, weather/time, optional sound, quality settings, fullscreen, and the occasional airplane remain intact. Camera-follow features and drones remain excluded. See the [NYC research and image references](docs/NYC_CITY_RESEARCH.md), [roadmap](docs/ROADMAP.md), and [verification record](docs/ACCEPTANCE_CRITERIA.md). Reference photographs inform original geometry only; no source-site model, photo, map or branded artwork is shipped.

The incoming weather extension adds Snow and Windy alongside existing presets, wind-driven precipitation and foliage, rooftop impacts, growing snow depth on roofs/streets/canopies, rain-fed ground pools, a 0-30 mm/h rain-intensity control, wet surfaces, garden ripples, and cautious wet/snowy traffic. Its compact non-modal Settings dock preserves access to the city. See the [physics research and limitations](docs/WEATHER_PHYSICS_RESEARCH.md).

**Verification boundary:** the feature checkpoint's 248 tests and main's weather checkpoints were recorded before this merge. They are not a combined passing result. Final merged checks and browser/visual acceptance remain pending; the browser-startup/navigation failures are recorded explicitly in [acceptance criteria](docs/ACCEPTANCE_CRITERIA.md).

## GitHub destination

The canonical GitHub destination is [ccastrotrejo/CitiVibe](https://github.com/ccastrotrejo/CitiVibe). The latest user request authorizes finishing the work, merging latest main, resolving conflicts and updating the existing [PR #2](https://github.com/ccastrotrejo/CitiVibe/pull/2), not creating a duplicate. Deployment is separate and is not requested.

The local checkout remains `/Users/carloscastro/Desktop/LivingCity`; do not rename the Desktop folder or project. The ambient-only product scope below is unchanged.

## Product boundary

The user's direction is a city that is "dynamic," has "lots of user controls," and "feels alive," without the directory or marketing side of the reference. The reference is [opportunity.city](https://opportunity.city/); the new city must have its own composition, architecture, identity, and assets.

In scope: camera exploration, original landmark focus, ordinary street activity, contextual tours, believable routes, pause/resume, day/night and simulated weather, optional sound, quality settings, fullscreen, responsive controls, keyboard access, reduced motion, and a useful noncommercial rendering fallback. Actor camera-follow and drones are excluded. The neighborhood uses original architecture and fictional streets, not NYC GIS or copied landmarks.

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

Settings has its own lower-left button inside the city. Its compact dock opens above it without dimming or blocking the world; landmark navigation now lives in the bottom toolbar. Choose **Weather → Snow** and keep the city running to accumulate depth. Snow melts in warmer weather; rainfall and runoff fill the shallow ground pools, which drain and dry gradually. Rain intensity is available for Rain and natural weather. Sound still requires explicit permission each visit.

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
