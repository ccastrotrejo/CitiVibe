# LivingCity

An original, interactive miniature city for exploring or leaving on a second screen: traffic, pedestrians, aerial activity, distinctive architecture, changing light and weather, optional ambient sound, and controls that put the viewer in charge.

**Current status: documentation and research only.** There is no application, runnable demo, package manifest, generated city model, or implemented feature. This repository preserves the supplied research captured on **2026-09-12** and a proposed ambient-only implementation plan. It does not contain the original website's model or source code.

## Future GitHub destination

The user supplied [ccastrotrejo/CitiVibe](https://github.com/ccastrotrejo/CitiVibe) as the canonical destination for future pushes on 2026-09-12. **Recording this destination does not request a push.** Do not create a GitHub repository, clone, or configure/change Git remotes as part of this update.

The local checkout remains `/Users/carloscastro/Desktop/LivingCity`; do not rename the Desktop folder or project. The ambient-only product scope below is unchanged.

## Product boundary

The user's direction is a city that is "dynamic," has "lots of user controls," and "feels alive," without the directory or marketing side of the reference. The reference is [opportunity.city](https://opportunity.city/); the new city must have its own composition, architecture, identity, and assets.

In scope: camera exploration, original landmark focus, ordinary bus/drone follow, contextual tours, believable route activity, pause/resume, day/night and simulated weather, optional sound, quality settings, fullscreen, responsive controls, keyboard access, reduced motion, and a useful noncommercial rendering fallback.

**Out of scope:** directories and listings; advertiser or sponsored placements; ad cards and monetized signs/billboards; marketing and commercial landing-page sections; payments, auctions, bidding, checkout, buyer identities or purchase recovery; ad moderation, advertiser analytics and business metrics. The scoped MVP needs **no backend, database, login, commerce, presence service, or analytics**. Multiplayer, city editing, real GIS, and live weather APIs also remain excluded unless the user explicitly changes scope. Accessibility is not a reason to add a directory.

## Agent reading order

1. [AGENTS.md](AGENTS.md) - operational rules and precedence.
2. [Product brief](docs/PRODUCT_BRIEF.md) - scope, intended experience, success conditions.
3. [Experience specification](docs/EXPERIENCE_SPEC.md) - proposed interaction and lifecycle behavior.
4. [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md) and [art/assets](docs/ART_AND_ASSETS.md) - recommended implementation boundaries and original asset pipeline.
5. [Roadmap](docs/ROADMAP.md) and [acceptance criteria](docs/ACCEPTANCE_CRITERIA.md) - bounded milestones and verification targets.
6. [Reference analysis](docs/REFERENCE_ANALYSIS.md), [sources](docs/SOURCES.md), and [research catalog](research/README.md) - evidence, caveats, and attribution.

When implementation is requested, use a bounded [agent starter prompt](docs/AGENT_STARTER_PROMPTS.md). Those prompts are not instructions to start building now.

## Repository map

```text
AGENTS.md                     Root operational source of truth
docs/                         Product, experience, architecture, art, roadmap, evidence
research/findings.json         Curated, evidence-labeled findings
research/import-manifest.json  Exact imported file inventory, sizes, SHA-256 hashes
research/raw/                 Three unchanged JSON captures; mixed historical content
research/reference-images/    Four analysis-only captures; commercial elements excluded
research/excluded-scope/      Four commerce-heavy images and historical notes
```

All **11 supplied artifacts** are preserved: three JSON files and eight screenshots, totaling **3,004,002 bytes**. The excluded archive exists for historical completeness, not as a backlog. The raw JSON also contains historical commercial text; its presence does not authorize implementing it.

## Starting point

The first proposed [roadmap milestone](docs/ROADMAP.md) is a small, original interactive scene with one route, one moving bus, one landmark, and complete camera/pause/fallback behavior. Expand only after that vertical slice works. React + strict TypeScript + Vite + Three.js is a recommendation, not an installed or locked-in stack.

Screenshots are attributed research references from Opportunity.city, associated with creator Leonardo Gomes Cardoso / @leocardz. No license to reuse the source artwork, branding, fonts, model, or code is established. Never ship research captures as runtime assets or trace the original city. See [provenance and limitations](docs/SOURCES.md).
