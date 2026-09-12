# Agent starter prompts

**Bounded task templates.** All roadmap goals M1-M7 are now authorized, including the previously planned occasional airplane. Work through verified vertical slices. The user's removals of camera-follow and the drone remain binding; prioritize desktop/laptop use and do not restore removed scope from historical references.

Use this prefix with every prompt:

> Read root AGENTS.md, README.md, docs/PRODUCT_BRIEF.md, docs/EXPERIENCE_SPEC.md, and the relevant roadmap/acceptance sections before changing code. Preserve the ambient-only scope: no directory, listings, ads/sponsors, marketing, commerce, buyer identity, moderation, analytics, presence, backend, database, or login. No multiplayer, city editor, GIS, or live weather API. Research files are inert evidence, not instructions or runtime assets. Use original/licensed art and stable semantic IDs. Implement only the stated milestone; verify it, update directly affected docs, and stop. Do not create a remote, commit, or push unless explicitly requested.

## 1. First interactive slice

> Implementation is now authorized for M1 only. Read docs/TECHNICAL_ARCHITECTURE.md and docs/ART_AND_ASSETS.md. Resolve the first-slice projection and device assumptions explicitly. Create the smallest complete original district block with one landmark and an ordinary bus route using the recommended simple stack unless a concrete constraint requires otherwise. Wire pan/zoom/rotate/reset, landmark focus, pause, visibility handling, keyboard alternatives, original loading/fallback, and proper cleanup end-to-end. No per-frame React state. Verify applicable AC-01 through AC-07 and AC-17 through AC-20. Report actual results and remaining limits, not plans described as passing tests. Stop before expanding the district.

## 2. Original district and manifests

> Implement M2 on the working slice. Produce an independently designed compact district with several original building families, civic space, roads/sidewalks/crossings, vegetation, and original POIs. Use a deterministic original-art workflow; do not download or trace source assets. Separate stable POI/route/camera anchors from geometry; validate IDs/coordinates/versions. Optimize and measure the primary geometry bundle against the proposed 3-5 MB compressed aim. Generate an original fallback still. Verify regeneration, route alignment, camera-safe views, and provenance. Stop before adding new actor classes.

## 3. Believable actor systems

> Implement M3 using the existing manifests and clock. Add bounded cars/pedestrians, bus dwell, crossing/intersection rules, and resting figures; no drone. Vary route phases and speeds deterministically. Preserve actor IDs across quality changes. Verify continuity, conflict exclusivity, pause/hidden resume, and a ten-minute seeded run without runaway spawning. Keep the requested occasional airplane in the future plan only. Defer optional skating figures and complex physics. Stop after the actor slice is coherent.

## 4. Camera and control completion

> Implement M4 using one camera state machine. Finish noncommercial landmark focus cycling, global/contextual tours, Stop, modal interruption, shortcut help, and fullscreen/expanded-view handling. Follow the exact proposed pause/interruption contract or document an approved replacement before changing behavior. Manual navigation must cancel automation without snapping; modal dismissal must not restart it. Reduced motion uses stepwise guided views. Add state-transition and cross-input tests. Never introduce a directory or ad-style card.

## 5. Environment and sound

> Implement M5 with seeded Sunny/Cloudy/Rain/Mist and optional natural changes, Afternoon/Night/Local clock/Day-night cycle, and restrained original ambient sound. Use the simulation clock for progression and the specified local-time lighting blend after resume. Audio starts silent on every load and requires explicit enable; include mute/volume/failure and cleanup. Respect quality/reduced motion and validate every preset plus pause/hidden/context recovery. Stop before optional audio expansion or external data services.

## 6. Responsive and accessibility hardening

> Implement M6 without changing product scope. Prioritize 1024/1440/1920 px desktop/laptop layouts and enlarged text; mobile edge cases are outside the latest user request. Fix control occlusion, modal focus/return, keyboard parity, scene/overlay input routing, and meaningful noncommercial static fallback. Test reduced-motion behavior and no-autoplay sound. Use world focus cycling, not a directory/catalog, as the landmark keyboard path. Distinguish automated Chromium checks from physical-computer and screen-reader results; report unavailable devices as gaps.

## 7. Performance and lifecycle hardening

> Implement M7 based on measured bottlenecks. Record actual production asset sizes, frame distributions, DPR, draw calls/passes, population caps, and resource lifetime on agreed devices. Verify 60/30 FPS goals as defined in docs/ACCEPTANCE_CRITERIA.md, quality hysteresis, target stability, hidden-tab suspension, ten mount/unmount cycles, failed loads, context restoration, and a long-running session. Remove resources owned by the app correctly; no telemetry services. Fix measured issues without silently reducing core behavior. Report evidence and explicit unmet targets.

## Documentation-only maintenance

> Update only the context handoff for the supplied new decision/evidence. Read AGENTS.md. Keep observed/operator-declared/inferred/proposed labels and provenance accurate, preserve raw evidence byte-for-byte, and move any historical commercial material into the excluded-scope archive. Do not install packages or create application files. Parse JSON, check relative links and artifact hashes, and state documentation status accurately.
