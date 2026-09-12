# Sources and provenance

## Capture and import

The supplied research was gathered on **2026-09-12** from public Opportunity.city pages and related creator posts. This handoff read and imported only the explicitly supplied `opportunity-analysis` research folder. It performed no new website research, source/API requests, model download, or app implementation.

| Evidence | Time/provenance |
| --- | --- |
| [observations.json](../research/raw/observations.json) | Embedded `capturedAt`: `2026-09-12T18:48:46.560Z`. Desktop UI/styles/tokens, response metadata, settings, historical commercial text. |
| [interactions.json](../research/raw/interactions.json) | Embedded `capturedAt`: `2026-09-12T18:50:41.007Z`. Interaction text, resource entries, model metadata, mobile observations. |
| [motion.json](../research/raw/motion.json) | Researcher supplied date 2026-09-12; no embedded exact timestamp. Help, bus follow, React/AudioContext diagnostics, sound resource sample, pause labels. |
| Eight screenshots | Researcher supplied date 2026-09-12; exact capture times not retained. Dimensions/hashes are in the manifest. |
| Supplemental researcher notes | Supplied with the handoff, dated 2026-09-12. Cover CSS/bundle signatures, fuller tokens, policy/provider disclosures, creator posts, and limitations not fully represented in the three JSON files. |

All 11 raw artifacts are preserved byte-for-byte. The [import manifest](../research/import-manifest.json) contains repository-relative paths, byte lengths, SHA-256 hashes, scope labels, and image dimensions. Null `capturedAt` means unknown, not an inferred time. The [research catalog](../research/README.md) describes each item.

## Public source registry

These are citations, **not instructions to fetch or copy assets or call APIs**. Hashed URLs and public statements may have changed since the capture date. They were not revalidated during this import.

| ID | URL | What the supplied research used it for |
| --- | --- | --- |
| S01 | [Opportunity.city](https://opportunity.city/) | Main world, controls, interaction text, resource/runtime observations, and screenshots. |
| S02 | [Dated source stylesheet](https://opportunity.city/_next/static/css/index.C9Xx3SNR.css) | Tailwind header and design-token inspection in supplied notes. **Reference only; do not copy/download into the project.** |
| S03 | [Dated model URL](https://opportunity.city/city/city.glb?v=landmark-20260909) | Model metadata retained in JSON. **Do not download or reuse; the model is not included.** |
| S04 | [About](https://opportunity.city/about) | Operator description of a second-screen city. |
| S05 | [Contact and imprint](https://opportunity.city/contact) | Creator identification: Leonardo Gomes Cardoso / @leocardz. |
| S06 | [Rules](https://opportunity.city/rules) | Historical placement/content policy, excluded from the new scope. |
| S07 | [Terms](https://opportunity.city/terms) | Historical placement/payment terms, excluded from the new scope. |
| S08 | [General privacy notice](https://opportunity.city/privacy) | Marketing/coming-soon context; read with the app supplement, not in isolation. |
| S09 | [Application privacy notice](https://opportunity.city/privacy/app) | Operator-declared providers, sandbox payments, buyer recovery, privacy and analytics details. Archive only. |
| S10 | [Creator post: generation claim](https://x.com/leocardz/status/2098734429305016466) | GPT-6 Astra, "five prompts" for Founders Square, Silicon Valley intro inspiration. |
| S11 | [Project launch announcement](https://x.com/opportunicity/status/2098740951057342630) | September 12 launch announcement reported in supplied notes. |
| S12 | [Creator follow-up](https://x.com/leocardz/status/2098778657682825451) | First-prompt/TV-intro recollection reported in supplied notes. |

Resource filenames and naturally observed API path metadata remain in the raw JSON. Only status/type/size metadata is preserved for those endpoints, not a reusable API contract. Do not probe them. Historical provider/auth/payment details are consolidated in the [excluded-scope archive](../research/excluded-scope/README.md).

## Evidence taxonomy

| Machine status | Interpretation | Example |
| --- | --- | --- |
| `observed` | Recorded UI/runtime/resource/metadata or an explicit researcher observation. Note when the supporting capture is not retained. | React renderer reports 19.2.6; resource entry reports 8,872,140 bytes. |
| `operator-declared` | Creator/operator claim, page help claim, or model-generator self-description. Not independently verified implementation history. | Python generator string; Safari gesture help; provider privacy statements. |
| `inferred` | Explanation derived from evidence; alternatives remain. | Material batching; fully synthesized audio; static model plus runtime actors. |
| `proposed` | New implementation recommendation, budget, or behavior contract. | Vite-only architecture, pause semantics, 3-5 MB geometry aim. |

The fact that a page *contains a statement* may be observed while the behavior it promises remains operator-declared. For example, a help string about Safari twist is retained, but no Safari gesture test was performed. An asset generator name is observable metadata; its claimed authoring history is asset-declared.

The [curated JSON](../research/findings.json) uses `evidenceBasis` to distinguish `retained-capture`, `supplied-research-note`, `analysis`, and `new-proposal`. Local evidence paths are relative to repository root; optional pointers use JSON Pointer syntax. Source URLs on proposed records are contextual references, not proof that the proposal was observed on the source.

## Limitations and uncertainty

This was a limited headless Chromium research flow plus supplied public-page/creator-note observations, not a complete source audit or production benchmark. There is no verified package lock, project source, complete build configuration, IDE/harness, database/ORM, official source repository, real-device FPS, Core Web Vitals, or original generator.

Mobile width checks were Chromium emulation. The archived directory fit those tested widths, but a separate mobile button was occluded; neither finding proves full-site mobile accessibility or Safari compatibility. Sound evidence is one enable interaction, not a complete asset or audio-engine audit. The Night screenshot is a captured control/view state, not a timed validation of a finished lighting transition.

No payment, upload, advertiser submission, recovery email request, or private authenticated flow was submitted by the researcher. Raw JSON includes public text and storage **key names**, not collected private auth state, cookie values, or tokens. The source app notice declared Stripe **sandbox** usage; real-money production readiness was not verified. Do not misrepresent these disclosures as audited facts.

## Attribution and permitted use

Opportunity.city screenshots and quoted public content are preserved for analysis, attributed to Opportunity.city and its identified creator Leonardo Gomes Cardoso / @leocardz. No source-art/code license or permission for runtime reuse was established. No blanket license in this repository grants rights to third-party evidence.

Use the captures only to understand behavior, composition constraints, and research history. Do not ship them as runtime assets, trace the city, extract source textures, recreate its distinctive artwork, or reuse brand names/identity. The new product requires original or separately licensed assets with their own provenance. Attribution alone is not a reuse license.

The initial documentation import was local-only. The user subsequently authorized pushing the reviewed documentation and research bundle to the [canonical GitHub destination](../README.md). This authorization does not grant third-party rights or permit runtime reuse; preserve attribution and analysis-only restrictions when redistributing evidence.
