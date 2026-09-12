# LivingCity

An original, interactive miniature city for exploring or leaving on a second screen: traffic, pedestrians, aerial activity, distinctive architecture, changing light and weather, optional ambient sound, and controls that put the viewer in charge.

**Current status: implementation paused for reflection on 2026-09-12.** Rainlight Square is an original interactive garden district, built with React, strict TypeScript, Vite, and direct Three.js. The M1-M3 foundation and M4 control work include camera orbit/pan/zoom, landmark focus, tours/guided views, pause, settings, fullscreen/expanded view, a static fallback, and deterministic street activity. Camera-follow features and the drone were removed at the user's request. Environment/audio and occasional-airplane modules are not yet connected to the live experience. The NYC-inspired visual pass remains unimplemented. See the [roadmap](docs/ROADMAP.md) and [verification record](docs/ACCEPTANCE_CRITERIA.md). The supplied research captured on **2026-09-12** remains inert reference; the original website's model and source code are not included.

## GitHub destination

The canonical GitHub destination is [ccastrotrejo/CitiVibe](https://github.com/ccastrotrejo/CitiVibe). The earlier documentation push authorization was separate from the subsequent explicit request to implement M1, M2, and M3. No deployment or application push is implied.

The local checkout remains `/Users/carloscastro/Desktop/LivingCity`; do not rename the Desktop folder or project. The ambient-only product scope below is unchanged.

## Product boundary

The user's direction is a city that is "dynamic," has "lots of user controls," and "feels alive," without the directory or marketing side of the reference. The reference is [opportunity.city](https://opportunity.city/); the new city must have its own composition, architecture, identity, and assets.

In scope: camera exploration, original landmark focus, ordinary street activity, contextual tours, believable routes, pause/resume, day/night and simulated weather, optional sound, quality settings, fullscreen, responsive controls, keyboard access, reduced motion, and a useful noncommercial rendering fallback. Actor camera-follow and drones are excluded. Occasional airplane activity and an original NYC-inspired visual direction are authorized roadmap goals, not finished live features.

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

Open the local URL printed by Vite. Drag to pan; Command/Control-drag or right-drag to rotate and tilt; scroll to zoom. All map edges are reachable, with safe outer bounds. The visible camera buttons offer the same controls. Focus the navigation region for shortcuts, including Q/E for rotation, W/S for tilt, and R for reset. The Field guide explains the controls. Reduced motion starts paused. Ambient sound stays off until you enable it from Settings (a deliberate user gesture); mute and volume then persist locally.

The supported priority is **desktop and laptop computers**. Browser layout checks target 1024, 1440, and 1920 px widths. Basic responsive styles remain, but mobile edge cases and physical-phone testing are outside the current request.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

If Playwright reports a missing browser, run `npx playwright install chromium` and retry. The browser suite builds and serves the production bundle on port 4178, so development hot reloads cannot reset an interaction midway through a test. `npm run preview` serves a production build.

## Deploy to Vercel

The app is a static single-page Vite build with no backend, so any static host works; `vercel.json` configures Vercel directly:

- **Framework preset:** Vite
- **Build command:** `npm run build` (runs `tsc -b && vite build`)
- **Output directory:** `dist`
- **Rewrites:** all paths fall back to the app shell

Import the repository at [vercel.com/new](https://vercel.com/new) and deploy — no environment variables or settings changes are needed. Vercel reads the Node version from the `engines` field in `package.json`. For a one-off deploy from a local checkout, run `npx vercel` (preview) or `npx vercel --prod` (production).

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

M1-M3 cover the original district and core activity. M4 tours, guided views, motion/hint preferences, and fullscreen/expanded controls are implemented; broader M4 browser-policy coverage is still needed. Weather/time, audio and airplane integration, quality selection/adaptation, the NYC visual pass, and complete desktop/long-session hardening remain unfinished. First-visit appearance is fixed Sunny/Afternoon, with DPR capped at 1.5. Do not resume new feature work until the user ends the reflection pause. No claim of physical-device FPS or production readiness is made.

Screenshots are attributed research references from Opportunity.city, associated with creator Leonardo Gomes Cardoso / @leocardz. No license to reuse the source artwork, branding, fonts, model, or code is established. Never ship research captures as runtime assets or trace the original city. See [provenance and limitations](docs/SOURCES.md).
