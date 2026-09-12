# Reference analysis

**Reference:** [Opportunity.city](https://opportunity.city/), research captured 2026-09-12. This document explains useful world/interaction findings; it is not a clone specification. [Sources](SOURCES.md) distinguishes retained captures from supplied researcher notes, and [curated findings](../research/findings.json) provides machine-readable labels.

## Evidence limits

`observed` means UI, resource, runtime, or asset metadata inspected by the researcher. `operator-declared` includes creator statements, public policy claims, and asset-generator strings. `inferred` means a plausible explanation, not recovered implementation. `proposed` means a new implementation choice.

This handoff imported three JSON files and eight screenshots. It did not independently revisit the website. Some original research, including CSS/bundle inspection, policies, and creator posts, survives only as supplied notes and citations. No original source repository, build configuration, model file, source bundles, fonts, or generator script was retained. The retained JSON is not a full network archive.

## Runtime and stack

| Finding | Status and evidence | What it establishes |
| --- | --- | --- |
| React DOM 19.2.6 | Observed: `motion.json /diagnostics/reactRenderers`. | Registered renderer version at inspection time. |
| Three.js r185 | Observed: `observations.json /desktop/canvases` and `/desktop/threeRevision`. | Canvas engine marker and runtime revision. |
| Vinext navigation/RSC runtime | Observed markers in supplied inspection notes; retained `vary` headers contain `X-Vinext-*`, RSC and router fields. | Strong Vinext/RSC evidence, not a standard Next.js deployment conclusion. |
| Vite RSC and Rolldown | Observed in supplied bundle-inspection notes; Rolldown resource names retained in `/responses`. | Build/runtime signatures, not the complete development toolchain. |
| Tailwind CSS 4.2.1 | Observed CSS header, reported in supplied notes; dated CSS URL in [sources](SOURCES.md). | Source stylesheet tooling, not a required new dependency version. |
| Base UI and Lucide | Observed DOM/SVG markers reported in supplied notes. | UI primitives/icon usage; exact package versions not established. |
| Fly.io | Observed HTTP `server` and `via` headers in `observations.json`. | Request-serving infrastructure hints; not every service's location. |

`/_next` paths do **not** prove standard Next.js or Vercel. R3F, GSAP, a physics engine, TypeScript, the package manager, IDE/agent harness, CI, database, ORM, and object storage vendor were **not verified**. No official source repository was located in the supplied research; that is not proof one cannot exist.

**Proposed for LivingCity:** keep the browser-side strengths, but use a simpler static React + TypeScript + Vite + Three.js application. The ambient scope has no reason to reproduce RSC/server complexity. See [architecture](TECHNICAL_ARCHITECTURE.md).

## Model and asset structure

Metadata came from the public `/city/city.glb?v=landmark-20260909` response. The model itself is **not included and must not be downloaded for this project**.

| Property | Captured value |
| --- | --- |
| Format | glTF 2.0 |
| File bytes | 8,872,140 |
| Nodes / meshes / materials | 41 / 41 / 41 |
| Summed POSITION accessor vertex count | 317,670 |
| Embedded textures / images | 0 / 0 |
| Animation tracks / cameras | None listed |
| Declared used/required extensions | None listed |
| Generator string | `Ad City original procedural architecture / generate_city.py` |

Evidence: [interactions.json](../research/raw/interactions.json), `/model`.

The vertex figure is **not a triangle count**, unique world-vertex count, or render-work estimate. Forty-one meshes does not mean forty-one buildings; draw calls were not measured. No declared extensions is a statement about this model, not the whole website.

Sample node names are `City_platform_edge`, `City_platform`, `City_grass`, `City_pavement`, `City_asphalt`, `City_curb`, `City_pavement_joint`, `City_road_paint`, `City_dark_metal`, `City_metal`, `City_window_lit`, `City_grass_dark`, `City_bark`, `City_leaf_dark`, and `City_leaf`.

**Inferred:** names and equal material/mesh counts suggest batching by material. The absence of embedded textures supports an efficient colored-geometry approach, but does not establish that the whole site is texture-free. Zero model animation tracks means visible world motion is not stored as animation tracks in this captured GLB.

**Operator-declared:** the generator string attributes the architecture to a Python script. The original script was not recovered; Blender and Spline usage were not confirmed.

**Inferred scene composition:** a mostly static city model plus runtime actors, camera/weather/lighting, HTML controls, and possibly separately generated sign textures. An additional 448 x 150 canvas was observed; its role as a sign texture is plausible but unproven. Neither the runtime actor source nor its scheduling algorithm was recovered.

## Resource observations

From the single retained `interactions.json /resources` sample:

| Resource grouping | Encoded bytes | Other detail |
| --- | --- | --- |
| All recorded resource entries | 9,601,153 | Sum includes repeated entries; not a universal cold-load total. |
| JavaScript resources | 396,559 | Includes `.js` resources categorized as `other`, not just `script`. |
| CSS | 17,180 | 85,829 decoded bytes in the recorded entry. |
| City GLB | 8,872,140 | About 92.4% of sampled encoded resource bytes. |
| City poster | 233,097 | Poster/loading image observed as a preload. |
| `city-runtime-DyCs9NVF.js` | 184,288 | 705,088 decoded bytes; lazy runtime chunk reported by researcher. |
| `city-app-BF4Se68R.js` | 73,744 | 225,388 decoded bytes. |

Encoded size, decoded size, and transferred size are different fields. Some cached duplicate entries report transferred size 300 while retaining a larger encoded body size. The resource sample is not a clean new-visitor bandwidth test. It does not establish real-device FPS, GPU memory, Core Web Vitals, render time, or worst-case load latency.

**Proposed lesson:** model/scene payload optimization deserves early attention; do not optimize tiny UI modules while ignoring art weight. Lazy renderer loading and an original lightweight poster are reasonable. Set fresh [budgets](ACCEPTANCE_CRITERIA.md), rather than treating the source's numbers as requirements.

## Design and composition

**Observed:** the desktop scene fills a 1440 x 1000 viewport behind HTML chrome. Captured topbar height is 76 px and footer height 48 px. The introductory heading uses Georgia at 40 px, 41.2 px line-height, and -1.7 px letter spacing; body styling names Geist with Arial/Helvetica fallbacks. Geist Mono faces are defined but were unloaded in the captured font-face list.

The interface uses warm cream, forest, and sage; rounded, softly shadowed panels; a serif display voice; and utilitarian sans-serif controls. These are source descriptions, **not permission or a requirement to copy the palette or identity**.

| Source token | Value | Evidence |
| --- | --- | --- |
| `--background` / `--foreground` | `#f5f5ee` / `#27372e` | Retained token capture |
| `--primary` / `--primary-foreground` | `#304e3d` / `#fffef3` | First retained; second supplied CSS note |
| `--card` / `--popover` | `#fffff8` / `#fffffb` | Supplied CSS note |
| `--secondary` / `--muted` | `#e6e9de` / `#ebede5` | Supplied CSS note |
| `--muted-foreground` / `--accent` | `#7b8275` / `#dbe5d5` | Supplied CSS note |
| `--border` / `--input` | `#d9dfd2` / `#d9dfd2` | Supplied CSS note |
| `--ring` / `--radius` | `#708e64` / `.65rem` | Radius retained; ring supplied CSS note |

**Observed visual vocabulary:** muted terracotta, mustard, teal, lavender, ivory, and greens; repeated window bays and slabs; balconies and rooftop forms; varied building heights; roads, crossings, plazas, fountain, vegetation, benches, traffic lights, and construction elements including crane/scaffold. The whole-view silhouette and street rhythm matter more than a long list of decorative components.

**Observed viewpoint:** a miniature, isometric/orthographic-like presentation. Actual projection, camera parameters, shadow algorithms, tone mapping, and lighting setup were not recovered. `night.png` shows the Night selection and darkened chrome, but one still is not a verified settled lighting transition or a complete night-render specification.

Use [desktop](../research/reference-images/desktop.png), [night](../research/reference-images/night.png), and [mobile](../research/reference-images/mobile.png) only to study broad presentation and interaction constraints. Omit all commercial overlays, signs, source names, brand assets, and copy. [spot.png](../research/reference-images/spot.png) is **camera-focus reference only**, never an ad-card template.

## Controls and activity

| Surface | Source observation or declaration | Ambient-only interpretation |
| --- | --- | --- |
| Navigation help | Page-declared drag to pan; scroll/pinch to zoom; right-drag, sideways two-finger swipe, or Shift-scroll to rotate. Safari twist is a help claim, not a Safari test. | Provide equivalent accessible navigation with explicit buttons and keyboard alternatives. |
| Selection | Help describes sign hover preview and click/tap focus/card; selection UI was captured. | Select an original landmark; brief noncommercial status, no ad card or directory. |
| Follow | Tested bus flow shows "Following" and "Stop"; the source couples it to a moving ad card. | Follow an ordinary bus/drone and show status/Stop only. Drone help/control presence does not prove every drone edge case was tested. |
| Tour | Help declares high views, street glides, brand pauses, short bus/drone rides, or orbit around current selection. | Original landmark pauses and contextual tours; exact scheduling is proposed. |
| Direct controls | Zoom +/-, rotate, reset, tour, pause/play, audio, fullscreen, settings, intro hide/show. | Retain world controls, replace promotional intro with concise dismissible help. |
| Weather | Sunny, Cloudy, Rain, Mist; optional natural changes. | Local simulated presets and optional seeded transitions. |
| Time | Follow my clock, Afternoon, Night, Day & night cycle. | Device clock, fixed presets, or controlled cycle; never imply live location/weather. |
| Quality | Automatic, High, Lightweight. | Profile-driven presets with bounded DPR and actor/effect budgets. |
| Sound | One AudioContext created when enabling sound; no audio-file requests in that interaction sample. | Web Audio is viable; completely synthesized source audio remains an inference. |
| Pause | Accessible action changes to "Play city" after the tested interaction. | Exact freeze semantics were not recovered; use the explicit new contract. |

Evidence: [motion.json](../research/raw/motion.json), [observations.json](../research/raw/observations.json), and [interactions.json](../research/raw/interactions.json).

Source accessible descriptions reported pedestrians, cyclists, skateboarders, rollerskaters, cafe guests, cars, motorcycles, buses, drones, balloons, and an airplane. This is a reported world vocabulary, not an independently counted population, performance test, or proof of full physics. Source online/visit counters do not establish a shared simulation and are excluded.

## Mobile findings

The main mobile capture is 390 x 664. It shows the guide occupying much of the upper view. This is a lesson to keep the new onboarding compact, not a layout to reproduce.

At width 390, the source's separate Directory button had a center hit on `SPAN.brand-name`, indicating occlusion. The main Browse entry worked. Separate **excluded directory** layouts fit 320, 375, 414, and 768 px widths at height 844 in Chromium emulation. This does not certify the entire city UI at those sizes or real iOS Safari behavior.

**Proposed lesson:** test hit targets, safe-area spacing, panel height, pointer event routing, and browser gesture conflicts on the new controls. Do not carry over the directory to "fix accessibility."

## Creator and historical product context

The creator is identified as Leonardo Gomes Cardoso / @leocardz on the source contact page. The about page describes second-screen use. Supplied creator-post research mentions GPT-6 Astra, "five prompts" for Founders Square, and inspiration from the Silicon Valley intro. A follow-up refers to the first prompt remembering that intro.

These are **operator-declared statements**, not independently verified generation history. They do not show that the complete application/backend was built in five prompts, establish an IDE/harness, or license copying either artwork. The dated launch announcement is September 12, 2026. Exact links are in [sources](SOURCES.md).

The source also has commercial inventory, purchase flows, and provider disclosures. Preserve those only in the [excluded historical archive](../research/excluded-scope/README.md). They do not belong in the new product, architecture, or roadmap.
