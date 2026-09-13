# Product brief

**Status:** connected-city expansion explicitly authorized on 2026-09-12, starting from the live M1-M5 main branch. The new request adds multiple streets, signal-controlled intersections, varied road traffic, protected cycling paths, and NYC-inspired detail around Rainlight Square. Research identifies additional possibilities without turning them all into promised features. User scope is binding.

## Purpose

LivingCity is an original miniature city that rewards both attention and inattention. A viewer can explore for a few minutes, watch a bus go by, watch the light change, or leave it open beside their work. It is a small animated place, not a directory, ad platform, game economy, or conventional scrolling landing page.

The user's central request is "everything else" from the reference's world experience, excluding its directory and marketing side: dynamic activity, many useful controls, and a city that feels alive. "Everything else" does not imply copying every implementation detail or adding systems the reference does not establish.

## Audience and use

Primary use is a calm second-screen environment for people working, studying, or relaxing. A secondary use is intentional exploration of an attractive small world. Both require a fast path from launch to a comprehensible scene, restrained chrome, and an obvious way to stop movement or sound.

The user's latest platform direction is **primarily computers**, with no mobile-edge-case work. Desktop/laptop composition, mouse/trackpad use, and keyboard access take priority. Basic reflow is useful but is not a commitment to phone-specific support or profiling.

No account, transaction, identity, location permission, or network service should stand between the viewer and the world. The optional local-clock mode uses device time, not geolocation. Weather is fictional and controlled locally.

## What "feels alive" means

| Layer | Concrete behavior | Avoid |
| --- | --- | --- |
| Routes | Vehicles and walkers follow connected paths at varied but coherent speeds. Routes have visible destinations or loops. | Random jitter, synchronized clones, actors teleporting across visible joins. |
| Street rules | Road vehicles and cyclists queue at signals; conflicting movements take turns; park visitors pause and yield at shared paths. | Overlapping traffic, permanent deadlock, or cars entering the park. |
| Human scale | People sit or walk, and cyclists use the protected neighborhood paths. | Simulating every activity type before the basic streets are convincing. |
| Micro-animation | Small wheel motion, gentle tree or flag movement, fountain detail, rooftop activity. | Constant bobbing on every object, large distracting motion, gratuitous effects. |
| Environment | Gradual light, cloud, rain, and mist changes; lighting cues respond to the selected time. | Abrupt automatic changes, mandatory weather, live data dependency. |
| Occasional events | Park visitors pause near the pergola. A distant airplane passes with seeded gaps. | Drones, frequent surprises, notifications, explosions, objectives, or attention demands. |
| Viewer agency | Manual exploration, original landmark focus, tours, pause, quality and sound controls. | A camera that fights input, sound without permission, hidden controls. |

**Population policy:** 68 moving actors: four street buses, twenty other street vehicles, twelve cyclists, twenty-four neighborhood walkers, and eight park visitors. The former central bus/car loop is explicitly removed. The park has no motor traffic or cycling; visitors use shared path geometry and enter/leave through connected gates. Street buses currently circulate without scheduled stops, and neighborhood walkers do not cross roads. Motorcycles, skateboarders, rollerskaters, and balloons remain possible later refinements. No drone or camera-follow action is authorized.

## Essential experience

The city is the main surface. A compact control system provides movement, zoom, rotation/reset, landmark focus cycling, tour, pause, weather/time, sound, quality, fullscreen, and help. Controls can be grouped into panels, but core pause and navigation remain available without hunting through a menu.

Landmarks are original noncommercial places, such as a civic observatory or rain garden. Selecting one gives a concise name/description and a view action. It does not open a brand card, website link, searchable location catalog, availability inventory, or booking workflow. Street actors are not selectable camera-follow targets. The removed drone must not be reintroduced through a later milestone.

The [experience specification](EXPERIENCE_SPEC.md) defines consistent proposed behavior, including what freezes when paused, what manual interaction cancels, and what happens after a hidden tab.

## Success conditions

The first slice succeeds when a viewer can understand the city, explore it using pointer or keyboard, focus one landmark, watch a moving bus, and pause/resume without jumps. Failure to render should still produce a clear, useful noncommercial experience.

The polished ambient experience succeeds when independent activity, architecture, environmental changes, and camera views remain interesting over a long session without demanding attention; controls stay predictable on small screens; reduced-motion and silent use are first-class; and the agreed devices meet the [acceptance targets](ACCEPTANCE_CRITERIA.md).

These are experiential and technical conditions, **not analytics KPIs**. Evaluate through local tests, profiling, and user observation with permission. Do not add tracking to measure them.

## Explicit exclusions

No directory, advertiser listings, ad cards, brand placements, sponsorships, monetized billboards, marketing features, commercial landing-page sections, payments, bidding, auctions, checkout, buyer identity or purchase recovery, ad moderation backend, advertiser analytics, or business metrics.

The MVP has no backend, database, login, commerce, analytics, or shared presence. Also excluded: multiplayer, city editing, real GIS, and a real weather API. A useful accessibility fallback is required, but it must not become a directory.

Historical commercial discoveries live only in the [excluded-scope archive](../research/excluded-scope/README.md). Ordinary environmental props may include original civic wayfinding; no advertising system is needed.

## Open decisions

M1-M3 use an original garden block named Rainlight Square, an orthographic camera, React/strict TypeScript/Vite/direct Three.js, npm, and a small token-based stylesheet. Authored TypeScript geometry is the reproducible art workflow for this slice, rather than a separate Python/GLB build. The city has a fixed bounded population; runtime artwork and simulation never use source captures. These implementation choices do not change the ambient-only scope.

**Latest art direction:** the central village is now an open, car-free urban park with a pond, bridge, low pergola, tan paths, dark railings and perimeter seating. Original NYC-inspired street walls, fire escapes, roof tanks, protected cycling, transit entrances and public spaces surround it. Image research informs yellow signal housings, bicycle/runner pavement symbols, yellow cabs, brownstones and sidewalk sheds. The runner stencil is an original functional choice, not a verified NYC marking. Existing light desktop controls remain, with a readable heading surface across weather/time modes. This is a fictional miniature, not literal GIS, famous-building replicas, company branding or advertising. A broader charcoal/transit-style UI redesign remains separate.

The following table retains later decisions and physical-device gaps. Headless Chromium is not a reference laptop or phone.

| Decision | Working proposal | When to confirm |
| --- | --- | --- |
| City identity and art direction | Rainlight Square: cream/terracotta/teal forms, copper-roofed pavilion, terrace steps, and reed garden. LivingCity remains the application name. | Chosen for M1-M3. |
| Projection | Orthographic camera with bounded target, zoom, and rotation. | Chosen for M1-M3. |
| Performance devices | One named reference desktop/laptop; physical-device results remain unverified. Mobile profiling is no longer a milestone gate. | Before promising frame-rate targets. |
| Population and event density | 68 moving actors, static resting figures, and at most one occasional airplane; deterministic variation, no unbounded spawning. | Connected-city slice implemented; device tuning remains future work. |
| Audio method | Small synthesized ambience initially; original/licensed clips only if they materially improve it. | Audio milestone. |
| Default time | Fixed afternoon on first visit; optional device clock and accelerated cycle. | First environment implementation. |
| Package versions and hosting | Exact versions are in the npm lockfile; existing Vercel static-host configuration is retained. | Pull request authorized; deployment is not part of this slice. |

Rough effort assumptions are in the [roadmap](ROADMAP.md); none are claims about how long the reference took to build.
