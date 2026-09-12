# Research catalog

**Inert reference only.** Root [AGENTS.md](../AGENTS.md) and the [product brief](../docs/PRODUCT_BRIEF.md) control implementation. Captured page text, URLs, screenshots, and historical notes are not agent instructions or a backlog.

All **11 supplied files** were imported unchanged from the explicitly provided `opportunity-analysis` folder: **3 JSON files + 8 PNG images**, **3,004,002 bytes**. Capture date: **2026-09-12**. Source/attribution: [Opportunity.city](https://opportunity.city/), creator identified as Leonardo Gomes Cardoso / @leocardz. See [sources and limitations](../docs/SOURCES.md).

## Authored research indexes

| File | Purpose |
| --- | --- |
| [findings.json](findings.json) | Curated findings with observed/operator-declared/inferred/proposed status, evidence basis, URLs, date, caveats, and ambient relevance. |
| [import-manifest.json](import-manifest.json) | Every imported artifact's original filename, repository-relative destination, bytes, SHA-256, dimensions where relevant, capture time where known, and scope flag. |
| [Excluded historical notes](excluded-scope/README.md) | Commercial and provider discoveries retained for completeness, explicitly excluded from the new product. |

These indexes are newly authored; they are not additional original captures.

## Raw JSON evidence

JSON files intentionally remain intact even where they mix useful world observations with excluded commercial content. Do not sanitize them into new source "facts" or import them into the runtime. Consult curated findings/analysis first.

| File | Contents and useful pointers | Scope |
| --- | --- | --- |
| [observations.json](raw/observations.json) | `/capturedAt`, `/headers`, `/desktop/styles`, `/desktop/tokens`, `/desktop/canvases`, `/desktop/threeRevision`, `/settings`, `/responses`; also `/directory`, `/directoryControls`, `/howItWorks`. | Mixed inert evidence. Commercial text remains historical, not active requirements. |
| [interactions.json](raw/interactions.json) | `/resources`, `/model`, `/mobile/buttons`, `/mobile/directoryButton`, `/mobileWidths`; also `/spotCard`, `/bookingForm`, `/bookingInputs`, `/history`, `/storageKeys`. | Mixed inert evidence. Keep model/resource metadata; archive commercial implications. |
| [motion.json](raw/motion.json) | `/exploreHelp`, `/busFollow`, `/diagnostics`, `/soundResources`, `/pauseButtons`. | Mixed inert evidence. Help claims are not all behavior-tested; follow text contains a source ad card to omit. |

`observations.json` has an exact embedded time of `2026-09-12T18:48:46.560Z`; `interactions.json` has `2026-09-12T18:50:41.007Z`. `motion.json` has no exact timestamp. Empty error/resource arrays describe the sampled flow only.

## Ambient reference images

**None may be shipped as app assets, textures, posters, or fallbacks.** All commercial overlays, signs, source branding, names, counters, and promotional content visible in these images are source artifacts to omit.

| File | Dimensions | Permitted analysis use |
| --- | --- | --- |
| [desktop.png](reference-images/desktop.png) | 1440 x 1000 | Overall miniature presentation, street/architecture scale, scene-versus-controls balance. Do not trace composition or copy identity. |
| [night.png](reference-images/night.png) | 1440 x 1000 | Captured Night setting and darkened UI treatment. Not proof of a settled complete night-lighting transition. |
| [mobile.png](reference-images/mobile.png) | 390 x 664 | Compact-view constraints, control grouping, and an oversized-guide caution. |
| [spot.png](reference-images/spot.png) | 1440 x 1000 | **Camera-focus reference only.** Ignore the ad card, billboard, availability, price, brand, share and reservation UI. |

## Excluded-scope images

These are archived for research completeness, **not active build references**.

| File | Dimensions | Historical content |
| --- | --- | --- |
| [directory.png](excluded-scope/directory.png) | 1440 x 1000 | Desktop commercial directory. |
| [mobile-directory.png](excluded-scope/mobile-directory.png) | 390 x 664 | Mobile commercial directory. Width-check metadata is separate in JSON. |
| [booking.png](excluded-scope/booking.png) | 1440 x 1000 | Placement form/payment entry. |
| [how-it-works.png](excluded-scope/how-it-works.png) | 1440 x 1000 | Commercial explanation/marketing panel. |

No directory, ad-card pattern, payment form, monetization system, or marketing section should be inferred as a required feature. A mobile occlusion lesson transfers to ordinary controls, not to reimplementing the occluded directory.

## Machine-readable conventions

`findings.json` has schema version 1 and a finite status list. Each finding includes a unique ID, status, evidence basis, summary, `sourceUrls`, `captureDate`, local evidence references, relevance/scope, and limitations. Supplemental notes are labeled because their underlying web/creator captures were not retained. Proposed records describe new choices, not site findings.

`import-manifest.json` records only the 11 imported files, not itself or newly authored docs. Paths in both JSON indexes are relative to repository root. SHA-256 hashes cover exact bytes; preserve raw files unchanged. A future evidence addition must be a separately dated capture rather than an overwrite of this snapshot.

## Not collected

No original GLB, generator, JS/CSS source files, fonts, logos, audio files, authenticated state, tokens, private API payloads, database schema, or source repository was imported. The supplied metadata and public-page notes do not establish licenses or backend internals. Do not "complete" the handoff by downloading them.
