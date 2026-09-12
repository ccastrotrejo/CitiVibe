# Product brief

**Status:** scoped product direction and proposed design, not an implemented application. User scope is binding; exact mechanics and numerical budgets are proposals.

## Purpose

LivingCity is an original miniature city that rewards both attention and inattention. A viewer can explore for a few minutes, ride along with a bus, watch the light change, or leave it open beside their work. It is a small animated place, not a directory, ad platform, game economy, or conventional scrolling landing page.

The user's central request is "everything else" from the reference's world experience, excluding its directory and marketing side: dynamic activity, many useful controls, and a city that feels alive. "Everything else" does not imply copying every implementation detail or adding systems the reference does not establish.

## Audience and use

Primary use is a calm second-screen environment for people working, studying, or relaxing. A secondary use is intentional exploration of an attractive small world. Both require a fast path from launch to a comprehensible scene, restrained chrome, and an obvious way to stop movement or sound.

No account, transaction, identity, location permission, or network service should stand between the viewer and the world. The optional local-clock mode uses device time, not geolocation. Weather is fictional and controlled locally.

## What "feels alive" means

| Layer | Concrete behavior | Avoid |
| --- | --- | --- |
| Routes | Vehicles and walkers follow connected paths at varied but coherent speeds. Routes have visible destinations or loops. | Random jitter, synchronized clones, actors teleporting across visible joins. |
| Street rules | Cars slow at stops; a bus dwells; pedestrians wait at a crossing; conflicting movements take turns. | Every actor moving continuously, overlapping traffic at intersections. |
| Human scale | A few people sit, gather, pause, or pass through a plaza; later add cyclists and other small mobility types. | Simulating every activity type before the basic streets are convincing. |
| Micro-animation | Small wheel motion, gentle tree or flag movement, fountain detail, rooftop activity. | Constant bobbing on every object, large distracting motion, gratuitous effects. |
| Environment | Gradual light, cloud, rain, and mist changes; lighting cues respond to the selected time. | Abrupt automatic changes, mandatory weather, live data dependency. |
| Occasional events | A drone crosses, a bus arrives, or a distant aircraft passes with seeded gaps. | Frequent surprises, notifications, explosions, objectives, or attention demands. |
| Viewer agency | Manual exploration, original landmark focus, actor follow, tours, pause, quality and sound controls. | A camera that fights input, sound without permission, hidden controls. |

**Proposed population progression:** start with one bus, then cars and pedestrians, then a drone and a few stationary people. Cyclists, motorcycles, skateboarders, rollerskaters, balloons, and an airplane are optional later ambient variety, not a required launch checklist. Reserve enough quiet space to make activity readable.

## Essential experience

The city is the main surface. A compact control system provides movement, zoom, rotation/reset, landmark focus cycling, follow, tour, pause, weather/time, sound, quality, fullscreen, and help. Controls can be grouped into panels, but core pause and navigation remain available without hunting through a menu.

Landmarks are original noncommercial places, such as a civic observatory or rain garden. Selecting one gives a concise name/description and a view action. It does not open a brand card, website link, searchable location catalog, availability inventory, or booking workflow. Following an ordinary bus or drone exposes target status and a stop action.

The [experience specification](EXPERIENCE_SPEC.md) defines consistent proposed behavior, including what freezes when paused, what manual interaction cancels, and what happens after a hidden tab.

## Success conditions

The first slice succeeds when a viewer can understand the city, explore it using pointer or keyboard, focus one landmark, follow one bus, and pause/resume without jumps. Failure to render should still produce a clear, useful noncommercial experience.

The polished ambient experience succeeds when independent activity, architecture, environmental changes, and camera views remain interesting over a long session without demanding attention; controls stay predictable on small screens; reduced-motion and silent use are first-class; and the agreed devices meet the [acceptance targets](ACCEPTANCE_CRITERIA.md).

These are experiential and technical conditions, **not analytics KPIs**. Evaluate through local tests, profiling, and user observation with permission. Do not add tracking to measure them.

## Explicit exclusions

No directory, advertiser listings, ad cards, brand placements, sponsorships, monetized billboards, marketing features, commercial landing-page sections, payments, bidding, auctions, checkout, buyer identity or purchase recovery, ad moderation backend, advertiser analytics, or business metrics.

The MVP has no backend, database, login, commerce, analytics, or shared presence. Also excluded: multiplayer, city editing, real GIS, and a real weather API. A useful accessibility fallback is required, but it must not become a directory.

Historical commercial discoveries live only in the [excluded-scope archive](../research/excluded-scope/README.md). Ordinary environmental props may include original civic wayfinding; no advertising system is needed.

## Open decisions

These do not block this documentation handoff. Resolve the relevant decision at the start of its implementation milestone and record changes in the appropriate spec.

| Decision | Working proposal | When to confirm |
| --- | --- | --- |
| City identity and art direction | Original compact district with contrasting low/mid-rise forms and one civic focal point; "LivingCity" is a working name. | Original district milestone. |
| Projection | Orthographic camera for the first slice; keep any later perspective experiment explicit. | First slice, before camera tuning. |
| Performance devices | One named reference laptop and one agreed midrange physical phone. | Before promising frame-rate targets. |
| Population and event density | Modest seeded populations, adjusted to art scale and profiling. | Route/actor milestone. |
| Audio method | Small synthesized ambience initially; original/licensed clips only if they materially improve it. | Audio milestone. |
| Default time | Fixed afternoon on first visit; optional device clock and accelerated cycle. | First environment implementation. |
| Package versions and hosting | Choose current compatible versions when implementation is requested; static hosting only if later requested. | Implementation/deployment, respectively. |

Rough effort assumptions are in the [roadmap](ROADMAP.md); none are claims about how long the reference took to build.
