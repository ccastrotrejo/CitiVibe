# NYC realism: research, repository comparison, and improvement plan

**Date:** 2026-09-16, New York local time. **Research baseline:** `132aac06fc2606e164c573d5ae879e7e835db5d6`. **Status:** the user subsequently authorized implementation of R01-R35 and R38-R39. These 37 bounded implementations pass integrated source and installed-Chrome checks; R36-R37 remain excluded. Research measurements below describe the pre-change baseline, not current verification. Physical-device and broader visual approval remain open.

**Additional approved scope:** one hospital, one fire station, and one police station with recognizable employees nearby. Existing buildings may be repurposed; the user also permits increasing building/person limits if needed. Prefer reuse within the unchanged grid, park, access and rendering budgets. Facilities, employee clothing, lettering, and symbols remain original and unbranded; police staff are unarmed. This does not authorize operational interiors, emergency dispatch, a road-network expansion, commits, pushes, pull requests, or deployment.

**Placement correction, 22:28:** the user rejected mailboxes, benches, hydrants, and steam funnels arranged along the exposed perimeter sidewalk beside the empty backdrop. Relocate these into distributed interior street, frontage, and park-edge settings. This supersedes perimeter-shoulder placement chosen solely for easy clearance. Keep the same safety requirements: create or identify genuine furnishing pockets rather than moving the obstruction into a walking or cycling route.

## Local implementation record - 2026-09-17

The approved items now have bounded implementations in the local worktree. Integrated source and installed-Chrome checks pass, as recorded in [acceptance criteria](ACCEPTANCE_CRITERIA.md#nyc-realism-and-interior-placement---2026-09-17); this is not physical-device or all-angle art approval. The research inventory later in this document remains the **pre-change baseline**.

**The perimeter correction is implemented:** all six mailboxes, eight street benches, six small utilities and the steam stack are inside the neighborhood. They use existing interior plazas, connected hospital/police forecourts and spare non-cycling curb pockets, not a furnishing ribbon beside the empty backdrop. The steam stack is at **(-64.5, -43)**, with a 0.025 m base and 2.725 m outlet. No original parked car moved. The placement checks include a full twelve-metre inset from the city boundary, both walking lanes, actual low scenery, bench users/companion spaces, and retained access reservations. The police staff pocket is on the west side of its entrance so it does not overlap the relocated bench.

The final clearance refinement protects both actual walking lanes through their 7.7 m building-side reservation and uses the full shared bench-approach envelope. The hospital bench is at (1.5, -141.3), its mailbox at (13.5, -140.9), and the police bench at (64.6, 152.7); their short paving aprons move with them. These are interior-pocket adjustments, not changes to the routes or city boundary.

| ID | Bounded implementation and limits |
| --- | --- |
| R01 | Three frontage roles: mixed-use avenue, neighborhood row and loft quarter, assigned to existing building IDs. |
| R02 | Seven explicit construction systems correlate use, masonry/metal/glazing family, window details and compatible roofs. These are authored rules, not NYC prevalence statistics. |
| R03 | Attached runs and aligned frontage rhythm remain, with contained lot-line details and preserved access/planting breaks. |
| R04 | Selected exposed corners wrap their commercial base; attached sides remain blank instead of receiving inaccessible doors. |
| R05 | Real shallow commercial recesses, transoms, bulkheads, varied display/awning treatments and separate upper-floor entries. |
| R06 | Stone surrounds, brick lintels/piers, metal-front divisions and curtain grids now follow construction type rather than color alone. |
| R07 | Refined reveals, sills and trim use a shared correctly oriented pane instead of redundant glazing solids. |
| R08 | Roof access bulkheads sit on the membrane, with compatible tank/plant/chimney/garden and service details. |
| R09 | Opposing motor centerlines are yellow; crosswalks and stop bars remain white and cycling meanings are retained. |
| R10 | Curb-run end markings replace individual painted parking stalls and repeated pavement P marks. The twelve parked-car poses stay unchanged. |
| R11 | Sparse pavement joints, patches and seams provide surface scale without a district-wide grunge texture. |
| R12 | Frontage roles, ground detail and furnishing composition distinguish street character without changing the road graph. |
| R13 | Interior furnishing pockets include full walking, use and approach envelopes, rather than clearance against a single nominal path centerline. |
| R14 | Two pilot blended landings have actual sloping solid geometry and flush surface cues at the retained walking-contact height. |
| R15 | Two hydrants, service covers and selected building service connections share existing primitives and materials. |
| R16 | Two public litter baskets and two closed-lid rear service bins; no blanket garbage-bag scenery or universal sanitation claim. |
| R17 | Contextual street-tree beds distinguish constrained street planting from the retained park canopy; tree sites and headroom remain. |
| R18 | Existing gate, quiet-seat, running and recreation edges gain contextual arrival/seating treatments; the park layout and scenery remain. |
| R19 | Seating faces an actual path, view or activity, with reserved approach and selected adjacent companion spaces. This is not accessibility certification. |
| R20 | The eight existing subway mouths receive grouped fictional wayfinding while retaining genuinely descending stairs and open weather capture. |
| R21 | Wayfinding explicitly identifies scenic-only access. No working elevator, underground connection or step-free transit service is claimed. |
| R22 | Occupied-building sheds retain their protected channel and gain coherent deck/support/repair detail, without turning every site into active construction. |
| R23 | Context-specific scenic transit, curb and service pictograms use original shared geometry, not real agency logos or advertising. |
| R24 | Existing people physically approach, use and leave a storefront and a park bench-front reading pocket; nobody teleports indoors. |
| R25 | Bounded destination reservations and drained merge approaches move these selected pauses off through-flow; ordinary trip/crossing capacity remains authoritative. |
| R26 | Selected existing walkers use the connected meadow path and rejoin at real spline junctions. The decorative bridge remains non-walkable. |
| R27 | Existing bus 6 performs a five-second in-lane stop/dwell/depart cycle at a matching marker; no fictional passenger exchange. |
| R28 | Existing van 47 uses the reserved (30, 98.5) stop. Adult walker 17 visits the actual recessed service frontage at (30, 104.25), with bounded off-flow waiting and a 3.2-second pause only while the real van is parked. No parcel transfer across the sidewalk or operational interior is depicted. |
| R29 | Shared window instance attributes and one retained-time uniform distinguish residential, office, store, hospital and station activity while preserving dark windows. |
| R30 | Three-second yellow transitions close new vehicle admissions while committed vehicles clear. Protected pedestrian service and all-red clearance remain; concurrent turning/pedestrian movement was not added. |
| R31 | Six existing park walkers can read an original book during a reserved quiet pause; selected frontage activity has grounded observation poses. |
| R32 | The six retained guided IDs now include a street-wall composition, varied yaw/pitch, readable Crosstown framing and full-court framing. Manual interruption and reduced-motion stepping remain. |
| R33 | Construction-specific reveals, grounded bulkheads, local material/contact detail and the existing lighting provide contrast without a new bloom/SSAO pass. Broader visual approval remains open. |
| R34 | The original companion SVG, React fallback and no-JavaScript fallback now describe the current neighborhood and civic facilities honestly as a static illustration. |
| R35 | Selected gate/drain strips are completely cleared in CPU snow support, surface tint, snow shells and shadow fragments; overhead roofs retain snow. This is an authored maintenance cue, not a calendar or hydraulic simulation. |
| R38 | Two flush rectangular roadway grates cover real recesses and open curb mouths; positions, heights, parking and cycling exclusions are tested together. |
| R39 | One original banded steam stack emits twelve bounded analytic puffs driven by retained weather time/wind. Reduced motion has a still; lightweight omits only vapor. |
| Civic addition | Building 63 is a hospital, 60 a fire station and 93 a police station, with distinct exteriors and twelve existing adult employees using reserved workplace pockets. Original care-pulse artwork and unarmed, unbranded clothing; no dispatch or operational interiors. |

**Observed current inventory, 2026-09-17 09:08 UTC:** 94 buildings (43 residential, 31 mixed-use, 17 office, three civic), 362 retained actor rigs, **616,758 base triangles / 108 visible mesh submissions / 37 material resources**. The 328-person population, 48 moving motor vehicles, twelve parked cars, four carts, three ten-bike stations, grid and full-size courts remain. These are constructed source counts, not GPU draw calls or FPS. The steam effect separately uses one instanced draw with twelve 64-triangle puffs, borrowing the existing cloud material.

Four app views were refreshed in headless Chrome 153.0.8010.47 at 1440 x 900, reduced-motion paused: overview, street wall, a more overhead interior-plaza view, and the same view in night/rain. **An earlier interior-plaza image was pixel-inspected**; it showed the stack, mailbox and benches among building-lined interior pockets. The refreshed captures were not pixel-inspected because of the image-viewing limit. No page/console errors were observed in the refreshed capture run. The source photographs and broader visual/device gates below are not retroactively marked complete.

Implementation ownership lives in the existing streetscape/facade/pavement/furniture modules and the focused `civicFront`, `loadingFrontage`, `civicActivities`, `serviceActivities`, `destinationActivities`, `parkActivities`, `windowLighting`, `steamVisual` and `civicMaintenance` helpers. Current integration outcomes belong in the [verification record](ACCEPTANCE_CRITERIA.md). R36-R37 remain excluded. All work is local: no commit, push, PR or deployment.

## Recommendation

Make Rainlight Square read as **one plausible, fictional NYC neighborhood**, with a mixed-use avenue, quieter residential frontages, a small loft/office cluster, and a well-used park edge. Do not compress all five boroughs or every famous NYC feature into one scene.

The project already contains most recognizable ingredients. The highest-value next change is to make those ingredients **belong together**: building type should explain its facade, storefront, roof, neighbors, street frontage, lighting, and nearby activity. More unrelated props, more random colors, and more people would not address that underlying problem.

There is also a real constraint: this is a **selectively compressed miniature**, not a consistently scaled city model. Full-size courts and human bodies coexist with short vehicles, shallow building parcels, closely spaced roads, and a destination-park composition within 78 x 176 m. Preserve that deliberate compression for the first improvement pass. A uniformly life-size NYC simulation would require a separately approved layout/scale project.

## Reading guide

- [Current repository baseline](#current-repository-baseline): measured inventory, implemented strengths, and concrete gaps.
- [Local implementation record](#local-implementation-record---2026-09-17): bounded coverage of the approved items and the interior-placement correction.
- [Real NYC patterns and their implications](#real-nyc-patterns-and-their-implications): architecture, streets, and everyday public space.
- [Ranked improvement list](#ranked-improvement-list): proposed work, impact, cost, and evidence.
- [Implementation plan](#implementation-plan): bounded phases with dependencies and acceptance gates.
- [Reference-shot plan](#reference-shot-plan): the targeted visual research still needed before art approval.
- [Reference register](#reference-register): verified primary publications, dates, and caveats.
- [Decisions and exclusions](#decisions-and-exclusions): what needs approval and what should not be built.
- [Research method and limits](#research-method-and-limits): source classifications and visual limitations.

## Research method and limits

Four evidence types are deliberately separate:

| Label | Meaning here |
| --- | --- |
| `observed` | Current source code, a reproducible measurement, or pixels actually inspected. |
| `operator-declared` | A statement published by an agency, operator, museum, or preservation organization. Reading a guideline does not establish universal real-world compliance. |
| `inferred` | Interpretation of the evidence, including expected visual impact. |
| `proposed` | An original design or implementation recommendation, not an existing feature or an NYC statistic. |

The study combines direct repository inspection with independent research threads on architecture, street/transport systems, and public space/everyday life. Historic-district descriptions are useful examples, not a representative survey of the whole city. Standards describe intended installations, not the condition of every existing sidewalk or intersection. No citywide building-use ratio, architectural prevalence, or demographic behavior distribution was measured.

**Confidence:** HIGH in the measured repository inventory and the narrowly attributed source statements; MEDIUM in the city-wide aesthetic ranking until matched daytime, reverse-angle, and source-photo views are inspected. This is an extensive qualitative study, not an exhaustive census of NYC or a completed field survey.

The current app was served locally and inspected through headless Chrome **153.0.8010.47**, at **1440 x 900**, with reduced motion and a paused scene. A separate constructed source scene was counted and disposed. Three screenshots were captured, but **only the nighttime Crosstown screenshot could be visually inspected** before the image-view limit prevented further inspection. The daytime overview and daytime Crosstown captures are not visual evidence. The user's later first drain attachment is directly visible in the conversation; the other three new attachments are not. No claim of a complete visual audit, physical-device performance, or production browser sign-off follows from this probe.

Session artifacts retain `inspect-nyc-city.mjs`, `nyc-current-inventory.json`, `nyc-current-overview.png`, `nyc-current-crosstown.png`, and `nyc-current-night.png`. The inventory capture is timestamped `2026-09-17T01:40:45.228Z`, which is September 16 in New York. Core measurements are reproduced below so this report does not depend on the session artifact paths.

Earlier project research remains relevant: [NYC city study](NYC_CITY_RESEARCH.md), [building fabric](NYC_BUILDING_FABRIC_RESEARCH.md), [lighting](LIGHTING_RESEARCH.md), [weather physics](WEATHER_PHYSICS_RESEARCH.md), [people and activity](PEOPLE_AND_ACTIVITY.md), and [weather-aware people](PEOPLE_WEATHER_RESEARCH.md). Older photo-inspection claims remain attributed to their original records; this study does not retroactively mark their images inspected.

All references are inert research. No source photographs, GIS, downloaded models, branded typography, real business identities, advertisements, or traced facades become application assets.

## Current repository baseline

### Measured inventory

These are measurements of the current default seed, not numbers copied from an older README paragraph.

| Surface | Current result | Primary repository evidence |
| --- | --- | --- |
| Ground and street graph | 220 x 340 m; six avenues and six cross streets; 24 non-central blocks; 36 junctions | [`streets.ts`](../src/content/streets.ts), [`streetscape.ts`](../src/world/streetscape.ts) |
| Junction control | 28 signalized; eight all-way stops | `INTERSECTIONS` in `streets.ts` |
| Buildings | 94 stable IDs: 43 residential, 32 mixed-use, 19 offices | `createStreetBuildings` in `streetscape.ts` |
| Attached fabric | 75 buildings participate in 57 joined pairs; authored 0.06 m joints | [`buildingFabric.ts`](../src/world/buildingFabric.ts) |
| Architectural geometry families | Six brownstones, 37 masonry, 30 loft, 21 terrace | `architecture.family` in `streetscape.ts` |
| Material palette | 12 named facade families, 48 tone entries | [`facades.ts`](../src/content/facades.ts); material family is not architectural geometry |
| Main floors | 29 buildings with three; 17 with four; 24 with five; 16 with six; eight with seven | `STREET_BUILDINGS`; six buildings additionally have two setback floors |
| Main-volume height | Approximately 6.91-16.79 m, excluding base, parapet, roof props, and additional setback floors | `floors * architecture.floorHeight`; ordinary floor heights are approximately 2.3-2.4 m |
| Ground-floor store variants | 11 market, eight books, 13 cafe | `storefront` and `buildCommercialFront` |
| Roof variants | 37 mechanical plant, 20 tank, 16 chimney, 21 garden | `roof`; one assigned primary treatment per building |
| Human population | 328: 200 street walkers, 55 park walkers, 24 runners, 27 cycling roles, six court players, eight meadow figures, eight picnic neighbors | [`streets.ts`](../src/content/streets.ts), [`park.ts`](../src/content/park.ts), [`play.ts`](../src/content/play.ts), [`courts.ts`](../src/content/courts.ts), [`parkVisitors.ts`](../src/content/parkVisitors.ts) |
| Cycling accounting | 15 ordinary road cyclists, nine roaming shared-bike riders, three station users | `TRAFFIC_ACTORS`; the station riders are not three extra people beyond 328 |
| Motor traffic | 48 moving vehicles: six buses and 42 other vehicles | `TRAFFIC_ACTORS`; includes nine taxis and eight ambulance/fire variants, not extra emergency vehicles |
| Static street life | 12 parked cars, four cabless sidewalk food carts, six mailboxes, eight added street benches, ten added park benches | [`streetFurniture.ts`](../src/content/streetFurniture.ts); older benches also remain |
| Shared-bike stations | Three stations, ten bicycles and 11 parallel docks each; classic/electric variants and retained checkout/return movement | [`bikeShare.ts`](../src/content/bikeShare.ts), [`world/bikeShare.ts`](../src/world/bikeShare.ts) |
| Transit entrances | Eight original 1.9 x 4.5 m openings with 12 descending steps each; scenic, not working stations | [`metro.ts`](../src/content/metro.ts) |
| Central park | 78 x 176 m; reservoir/running loop, lawn, meadow, lake, bridge, fountain, pergolas, woodland, gates | [`park.ts`](../src/content/park.ts), [`world/park.ts`](../src/world/park.ts) |
| Courts | Basketball 28.6512 x 15.24 m; pickleball 13.4112 x 6.096 m; runoffs and shared 2 m passage retained | [`courts.ts`](../src/content/courts.ts) |
| Lighting infrastructure | 66 street lamps, 15 manifest park lamps, six court fixtures; additional decorative park geometry is separate | [`lighting.ts`](../src/content/lighting.ts), [`world/park.ts`](../src/world/park.ts) |
| Source-scene accounting | 632,843 triangles; 109 visible mesh submissions; 37 material resources; 362 retained actor rigs | Constructed `buildCityScene()` using the counting convention in [`scene.test.ts`](../src/world/scene.test.ts) |

**Budget consequence:** the strict base-scene limit is below 640,000 triangles, at most 110 submissions, and at most 37 materials. The measured baseline is only **7,157 triangles below the limit**, has one submission slot left, and has no material slot left. These are source-scene counts, not actual GPU draw calls, total weather/shadow-pass cost, or FPS. Future changes must primarily **replace or simplify existing detail**, not assume unused capacity.

**Documentation drift:** several introductory passages still describe 277 people, older camera limits, or earlier browser failures. The current code and latest dated acceptance entries supersede those snapshots. This research does not rewrite unrelated historical records or count the separately planned 464-person target as implemented.

### What already works

The next plan must preserve, rather than propose again:

- Attached street-wall groups, blank adjoining walls, varied masonry colors, stoops, fire escapes, roof tanks, window air conditioners, office glazing, and distinct retail ground floors.
- Genuine two-way sidewalk movement, destination-block trips and protected crossings; signal ownership and landing-clearance reservations.
- Road vehicle variety, parked cars, bike station use, carts, mailboxes, street names, sheds/scaffolds, and genuinely descending subway stairs.
- A car-free park with real runners, full-size courts, meadow activity, and weather-aware picnic departures and returns.
- Snow accumulation, rain-fed pools, wet materials, umbrellas/coats, cautious movement, vehicle lamps, restrained public lighting, and retained pause/recovery.
- Manual pan/zoom/orbit/reset, city-wide tour, reduced-motion guided views, accessible controls, optional muted-by-default sound, and an honest rendering fallback.

### Concrete gaps, not missing-feature guesses

| Finding | Evidence | Interpretation |
| --- | --- | --- |
| Architectural choices are only partly correlated | `createStreetBuildings`, lines 279-335: building use, non-brownstone geometry family, roof choice, and window variation mostly use separate ID-keyed samples. `facades.ts` clusters colors by run. | `inferred`: color continuity is stronger than continuity of building type, cornice, store rhythm, and roof infrastructure. More random variation could make the mismatch worse. |
| Materials and construction type are separate concepts | `facadeFamily` can name cast iron, limestone, or brick while `architecture.family` independently chooses masonry, loft, or terrace geometry. | `inferred`: some materials currently read mainly as color changes rather than visibly different construction systems. |
| Stores share one composition | `buildCommercialFront` in `buildingFabric.ts`, lines 69-124, uses a common bay arrangement, fascia, canopy, and three display objects for all three store kinds. | `inferred`: vary thresholds and frontage proportions before adding more store categories or signs. |
| Street hierarchy is weak in the physical section | All streets share `ROAD_HALF_WIDTH = 5`, motor offsets, and much of the same paint/bollard loop in `streetscape.ts`, lines 566-641. | `observed` in code; `inferred` visual consequence: avenues and quieter streets can feel like repeated infrastructure tiles. Existing control differences are real and must remain. |
| Two-way motor centerlines use the shared white paint material | `streetscape.ts`, lines 611-613, draws `p.line` at road-center offset zero; `scene.ts` defines the palette. | Candidate high-impact correction: align centerline color/pattern with the actual opposing traffic. Do not change bike separators or stop bars indiscriminately. |
| Parking is unusually explicit for this aesthetic | Every authored parking bay gets a white outline and pavement P; four tall P signs use the same design in `world/streetFurniture.ts`, lines 117-145. Earlier research explicitly did not establish these as typical NYC parking marks. | `inferred`: simplify paint and use context-specific fictional curb information, retaining all 12 parked vehicles and their safe reservations. |
| Ground surfaces are broad and uniform | Streets are long rectangular paving/road strips; the inspected nighttime Crosstown view shows large uninterrupted sidewalk and asphalt fields. | `observed` locally, not every camera angle: expansion joints, repairs, thresholds, drainage details, and localized wear could improve scale. |
| Vehicle and block dimensions are deliberately compressed | `traffic.ts`, lines 34-38: sedan/taxi 2.8 m, bus 4.8 m. Outer road-center intervals are 26-30 m in X; subtracting two 7.7 m occupied-block insets leaves only 10.6-14.6 m across some parcels. | This is a structural limit on full-scale lots, buses, yards, and intersections. Never enlarge vehicles or import real setback dimensions without solving the shared geometry. |
| Street destinations are blocks, not places | `pedestrians.ts`, lines 142-146, chooses one-to-three-hop block destinations; arrival uses a 1.5-6 second rest or look-around. | Existing movement is substantial, but the 200 walkers do not yet choose doors, benches, carts, or bus stops as activity destinations. |
| Park circulation uses only part of its drawn network | `PARK_PATHS` contains multiple walks; ordinary park walkers use two `PARK_ROUTES`, runners one circuit. Weather-aware picnic visitors add their own retained routes. | Use selected existing paths and destinations more meaningfully; do not assume the park has no ingress/egress or that every path is already walked. |
| Transit geometry lacks a network/accessibility story | Eight entrances share the same dimensions and scenic purpose. Buses circulate without scheduled passenger stops. | Entrances can be composed as related station access points, and buses can acquire bounded dwell behavior later. Eight mouths do not mean eight stations. |
| Night windows ignore building use | `scene.ts`, lines 367-385: positional hashes select occupancy/tint for glazing; `environmentVisual.ts` applies a common night ramp. | Already varied, not uniformly lit; the next gain is correlated office/residential/storefront schedules, not simply adding window randomness. |
| Local visual repetition remains visible | The inspected nighttime view shows repeated roof bands, windows, mostly flat unarticulated roof fields, narrow standalone volumes in paved parcels, and recurring road treatments. | A local composition finding only. It does not establish that all 94 buildings are detached or that the previous street-wall pass failed. |
| Camera coverage undersells the urban fabric | `CAMERA_ANCHORS` has six views, largely park/civic subjects, all with the same yaw and default pitch. | Add variety to existing city-wide compositions, without restoring landmark selection or actor-follow controls. |

## Real NYC patterns and their implications

Source IDs in the following comparisons resolve to the [reference register](#reference-register). Source statements are `operator-declared` unless explicitly described otherwise; miniature translations are `proposed`.

### NYC has many building fabrics, including within one borough

The following examples cover all five boroughs **without assigning one architectural identity to each entire borough**. They are deliberately selected contrasts from LPC reports, not a representative sample. Report descriptions establish historical documented conditions, not current field observations.

| Reference context | What the primary report documents | Useful lesson for this miniature |
| --- | --- | --- |
| Bedford, Brooklyn | Late-19th-century rowhouses in multiple styles alongside flats, schools, and churches; coordinated house rows and larger apartment buildings on Nostrand Avenue | Related cornices and entrances can make individual buildings read as a designed run. "Brooklyn" is not one brownstone mesh. [B1] |
| East 10th Street, Manhattan | A park edge with rowhouses, tenements, converted multiple dwellings, and a library; raised buildings, changed cornices, and retained or removed stoops | A convincing park frontage can contain accumulated adaptations and different ground-floor uses without becoming a random assortment. [B2] |
| SoHo, Manhattan | Cast-iron, brick, stone, and mixed-material buildings; repeated prefabricated bay components and clear horizontal/vertical relationships | Loft/metal-front architecture is a facade system, not gray apartment walls or maximal ornament. Do not copy any individual building. [B3-B4] |
| Grand Concourse, Bronx | Broad apartment-house frontages, revival and Art Deco/Moderne clusters, patterned brick and selective terra-cotta/cast-stone detail, light courts, occasional wraparound windows | A wider apartment composition with a legible court can supply contrast without adding a skyscraper. It is not the form of the entire Bronx. [B5] |
| Jackson Heights, Queens | Block-scale garden-apartment planning; both continuous masonry fronts with rear gardens and paired buildings with deliberate openings; a commercial spine on 37th Avenue | Attached fronts and meaningful gaps can both be intentional. Commercial and residential frontages can differ while sharing an architectural language. [B6] |
| Sunnyside Gardens, Queens | Low-rise rows and small apartments around open interiors; access paths and some mews; coordinated variation in height, roof outline, and details | Repetition with constrained variation can look more specific than independent random building choices. Do not copy this distinctive plan into the fixed grid. [B7] |
| St. George, Staten Island | Hillside streets, double houses, mansard roofs, wood-frame siding/shingles, porches, projecting bays, and terrain-dependent rear heights | Detached/paired houses and wood construction can also be NYC. Their existence does not make them the right addition to this dense park neighborhood. [B8] |
| Modern office construction, Manhattan example | A documented curtain-wall building distinguishes transparent glass, spandrels, mullions, service core, and mechanical areas | Learn construction relationships, not the famous building's massing. This individual office is explicitly atypical and is not an ordinary-office statistical sample. [B9] |

**The recommendation is selective, not encyclopedic:** keep Rainlight Square predominantly masonry and mixed-use, using a few related existing frontage types. Do not create a miniature Bedford, SoHo, Concourse, Sunnyside, and St. George in five arbitrary corners. The research broadens the vocabulary and prevents stereotypes; it does not require using every example.

### Density comes from frontage and massing relationships

**A continuous street front can coexist with an open block interior.** Jackson Heights records both uninterrupted fronts with rear gardens and deliberate openings between paired buildings. Sunnyside documents paths between groups, and the Concourse includes substantial light courts even where buildings reach lot lines. Current rear-yard rules also distinguish attachment, lot dimensions, height, and shallow-lot situations rather than issuing one universal yard diagram. [B5-B7; B10]

**The comparison:** closing 57 gaps was useful, but the number of closed gaps is not itself an authenticity target. Review separately the public frontage, attachment, building depth, access to open space, and exposed side/rear face. Preserve the existing civic pockets. Some of the miniature's narrow parcels cannot support full-size courts or deep rear gardens behind buildings; a small planting pocket must not be labeled a fully modeled courtyard.

**Height hierarchy and street-wall continuity are different.** East 10th Street documents buildings raised and altered over time; the Concourse contains larger apartment houses; current setback provisions distinguish lower street-wall positions from upper volume requirements in specified districts. [B2; B5; B11]

**The comparison:** the existing three-to-seven-floor distribution and six setback accents are not intrinsically un-NYC. First relate adjacent lower cornices and heights and make exceptional volumes intentional. Do not increase every height, assume every office must be a tower, or assign the tallest building to every park corner. The best normal-view gain may be a more coordinated skyline within the present envelope.

### Typology, material, use, and alteration must remain distinct

**A rowhouse is a form; brownstone is not a universal residential category.** LPC examples include wood-framed and brick house rows, mixed-material tenement fronts, cast iron combined with masonry, and later office curtain walls. Building form and present use can diverge: East 10th Street documents conversions and altered ground-floor entrances. [B1-B3; B5; B8-B9]

**The comparison:** keep the current distinction between geometry family and facade material, but constrain their combinations to plausible systems. Add a limited alteration state where necessary rather than replacing independent randomness with equally crude rules such as "residential always means brownstone" or "loft always means industrial." Current use should chiefly inform entrances, privacy, ground floors, and lighting; historical type should organize the main facade.

**Variation often belongs to the row or development.** Bedford documents a multi-house row reading as one composition. Sunnyside describes block-level facade harmony with differences in height, roof outline, and detail. SoHo's iron facades rely on disciplined repeated components. [B1, PDF p. 12; B7, PDF p. 33; B3, PDF p. 23]

**The comparison:** 48 facade tones are not a demonstrated shortage. Audit whether the existing seven-building color groups correspond to meaningful frontage groups. Coordinate bay spacing, plinths, cornices, roof termination, and selective altered details across those groups. A row should remain distinguishable from one big apartment house; preserving 94 IDs does not guarantee the facade still communicates 94 individual identities.

**A corner, a front, and a rear do different work.** LPC explicitly distinguishes designed street facades from plainer rear facades with escapes and ventilation. Concourse descriptions include corner windows/curved elements, and a SoHo warehouse has differentiated treatments on its two street elevations. [B2, PDF pp. 28-29; B4, PDF p. 109; B5, PDF p. 10]

**The comparison:** protect blank attached faces, but do not render every exposed face as either a duplicate front or an accidental blank wall. Selected corners can wrap their structural bay rhythm and ground-floor treatment. Recessed entrances, stoops, areaways, and service access compete for limited space: they should not all be stacked on every frontage. Frontage-coordinate helpers and existing clearance tests are the right foundation.

### Roofs and repairs should tell a plausible construction story

**Roof equipment has a relationship to the building.** A documented SoHo warehouse roof combines a water tank, elevator bulkhead, and later addition. The modern-office example relates fixed glazing to mechanical services and maintenance equipment. Current zoning explicitly identifies tanks, bulkheads, and mechanical equipment as separate categories with qualified placement allowances. None of these sources establishes a tank frequency or a universal rooftop recipe. [B4; B9; B12]

**The comparison:** the city already has 20 tank roofs, 37 mechanical roofs, 16 chimney roofs, and 21 gardens. Improve compatibility and placement rather than increasing these counts. A compact equipment grouping, roof access point, or more legible parapet can replace an isolated emblem, but copying a real roof or scattering pipes everywhere is unnecessary.

**Alterations are more specific than generic decay.** East 10th Street and Concourse inventories describe removed stoops, altered cornices, replacement windows, parapet repairs, repointing, and painted escapes. These are located changes to an underlying system, not evidence that all NYC facades are dirty. [B2; B5, PDF p. 39]

**The comparison:** use the sequence **coherent original form -> limited alteration -> localized maintenance**. A changed window family or short repair zone is more defensible than uncorrelated per-window noise. Rain streaks and roughness gradients may be useful artistic inferences, but this study did not observe them in source pixels and does not present them as photographic measurements.

### Streets are organized by use, not by repeating one cross-section

**There is no universal NYC one-way template.** DOT's lane guidance explicitly depends on vehicle types, desired speeds, available space, and pedestrian/cycling/transit needs. Its West 181st Street case documents an implemented two-way busway with local-access restrictions. That example disproves a universal one-way assumption; it does not prescribe a busway for this fictional neighborhood. [T1-T2]

**The comparison:** all current roads share a 10 m carriageway, but the app already has different junction controls and park-side cycle arrangements. Keep those. Create hierarchy through an active transit/storefront corridor, residential frontage, and park/civic edge, without changing directions or widths. A broader hierarchy through new road sections would require the separate R36 project.

**A sidewalk has several jobs.** DOT distinguishes continuous pedestrian space from the curbside furnishing zone. Its ramp guidance connects transitions to actual crossings and keeps landings clear; separate crossing-aligned ramps should not be casually replaced by one diagonal apex ramp. [T3-T4]

**The comparison:** the full-body counterflow and clearance work is an asset. Surface articulation should explain it, not consume it. The current sidewalk paving is lower than the road surface, so a visually raised curb/ramp pass must resolve actual support heights, stroller/wheelchair-like route continuity if represented, and weather capture together. Painting warning dots on arbitrary corners would not solve that.

**Pavement paint communicates rules.** FHWA's current 11th-edition MUTCD with Revision 1, December 2025, assigns yellow longitudinal markings to opposing-flow separation and white to same-direction separation, among other specified uses. Stop lines are solid white and identify stopping positions; their placement must respect the nearest crosswalk. DOT's material guidance refers to the MUTCD and emphasizes legibility and intentional placement. [T5-T6, sections 3A.03 and 3B.19]

**The comparison:** white dashed motor centerlines are a specific source-confirmed mismatch, not just an aesthetic complaint. R09 should change the appropriate centerline category, **not recolor the shared `p.line` material everywhere**. Decide the solid/broken pattern from the intended passing rule; preserve white stop bars/crosswalks and the independently meaningful two-way bike divider.

**The curb has changing purposes.** NYC311 describes posted regulation signs, time restrictions, alternate-side cleaning, and hydrant restrictions. Permission is not established by a decorative curb color or a generic P. DOT also treats freight, loading, parking, and smaller last-mile vehicles as competing curb uses. [T7; T14]

**The comparison:** retain all 12 parked cars and their safe locations, but remove the assumption that every car needs a little parking-lot bay and pavement P. Original, restrained regulation panels can explain parking versus loading versus access. This is not a claim that NYC never uses marked stalls. The four existing **food carts remain food carts**; freight handcart research does not authorize converting the user-approved vending scenery.

### Cycling and transit must agree at the same curb

**Painted and protected bike facilities are different.** DOT distinguishes conventional, protected, and two-way lanes. Protection and counter-direction travel introduce specific intersection, loading, visibility, and maintenance considerations. [T8]

**The comparison:** widespread protection is not a defect simply because it is more consistent than some real streets. Keep it. Vary the surroundings, clarify both directions, and preserve the already working Juniper station crossing. Do not manufacture visual variety by deleting safe routes or placing a separator across pedestrian access.

**A bus stop is more than a pole.** DOT discusses near-side, far-side, and midblock placement, right-side loading, accessible door clear zones, and boarding islands where cycling passes behind a stop. MTA distinguishes local/limited buses, express coaches, and Select Bus Service; they differ in service and boarding, not merely livery. Accessible boarding can involve deliberate positioning, kneeling, a ramp/lift, and securement. [T10-T11]

**The comparison:** six existing buses already circulate. One safe stop-and-dwell cycle is more useful than adding a seventh bus or reskinning a local bus as an express coach. First choose a location that fits the miniature's short approaches and protected bike movement; do not cram shelters, islands, loading, parking, and metro mouths into every short block. Phase 4 starts with approach/dwell/depart only. Doors/passenger exchange and accessibility choreography require their own supported contacts and state handling; no person should disappear to fake boarding.

**A subway mouth is not a complete station.** MTA's accessibility list identifies specific street, ramp, and building-integrated elevators and sometimes direction-dependent access. Its climate roadmap separately identifies street vents, station entrances, sidewalk curbs, and catch basins because they have different functions and flood vulnerabilities. [T12-T13]

**The comparison:** preserve all eight below-grade entrances, but organize them as related fictional access points rather than implying eight independent stations. A companion elevator could be appropriate only with room and an honest scenic limitation. Ventilation grates and drainage inlets should look and behave differently. The research does not support putting a steaming grate at every entrance.

**Signals are context-sensitive systems.** DOT documents leading pedestrian intervals, coordination, transit priority, and accessible indications. It does not establish that every NYC junction uses every treatment or that the app's 28/8 split is representative. [T9]

**The comparison:** the current controller uses north-south, clearance, east-west, clearance, pedestrian, clearance phases. A true yellow transition or coordinated pedestrian head start must change admission/clearance behavior, not merely lamp color. Keep that safety-sensitive work separate from facade and paint changes. Never trade the existing collision-free reservation contract for apparently livelier simultaneous traffic.

### Contemporary NYC should not be reconstructed from old garbage imagery

NYC311's current residential containerization guidance says properties with one to nine residential units must use the official bin for non-recyclable trash from June 1, 2026, with enforcement from September 8, 2026. Larger-building containerization is phased, not completed citywide; the guidance names Manhattan Community District 9 and a scheduled fall-2026 expansion to Brooklyn Community District 2. Applicable buildings outside the rollout can still use bags. Set-out timing and material streams matter. These are dated program statements, not this study's street observations or predictions that scheduled rollout has completed. [T15]

**The comparison:** original closed-lid containers and occasional servicing are better candidates than permanent trash mountains. Building unit counts are not modeled, so do not derive regulatory bin requirements directly from floors or invent exact DSNY compliance. Public litter baskets and building waste containers are different objects. Keep any new detail bounded and unbranded, and do not replace the existing food carts or mailboxes with unrelated service props.

### Public space is a network of uses, not a collection of attractions

**NYC has several different kinds of public space.** NYC Parks' design guidance distinguishes passive landscapes, active recreation, playgrounds, and small hardscape respite spaces. DOT plazas are another context: reclaimed street space with public use and ongoing management. A small plaza affected by surrounding buildings' shade and wind is not simply a tiny lawn park. The park already in CitiVibe can keep its destination-like reservoir, lake, bridge, and woodland without pretending to be a scaled version of a real famous park. [P1, pp. 38-46; P2]

**The comparison:** Rainlight Square already has ample attractions. Its more useful next distinction is between a through-route, running route, court-viewing edge, water-viewing seat, social meeting point, and quiet planted edge. Those roles should determine orientation and use before deciding on additional scenery. At 13,728 square metres, calculated from the authored 78 x 176 m bounds, the park cannot plausibly gain an unlimited series of major facilities.

**Access is a complete journey.** Parks' guidance discusses connections from entries to usable features and obstacles along the route. DOT's clear-path guidance separates pedestrian movement from furnishings. The existence of a modeled gate, stair, bench, or path is not proof of a usable approach. [P1, pp. 58, 64; P5]

**The comparison:** CitiVibe already protects gates and pedestrian bodies. Preserve that work, but connect selected existing destinations to those routes. The 55 ordinary park walkers use two circuits while additional rendered walks exist; the 200 street walkers choose destination blocks rather than actual seats or thresholds. This makes R24-R26 a more meaningful activity investment than a population increase.

**Seating supports several distinct behaviors.** DCP's public-plaza guidance addresses solitary and social use, multiple seating arrangements, and backed seating. Parks relates seats to nearby activities and comfortable locations. These are design references; public-plaza zoning rules do not govern every NYC park or this fictional world. [P3; P1, pp. 64, 68]

**The comparison:** Some existing park benches share a global orientation. Review each in relation to water, courts, paths, companions, and its actual approach. Rotate only inside the existing clearance-safe footprint. A later seated actor must use the bench's real orientation and seat position, not a world-wide default. Leave adjacent accessible space unoccupied.

### Trees, drainage, and maintenance make a place specific

**Street trees are rooted infrastructure.** DOT distinguishes a tree bed's soil/root space, protection, maintenance, and surrounding pedestrian context. Its current guidance distinguishes bed-perimeter guards from trunk-enclosing guards and flush grates; do not infer that every tree in an older photograph is installed to current guidance. Curbside and setback beds also have different guard arrangements. [P6-P7]

**The comparison:** Keep the city's existing tree locations and lifted canopy clearances. Improve the relationship between soil, trunk, bed edge, and pavement before adding more trees. Park trees need not share the exact same pit/guard vocabulary as street trees. Do not introduce large planters or guard geometry simply because it appears on a research checklist.

**A rain garden is not just a tree pit that gets wet.** DOT describes curb inlets, depressed planted areas, variable water availability, and overflow to catch basins for sidewalk stormwater installations. Inlets also need maintenance because leaves, sediment, and litter can obstruct them. [P8]

**The comparison:** Existing weather already models retained water, snow, wetness, and rain-fed pools. A coherence pass can make localized gutter wetness, low points, and planting margins agree with those systems. Do not add an unrelated hydrology engine or place an inlet that visibly drains uphill. Any new basin or depression is a geometry/clearance decision, not free surface decoration.

**Realism includes repair and care.** DOT documents litter removal, plant replacement, trimming, soil/mulch maintenance, and watering. Its concrete guidance describes scored/tooled joints and acknowledges that repairs can differ in color. Its litter-basket entry records equipment replacement and servicing contexts. [P9-P11]

**The comparison:** Large uninterrupted paving surfaces can become more legible with a few bounded repair patches and joints. Keep variation tied to a plausible repair episode, utility cut, or growing condition. Do not replace clean miniature art with noise, trash, or damage everywhere. Given the full material budget, these are replacement/detail priorities, not an instruction to add a full set of bins and guards.

### Public life, night, and weather need internal consistency

**Documented possible uses are not measured daily schedules.** Parks describes recreation, waiting, comfort, and access; DCP describes social and solitary seating; DOT describes optional plaza programming. None establishes a universal NYC percentage of commuters, shoppers, joggers, or seated people at a particular hour. [P1-P3]

**The comparison:** A small amount of retained `approach -> use/pause -> depart` behavior can make current people more convincing. Morning-through-travel, midday-rest, and evening-social emphasis would be authored hypotheses, not measured NYC rhythms. Never infer a person's work or leisure behavior from ethnicity, body type, or a stereotyped neighborhood.

**Nighttime should make routes and destinations usable.** DCP's public-plaza lighting provisions address walking/sitting areas, changes of level, areas under canopy, and shielding from surrounding residences. Their numerical lighting requirements cannot be transplanted into renderer brightness values. [P4]

**The comparison:** Existing public light pools and vehicle lamps already supply a good foundation. Inspect entrances, seats, grade changes, and route decisions before adding bloom or more emitters. Darker planted interiors can coexist with legible paths. Building-use-aware windows are an authored extension, not something proven by a source's lighting code.

**NYC has seasonal variation, not permanent snow or rain.** NOAA's Central Park table, updated January 1, 2026, reports 1991-2020 normals: January mean daily high/low 39.5/27.9 F, July 84.9/70.1 F, annual precipitation 49.52 inches, and annual snowfall 29.8 inches. These are station normals, not next-year forecasts, citywide microclimates, snow-cover duration, or probabilities for the app's presets. [P12]

**The comparison:** Keep the substantial existing weather/clothing work. Ensure new destinations respect it: an open timber pergola is not automatically waterproof; coats may remain appropriate after the sun appears; snow cover need not vanish when precipitation stops. A new calendar/season system is optional, not a prerequisite for NYC character.

### User-requested additions: street drains and steam funnels

**These two features are explicitly included in the implementation authorization, not merely listed as speculative later ideas.** The following describes their intended design; completion is subject to integrated verification.

**Street drains - observed reference:** the first attached image shows two rectangular dark metal roadway grates next to a raised curb, each paired with a horizontal curb opening. The grates sit in a green-painted surface, with concrete sidewalk panels and a central curb segment separating the openings. Location, date, dimensions, hidden drainage construction, and the legal meaning of the green paint are not established by the image. The second drain attachment was unavailable for pixel inspection.

**Planned original model:** a restrained rectangular grate/frame, recessed dark openings, a curb-inlet mouth where the actual curb section supports it, and a small surrounding repair/edge treatment. Begin with one clearance-safe curb segment and expand only to sensible drainage locations; do not place a drain at every corner automatically or reproduce the photograph's surrounding artwork. Grates must appear flush with the road and not create a collision lip, open pedestrian hole, or bicycle-wheel hazard. The first image's exact grate pattern is reference, not an engineering specification to copy.

**Water relationship:** DOT verifies that curb cuts/grates admit adjacent roadway stormwater and that overflow/drainage relationships matter [P8]. Align the drains with the city's existing surface/wetness/pool design. A subtle wet gutter or runoff cue can communicate function. Do not claim actual hydraulic removal from pools unless the retained water model is explicitly updated and its mass/flow behavior verified. Snow can partially cover a grate, but the frame must not float above snow or remain implausibly unaffected by the shared surface system.

**Steam funnels - interpretation and reference limit:** interpret the user's term as temporary upright street steam-vent stacks, rather than building chimneys, sewer drains, or subway vents. The two supplied steam attachments could not be visually inspected, so an orange-and-white striped stack is a **proposed, source-supported interpretation**, not a claimed match to those images. A retrieved secondary reference describes these orange/white stacks and distinguishes steam-system leaks from water contacting the outside of hot steam pipes [U1]. Direct operator pages were blocked; detailed operation and exact visual proportions remain to be confirmed before implementation. Do not imply steam only occurs in freezing weather or that every plume indicates an emergency.

**Planned original model and effect:** one pilot stack with a stable base, legible vertical proportions, restrained orange/white bands, and a soft pale plume emitted from its top. No utility logo, contractor text, copied roadwork sign, smoke/fire, explosion, or dramatic failure sequence. Place it in an approved paved service/curb pocket outside moving traffic, all 12 parking reservations, cycle tracks, crosswalks, pedestrian landings, gates, and station access. If a site does not fit, defer placement rather than narrow a route or remove a parked car. Existing scenes and actor counts remain unchanged.

**Plume behavior:** bounded upward drift with the existing wind direction, soft expansion/fade, restrained density, and no scene-wide fog. Emission is authored ambient activity, not a physical steam-network simulation. Reuse the retained simulation clock, deterministic randomness, quality limits, and established effect ownership. Freeze the visible state on pause/hidden-tab suspension and restore it without a burst or catch-up. Reduced motion keeps the stack and a restrained static cue; lightweight quality can reduce or omit the plume without hiding the stack. No new audible effect is required.

**Budget rule:** neither the stack nor its transparent plume is free. Count static geometry and effect allocations/passes separately and check both against the existing contracts. Finance additions through measured simplification/replacement, with no silent material, submission, particle, or overall budget increase. Limit plume overdraw and keep signals, people, entrances, and controls readable through every relevant view.

## Ranked improvement list

The entries below preserve the original **proposals**; the implementation record above describes their current bounded realization. Impact is a qualitative design judgment, not a measured score. Effort: **S** = a bounded existing-renderer/art change; **M** = multiple art/content surfaces plus clearance work; **L** = simulation or cross-system work; **XL** = a separate structural project. These are relative sizes, not delivery promises.

### First priority: coherent blocks and readable street scale

| ID | Improvement | Impact / effort | Concrete scope and constraint |
| --- | --- | --- | --- |
| R01 | Define three related frontage characters | Very high / M | Mixed-use avenue, quieter masonry/rowhouse frontage, and modest loft/office cluster. Assign existing IDs; do not claim to reproduce three boroughs or reshuffle the population. |
| R02 | Correlate building type, use, facade, and roof | Very high / M | Replace independent combinations with a small explicit compatibility table and coherent runs. Keep seeded individuality inside each family and all 94 IDs. |
| R03 | Improve street-wall rhythm, not universal attachment | Very high / M | Align selected plinths/cornices and bay rhythms; retain repair breaks and changes of era. Classify each opening as civic access, yard, planting, or incidental before changing it. |
| R04 | Design corner buildings as corners | High / M | Wrap selected ground-floor frontage and upper-floor composition around exposed corners; give entrances a plausible orientation. No door, canopy, or stoop may occupy a crossing landing. |
| R05 | Differentiate storefront geometry | High / M | Pilot recessed entry, shopfront with transom/bulkhead, and a quieter service frontage. Vary awning presence, not merely stripe color. Retain separate access to upper floors. |
| R06 | Make facade material alter construction details | High / M | Masonry piers, brownstone surrounds, loft glazing, or a restrained metal-front vocabulary should match the declared family. No brick-per-mesh modeling or copied facade. |
| R07 | Refine shallow reveals, lintels, sills, and cornices | High / M | Spend geometry where shadow and silhouette are visible. Replace repeated trim pieces where possible; protect attached lot lines. |
| R08 | Make roofs look serviced, not randomly decorated | High / M | Contextual combinations of bulkhead, tank/plant, vents, chimney, coping, and drainage. Preserve existing tank/garden character; no tank on every roof or mandatory green roof. |
| R09 | Correct motor centerline semantics | High / S | Original yellow opposing-flow centerline treatment where applicable, keeping white crosswalks/stop bars and the existing cycling route meanings. Verify art against the graph. |
| R10 | Reduce parking-lot-like curb paint | High / S-M | Keep all parked-car positions and exclusions; replace repeated pavement P/individual outlines only after approving the visual change. Do not fabricate real parking permissions. |
| R11 | Add surface scale and maintenance history | High / M | Sparse concrete joints, utility patches, asphalt seams, curb transitions, and subtle wear tied to locations. Replace flat-surface detail or use shared geometry/colors; no random grunge blanket. |
| R12 | Make avenues and side streets feel different without moving roads | High / M | Use frontage, planted/furnishing rhythm, contextual signs, and ground materials. Preserve two-way traffic and protected cycling; do not remove safety infrastructure for a stereotype. |

### Second priority: convincing thresholds, public space, and urban utilities

| ID | Improvement | Impact / effort | Concrete scope and constraint |
| --- | --- | --- | --- |
| R13 | Express clear walking and furnishing zones | High / M | Compose benches, trees, poles, carts, and bike access around the existing actual body envelopes, not empty-looking screenshot pixels. |
| R14 | Improve ramp and landing legibility | High / M | Model a few original curb transitions and detectable-warning-like surface cues where physically supported. The current paving lies below the road top; this needs a consistent height/contact design, not a ramp pasted on top. |
| R15 | Add a small utility vocabulary | Medium / M | Selective original hydrants, utility covers, building connections, and service hatches; not every object at every corner. Street drains are explicitly scoped in R38. Placement requires exact clearances. |
| R16 | Use contemporary sanitation cues sparingly | Medium / M | Context-appropriate lidded building bins and public litter baskets rather than piles of bags everywhere. No citywide claim that one container system serves every property. |
| R17 | Differentiate existing tree pits and canopy character | High / M | Retain every tree location and clearance; distinguish mature park trees, constrained street trees, and maintained planting beds with bounded shape/material variation. |
| R18 | Give park edges distinct roles | High / M | Arrival threshold, quiet seated edge, running edge, and recreation approach. Preserve the entire park, gates, original scenery, tree sites, and full-size courts. |
| R19 | Orient seating toward an actual use | Medium / S-M | Views of courts, water, paths, or a companion; preserve seat/body clearance and add accessible adjacent space where feasible. Do not infer accessible installation from a bench model alone. |
| R20 | Explain related subway entrances | Medium-high / M | Group existing scenic mouths into a fictional station-access composition with consistent nonbranded wayfinding and differentiated surroundings. Preserve below-grade holes and weather capture. |
| R21 | Represent step-free transit access honestly | Medium / M-L | After space approval, an original elevator entrance or clear acknowledgment of scenic-only stairs. A glass box does not constitute a functioning accessible station; no invented underground connection. |
| R22 | Give occupied-building sheds construction logic | Medium / M | Refine protected walkway, deck edge, support rhythm, and occasional repair context using existing sites. Do not turn every shed into an active building site. |
| R23 | Make small civic signs context-specific | Medium / S-M | Original street/regulatory/information shapes should match actual movement and use. No real route bullets, copied agency logos, dense unreadable copy, or advertising. |

### Explicit user additions

Original R01-R37 IDs remain stable. These additions belong to the phases specified below, not to the optional skyline/scale backlog.

| ID | Improvement | Impact / effort | Concrete scope and constraint |
| --- | --- | --- | --- |
| R38 | Street drains with roadway grates and curb inlets | High / M | Phase 2: original flush rectangular grates, recessed openings, curb mouths where supported, and coherent wetness/snow treatment. Use the visible supplied drain image as shape reference; preserve all road, pedestrian, and cycling clearances. No unsupported hydraulic simulation claim. |
| R39 | Temporary steam funnels with a restrained plume | High / M-L | Phase 2 establishes a safe site; Phase 5 pilots one original steam stack and bounded wind-aware plume. Preserve roads/parking/access and pause/recovery; reduced motion has a still. Supplied steam images remain uninspected, operator verification is pending, and effect costs must fit existing budgets. |

### Third priority: more purpose from the people and vehicles already present

| ID | Improvement | Impact / effort | Concrete scope and constraint |
| --- | --- | --- | --- |
| R24 | Give existing walkers a few real destinations | Very high / L | Begin with one bench approach and one storefront pause in clear off-line pockets. Retain every person; no teleporting indoors, transactions, or new population. |
| R25 | Move rests out of through-flow where possible | High / L | Reserve small activity pockets without blocking opposite walkers. Preserve capacity checks, twelve-second blocked-trip replanning, and crossing ownership. |
| R26 | Reuse more of the existing park network | High / L | Pilot one connected path/destination with actual gait and clear merges. The decorative bridge stays non-walkable unless explicitly included in a later path/height project. |
| R27 | Add one believable bus-stop cycle | High / L | One existing bus, one clear curb location, decelerate/dwell/depart. Passenger exchange is a later explicit extension; no fake boarding or sidewalk-riding bikes. |
| R28 | Add limited service/loading behavior | Medium-high / L | Reuse an existing suitable vehicle and actor with a reserved loading pocket. Never demonstrate routine double-parking by blocking protected cycling or crossings. |
| R29 | Make lighting respond to use and retained time | High / M-L | Cluster office floor lighting, residential windows, and ground-floor activity with smooth, seeded retained schedules. Avoid new lights/materials by extending existing instance attributes. |
| R30 | Reconsider signal transitions as a separate safety slice | Medium-high / L | Research and implement a proper yellow transition and, only if appropriate, less globally exclusive pedestrian service. Preserve reservation-based safety; never simply let walkers enter alongside turning cars. |
| R31 | Add quiet social/activity variation, not universal bustle | Medium / L | A bounded paired conversation or reading pause from existing people. Do not assign behavior by ethnicity, clothing stereotype, or a presumed neighborhood demographic. |

### Presentation and later options

| ID | Improvement | Impact / effort | Concrete scope and constraint |
| --- | --- | --- | --- |
| R32 | Compose a street-wall view within the existing tour | High / S-M | Vary yaw/tilt and frame an avenue with an active base. Preserve manual interruption, six-view/guided behavior unless separately changed, and no landmark selection. |
| R33 | Tune local grounding and contrast before cinematic effects | High / M | Inspect window reveals, contact cues, shadow softness, and surface roughness at existing quality levels. No automatic bloom/SSAO dependency or hundreds of shadow-casting actors. |
| R34 | Refresh the original fallback after approved art changes | Medium / M | Reflect the final district composition in the companion illustration and accessible description; do not present the still as live. |
| R35 | Model seasonal maintenance only after the core pass | Medium / L | Optional leaf/planting and snow-clearing cues tied to existing weather. A season/calendar system is not necessary for this plan. |
| R36 | Consider true scale, wider blocks, or one-way networks separately | Potentially high / XL | Requires an explicit design decision, new graph/body/vehicle-clearance work, revised camera/weather bounds, and revalidation. Not a sneaky part of an art pass. |
| R37 | Treat waterfronts, elevated transit, and major skyline additions as separate concepts | Uncertain / XL | Valuable in the right fictional neighborhood, but not required to make this existing park district NYC-like. No famous bridge/tower replicas. |

### Evidence-to-proposal map

This makes the distinction between external support and implementation judgment explicit. Sources justify the underlying relationships; they do not prescribe our exact counts, phase order, visual score, or runtime algorithms.

| Proposed work | External basis | Repository-specific reason |
| --- | --- | --- |
| R01-R04: frontage coherence and corners | B1-B8, B10-B11 | Existing joined rows and color runs, but independently sampled use/type/detail relationships |
| R05-R07: storefronts and material-specific facade systems | B2-B3, B5, B9; earlier [storefront research](NYC_BUILDING_FABRIC_RESEARCH.md#verified-guidance) | One common commercial-front builder; material family and geometry family independent |
| R08: contextual roof composition | B4, B9, B12 | Four primary roof categories already present on all buildings |
| R09-R12: road meaning, curb paint, surfaces, hierarchy | T1-T7, T14, P10 | White opposing-flow centerline; repeated parking symbols and common road section |
| R13-R16: access and selective utilities/sanitation | T3-T4, T7, T13-T15, P5, P8, P11 | Existing narrow clearances and almost exhausted geometry/material budget |
| R17-R19: trees, park edges, seats | P1-P3, P5-P7 | Existing trees/benches/gates; opportunity is context and orientation, not more park attractions |
| R20-R23: transit thresholds, scaffolding, signs | T7, T12-T13; retained [subway/shed research](NYC_CITY_RESEARCH.md) | Eight repeated scenic mouths and existing occupied-building sheds; no working transit system |
| R24-R28, R31: purposeful use of current actors | P1-P3, T10-T11, T14 | Destination blocks and limited park circuits; buses have no passenger-stop dwell |
| R29, R32-R34: night, camera, grounding, fallback | P4 and retained [lighting research](LIGHTING_RESEARCH.md); camera/fallback choices are project-specific | Positional rather than use-aware window glow; repeated tour orientation; visual baseline/fallback drift |
| R30: signal behavior | T6, T9 | No separate yellow phase; safety implications exceed an art-only correction |
| R35-R37: later environmental or structural options | P12, B5-B8, T1-T2; mostly scope decisions | Current scale/grid, park, actor counts, and product exclusions remain binding |
| R38: user-requested street drains | First supplied drain image (`observed`), P8, T13 | Existing road/curb heights, weather surface, snow, pools, and access reservations must agree with the drain placement |
| R39: user-requested steam funnels | User's named feature; U1 (`secondary`, text only); operator retrieval gap | No steam system is modeled; a bounded original ambient stack/plume must not become a new traffic obstacle or unbudgeted effect |

## Implementation plan

The user approved the 37 concrete items (R01-R35, R38-R39), preserving the city layout and budgets. The later civic-facility request relaxes building/person counts only; it does not relax safety or rendering limits. Each phase remains a complete vertical slice with its own acceptance gates.

### Proposed design rules for the pilot

These are authored compatibility rules, not a claim that NYC buildings always follow them.

| Existing building vocabulary | Coherent treatment to test | Avoid |
| --- | --- | --- |
| Brownstone/rowhouse | Narrow repeated bays, raised residential threshold, a related stoop/areaway/cornice vocabulary, individual repair or paint variation | Office curtain-wall floors above an unrelated domestic stoop; identical water tank on each short rowhouse |
| Brick mixed-use building | Distinct commercial base, separate upper-floor entry, repeated residential bays, restrained visible services | Apartment windows simply overlaid with an awning; commercial displays covering the residential door |
| Loft-derived frontage | Taller-looking glazing proportions, structural piers or an original metal-front rhythm, clear base/middle/top | Treating the same apartment mesh recolored gray as a cast-iron building |
| Masonry office | Grouped floor glazing, a legible lobby, consistent pier/trim logic, restrained mechanical roof | Residential fire escapes, window AC units, or stoops carried over automatically |
| Later infill | Limited, coherent glazing/material contrast inside the existing envelope; deliberate transitions to neighbors | Random outlier heights or glossy blue glass throughout the district |
| Rear/party-wall/service face | Blank attached walls, sensible exposed-wall treatment, permitted service detail and preserved actual open space | Windows inside joints; filling a subway/bicycle opening to manufacture a continuous wall |

**Scale policy:** borrow relationships before dimensions. A real wide avenue, deep rear yard, or full-size bus cannot be transplanted into a 10.6 m-wide parcel or short approach merely because a source supplies its measurements. Keep human contacts, courts, and safe access authoritative. Improve the apparent base/middle/top proportion and hierarchy within the existing envelope first; any envelope change receives a separate clearance and visual review. Do not call that result a zoning-compliant NYC block.

**Budget policy:** prepare a per-pilot before/after ledger for triangles, submissions, materials, optional meshes, weather surfaces, and actor work. Removing a redundant trim mesh can finance a useful doorway reveal; replacing per-item decoration with shared color can finance a utility detail. These are candidates to measure, not promised savings. No new full-screen effect or dependency is needed for the first pilot.

### Phase 0 - Lock the target and visual baseline

**Deliverable:** one-page art brief for the fictional neighborhood, a map of retained frontage roles/openings, and repeatable overview/street/park/night captures.

- Confirm the recommended dense, mixed-use park neighborhood rather than a Midtown skyline, an all-brownstone enclave, or a borough sampler.
- Keep the current grid, 94 buildings, 328 people, 48 vehicles, park, trees, courts, stations, carts, controls, and resource ceilings.
- Classify every gap around the pilot as deliberate access/yard/planting or eligible infill. Zero lost civic openings is a gate.
- Capture the same seed, camera pose, retained time, weather, viewport, and quality for before/after comparisons; include reverse views of the pilot.
- Measure rendered and source costs separately on a named desktop/laptop before promising frame-rate headroom.

**Acceptance:** baseline inventory is reproducible; reference sheets distinguish photos from diagrams and current from historical conditions; every pilot reference has a source and provenance label. No implementation starts from a generic "make it busier" brief.

### Phase 1 - One coherent blockfront pilot

**Depends on:** Phase 0. **Covers:** R01-R08.

Use a short run of existing attached buildings in `block-1-2` or `block-3-2`, selected after checking station, subway, planting, and shed reservations. Refine a separate exposed corner only where its existing envelope supports it. Do not choose the transit apron merely because it looks empty.

**Likely surfaces:** `src/world/streetscape.ts`, `src/world/buildingFabric.ts`, `src/content/facades.ts`; the existing streetscape/scene tests. Add a small content manifest only if the approved authored roles cannot be clearly represented by those existing structures.

**Acceptance:**

- All 94 IDs and their approved use totals remain; the pilot visibly reads as a related run in both front and reverse views.
- At least three distinct original ground-floor compositions are demonstrated across the pilot and comparison frontage; upper-floor access stays separate.
- Attached faces remain blank, trim stays inside lot lines, and no doors or escapes face an inaccessible joint.
- Clearances for sidewalks, full bodies/umbrellas, sheds, trees, subway openings, bicycle access, and courts remain intact.
- No base-budget increase. If detail exceeds headroom, simplify redundant geometry before rollout.

**Decision gate:** compare the pilot with untouched buildings. Roll out its rules only if the improvement is visible at a normal desktop viewing distance, not just extreme zoom.

### Phase 2 - One connected street/corner section

**Depends on:** accepted Phase 1. **Covers:** R09-R16, R22-R23, R38, and R39 site selection.

Pair the pilot frontage with one real existing crossing and adjoining curb segment. Resolve centerline semantics, restrained parking treatment, paving scale, utility placement, and the furnishing/clear-path division together.

Include a **street-drain pilot** on an existing suitable curb segment: flush grate/frame, actual inlet recess where supported, restrained surrounding pavement repair, and agreement with existing wetness/snow support. Reserve a potential steam-stack site separately, without changing traffic or parked-car locations. Drains and steam outlets have different functions and are not interchangeable props.

**Likely surfaces:** `src/world/streetscape.ts`, `src/world/streetFurniture.ts`, `src/content/streetFurniture.ts`, `src/world/pavement.ts`, relevant sign modules; `streetscape`, `streetFurniture`, `pedestrians`, and `traffic` tests.

**Acceptance:** paint directions agree with the graph; every retained parked car/cart fits its original safe space; zero utility intrusion into crosswalks, station access, stop bars, or full-body pedestrian envelopes. Any pavement-height change updates walking support, ground cuts, precipitation capture, and snow behavior together. Two-way motor operation and protected cycling remain unchanged.

### Phase 3 - Park edge and transit threshold

**Depends on:** Phase 2's safe street section. **Covers:** R17-R23.

Refine an existing gate approach and its neighboring seating/tree/subway composition. Preserve the reservoir, bridge, fountain, pergolas, meadow, woodland, all tree sites, and both courts.

**Likely surfaces:** `src/content/park.ts`, `src/world/park.ts`, `src/content/metro.ts`, `src/content/lighting.ts`, `src/world/streetscape.ts`, and furniture content.

**Acceptance:** the gate reads as an arrival rather than a fence gap; seating has a readable orientation and clear approach; metro stairs remain genuinely open below grade in sun/rain/snow; all court runoffs and the 2 m shared passage remain. Step-free transit scenery, if approved, must not pretend to be a working accessibility feature.

### Phase 4 - Purposeful activity pilot

**Depends on:** Phases 1-3 destination geometry. **Covers:** R24-R28 and optionally R31.

Start with two existing walkers using one bench pocket and one shopfront pause, plus one existing bus using one approved stop. Extend only after those bounded states work. Do not raise population or build an arbitrary citywide service scheduler.

**Likely surfaces:** `src/world/pedestrians.ts`, `src/world/traffic.ts`, `src/world/actors.ts`, `src/world/locomotion.ts`; shared destination content alongside existing manifests.

**Acceptance:**

- Every activity has approach, occupied, departure, blocked/cancelled, and resumed behavior.
- Counts and IDs stay constant through use, weather changes, and recovery.
- No teleporting, standing in a through-lane, hidden permanent queues, bus/cycle conflicts, or starvation.
- Existing crossing capacity, arrival reservations, station access, opposite flows, and weather pace limits still apply.
- Pause/hidden-tab/context recovery restores exact position, activity owner, equipment, and clock without catch-up.
- Reduced motion yields a useful still or existing guided behavior, not a frozen broken transition.

### Phase 5 - Building-aware night and camera presentation

**Depends on:** accepted facade/use roles and Phase 2's utility site; can proceed independently of Phase 4 once those are stable. **Covers:** R29, R32-R34, R39.

Use the existing lighting and window instancing to make the same street coherent at dusk/night. Improve existing tour poses to show its street-wall character without returning removed selection/follow features. Refresh the fallback only after the art settles.

Add the **steam-funnel pilot** only after confirming its reference interpretation and effect budget: original stack, top-emitted pale plume, bounded wind response, distance/quality restraint, no independent timer, and exact pause/hidden/recovery behavior. Review a stationary reduced-motion version as well as the moving plume. The stack remains visible if lightweight quality omits the effect. It must not obscure crossings, vehicle signals, nearby entrances, or the city's controls.

**Additional likely surfaces:** the existing static streetscape/furniture builder, `src/world/environmentVisual.ts` and its lifecycle integration, `src/world/weatherPhysics.ts` for consumption of existing wind/state only, and relevant model/runtime/visual tests. A small dedicated effect module is warranted only if the existing effect owner cannot express this cleanly; no new dependency or steam-network simulation is proposed.

**Acceptance:** dark and lit windows still coexist; no synchronized district-wide switch, shared-resource leak, new material slot, or all-night neon treatment. Controls remain legible at 1024 x 768, 1440 x 900, and 1920 x 1080. Manual input cancels automation immediately; reduced-motion steps remain explicit.

### Phase 6 - Controlled rollout and integrated sign-off

**Depends on:** accepted pilot phases. Roll out the smallest successful rules, then review the whole district from multiple directions.

**Required implementation checks:** existing `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and applicable `npm run test:e2e` cases; targeted checks precede the full integration run. Do not modify failing assertions to declare success.

**Final gates:**

| Gate | Required outcome |
| --- | --- |
| Inventory | 94 building IDs, 328 people, 48 moving vehicles, 12 parked cars, four carts, three ten-bike stations, eight original subway mouths, all original park/court scenery retained unless a separate change is approved |
| Geometry/resources | Strictly below 640,000 base triangles, at most 110 submissions and 37 materials using existing counting conventions; effects and GPU measurements reported separately |
| Urban structure | Approved frontage roles are recognizable in normal overview and street views; no unexplained gaps, decorative inaccessible doors, overlapping party-wall details, or identical store rhythm everywhere |
| Physical access | Full moving body envelopes clear every changed object; crossings/landings, gate approaches, bike paths, station access, runoffs, and shared court passage remain unobstructed |
| Interior furnishing placement | No mailboxes, street benches, hydrants, or steam stacks on the exposed outer border strip; objects belong to distributed interior street/frontage/park-edge pockets, with both anti-perimeter and physical-clearance checks |
| Simulation | Deterministic progress across representative seeds, including existing long station-trip/wet/snow scenarios; no actor loss, overlap, starvation, or permanent waiting |
| Lifecycle | Exact paused/hidden/recovered state, no extra timers/listeners/material owners, and independently repeatable disposal |
| Visual matrix | Overview, reverse street wall, corner/storefront, park gate, transit threshold, courts, night, rain, snow, and mist; all supported quality presets and desktop widths |
| Device evidence | Named desktop/laptop, browser/OS, actual frame times and long-session behavior; CPU triangle counts never presented as FPS |
| Accessibility | Keyboard/manual control parity, readable focus/help/settings, reduced motion, and honest fallback; no new directory or landmark selector |
| Provenance | Original artwork only; reference images remain research; no copied logos, businesses, murals, maps, or agency route identities |
| Street drains | Flush, legible grates/inlets in approved locations; no wheel/body intrusion; wetness and snow agree with surfaces; no hydraulic claim without modeled and verified flow |
| Steam funnels | Safe retained site, legible original stack, bounded pale plume, controlled overdraw, readable signals/paths, deterministic pause/recovery, and a reduced-motion still |

### Recommended first implementation package

The original research recommended **Phase 0 plus the Phase 1 blockfront pilot** first. The user subsequently authorized all 37 concrete improvements, excluding R36-R37; implement them in bounded stages rather than treating that broader authorization as permission to skip the acceptance gates. Drains and steam funnels are included.

The bounded signal-transition improvement is authorized. Full-scale vehicles, one-way streets, a new skyline, and operational transit remain excluded. Additional buildings/people are permitted for the later civic-facility request, subject to the existing resource and access constraints. No delivery-time estimate is implied.

## Decisions and exclusions

| Decision | Recommended default | Requires separate approval |
| --- | --- | --- |
| Which NYC? | One original dense, mixed-use park neighborhood, learning from several real contexts without copying them | A borough-specific recreation, Midtown skyline, elevated corridor, waterfront, or literal map |
| Scale | Keep the selective miniature compression; improve proportions and coherence inside it | Wider/longer blocks, life-size buses/cars, new roads, or materially taller building envelopes |
| Density | Preserve 94 building IDs and 328 people; make existing activity more meaningful | The separately planned 464-person target or extra vehicles |
| Building fabric | Keep residential/office/store identity and improve related runs | Removing/replacing existing civic scenery, closing protected gaps, moving tree sites, or broad redistribution of uses |
| Traffic | Keep the two-way graph, protected cycling and reservation safety; the yellow transition and bounded bus/van pilots are approved | One-way conversion, further signal-policy changes, concurrent turning/pedestrian movement, bus boarding or a citywide loading scheduler |
| Park | Retain the complete original landscape and full-size courts | A new park layout, operational bridge route, removal of water features, or large new facilities |
| Transit | Improve scenic access context | Working subways, underground interiors, routes, train simulation, or real-time transport data |
| Art | Original geometry, fictional civic lettering, restrained contextual maintenance | Copied architecture, murals, branded taxis/bikes/stores, ads, commercial listings, or photo textures |
| Requested drains/steam funnels | R38/R39 implementation is approved within unchanged budgets and safe interior sites | Traffic/parking relocation, hydraulic/steam-network simulation, exact unseen-image matching or increased rendering budgets |

Do not equate NYC with permanent grime, danger, honking, emergency activity, ubiquitous neon, or a forest of identical water tanks. Do not remove safe cycle paths to imitate an unsafe photograph. Do not replace ordinary neighborhood fabric with landmark replicas. Keep this an ambient place, not an urban-management game or commercial platform.

## Reference-shot plan

**Still to do before final art approval:** inspect the actual source photographs and compare them with matched app views. The fresh external research was text/caption-based; no photograph described here is claimed as newly pixel-inspected. Existing retained [building-fabric photographs](NYC_BUILDING_FABRIC_RESEARCH.md#retained-real-life-photographs) are candidate references, not a substitute for checking their pixels and dates.

| Reference to inspect | App comparison | Question to answer |
| --- | --- | --- |
| Bedford residential run; the report cover identifies Hancock Street [B1] | One short attached frontage, front and oblique | Does repetition communicate individual houses within a coordinated row? |
| East 10th Street park edge [B2] | Park-facing mixed-use/residential frontage | Can changes of height, stoop, and current use remain coherent? |
| SoHo neighboring iron/masonry loft fronts [B3-B4] | Existing loft/office pair | Do materials change pier/spandrel/opening structure, not merely color? |
| Grand Concourse apartment frontage and light court [B5] | Broad existing building and an intentional opening | Can the miniature suggest a larger building type without falsely implying a deep modeled court? |
| Jackson Heights or Sunnyside access opening [B6-B7] | Retained bicycle/planting/subway pocket | Is the gap visibly purposeful and connected, rather than incidental leftover paving? |
| St. George uphill/downhill frontage [B8] | Contrast-only reference, not a proposed rebuild | Which low-density cues belong to a different NYC context and should not be forced into this scene? |
| Published lawful high-angle roof reference [B4, B9] | Same building from the app's elevated camera | Do parapet, access, tank/plant, and roof field form a plausible whole? |
| Crossing and sidewalk section [T3-T6] | Pilot intersection and both landing corridors | Do actual line meanings, ramp directions, pole placements, and waiting positions agree? |
| Parking regulation pole with its full curb segment [T7] | Existing parked-car segment | Does the sign explain a stretch of curb without turning each car into a parking-lot stall? |
| Bus arrival/departure next to a protected bikeway [T8, T10-T11] | Approved bus-stop pilot | Are right-side doors, cyclist movement, and passenger space genuinely compatible? |
| Related subway stairs, elevator, vent, and drainage context [T12-T13] | Existing transit apron | Are the functions distinguishable, access honest, and below-grade holes clear? |
| Park gate, court-viewing seat, and tree bed [P1, P3, P6-P7] | Existing gate/seat/tree group | Do entrances connect to usable destinations and do people face a plausible activity? |
| Repaired sidewalk and maintained planting [P9-P10] | Broad paving at the pilot | Can a few legible joints/repairs provide scale without noisy grunge? |
| Same public place by day, dusk, rain, and cold [P4, P12] | Matched retained app state | Do materials, light, clothing, and destination choices agree without inventing causal claims from one photograph? |

For every external image, record publisher/photographer, capture date if known, publication date separately, location/context, rights, inspected status, and only the visible evidence. Use lawful public viewpoints or published references; never enter private rear yards or roofs. Compare historical and contemporary conditions explicitly. Do not infer dimensions from a perspective image without calibration, behavior frequencies from one moment, or material albedo from mixed shadow/daylight pixels.

For the app, save seed, build SHA, camera position/yaw/pitch/zoom, viewport, DPR/quality, retained time, weather, pause state, and a before/after pair. Judge overview massing, block-level relationships, and close thresholds separately. Geometry hidden by one favorable camera does not count as fixed.

**User attachment record:** four images were supplied with the drain/steam follow-up. The first drain image (attachment beginning `1e3712db`) was visible and is described above; the second drain image (`d8d14f0a`) and both steam images (`08a2ada8`, `d091d38b`) were unavailable because of the image-view limit. Do not claim a four-image comparison or an exact steam-reference match. Inspect those images before locking stack proportions, banding, base treatment, or plume style. None has been copied into runtime assets or treated as a dimensioned installation drawing.

## Reference register

Fresh research access date: **2026-09-16, New York local time**. Undated means no publication/update date was identified in the relevant inspected content; a footer year is not treated as a publication date. Expanded sections of Street Design Manual pages were inspected where simplified page extraction omitted them.

### Architecture, neighborhood fabric, and zoning

For LPC reports, page references below count from the PDF cover, which can differ from printed pagination. They refer to text/inventories, not newly inspected photographs.

| ID | Source and date | Verified scope and limitation |
| --- | --- | --- |
| B1 | NYC LPC, [Bedford Historic District Designation Report](https://s-media.nyc.gov/agencies/lpc/lp/2514.pdf), 2015-12-08 | PDF pp. 11-12: mixed rowhouse/flat/institutional fabric, stylistic range, and coordinated rows. Selected historic district, not all Brooklyn. |
| B2 | NYC LPC, [East 10th Street Historic District Designation Report](https://s-media.nyc.gov/agencies/lpc/lp/2492.pdf), 2012-01-17 | PDF p. 8 and pp. 28-29, 36: park-edge building types, conversions, thresholds, front/rear distinction, escapes, and alterations. Conditions documented in 2012, not a current inspection. |
| B3 | NYC LPC, [SoHo-Cast Iron Historic District Designation Report](https://s-media.nyc.gov/agencies/lpc/lp/0768.pdf), 1973; designated 1973-08-14 | PDF pp. 11, 22-23: mixed materials, painted iron, prefabrication, repeated bays. OCR noise in the older scan; no present-day paint/color measurements inferred. |
| B4 | NYC LPC, [SoHo-Cast Iron Historic District Extension Designation Report](https://s-media.nyc.gov/agencies/lpc/lp/2362.pdf), 2010-05-11 | PDF pp. 75, 109: selected warehouse/store-factory fronts, roof tanks, elevator bulkhead, and additions. No tank dimensions or citywide prevalence established. |
| B5 | NYC LPC, [Grand Concourse Historic District Designation Report](https://s-media.nyc.gov/agencies/lpc/lp/2403.pdf), 2011-10-25 | PDF pp. 10-11, 32, 39: apartment-house forms, style clusters, courts, corner treatments, and localized repairs. Not representative of the entire Bronx. |
| B6 | NYC LPC, [Jackson Heights Historic District Designation Report](https://s-media.nyc.gov/agencies/lpc/lp/1831.pdf), 1993-10-19 | PDF pp. 10-12: block-scale planning, continuous/interrupted frontages, gardens, and commercial spine. The distinctive plan is reference, not a layout to reproduce. |
| B7 | NYC LPC, [Sunnyside Gardens Historic District Designation Report](https://s-media.nyc.gov/agencies/lpc/lp/2258.pdf), 2007-06-26 | PDF pp. 11, 33, 35: perimeter groups, interior courts, access paths, and block-level harmony with variation. A particular planned community, not generic Queens. |
| B8 | NYC LPC, [St. George Historic District Designation Report](https://s-media.nyc.gov/agencies/lpc/lp/1883.pdf), 1994-07-19 | PDF pp. 8-9: wood-frame domestic fabric, double houses, porches, mansards, terrain, and small commercial buildings. Not the whole of Staten Island. |
| B9 | NYC LPC, [Lever House Designation Report](https://s-media.nyc.gov/agencies/lpc/lp/1277.pdf), 1982-11-09 | PDF pp. 7-8: curtain-wall components, services, mechanical areas, and maintenance. An explicitly atypical individual landmark; never a massing template, replica, or ordinary-office prevalence claim. |
| B10 | NYC Planning, [ZR 23-342: Rear yard requirements](https://zoningresolution.planning.nyc.gov/article-ii/chapter-3/23-342), last amended 2024-12-05 | Conditional attachment/lot/height/shallow-lot provisions; normative, not a universal existing-building diagram. |
| B11 | NYC Planning, [ZR 23-433: Standard setback regulations](https://zoningresolution.planning.nyc.gov/article-ii/chapter-3/23-433), last amended 2024-12-05 | Lower street wall and upper setbacks, with frontage and district qualifications; not all NYC buildings. |
| B12 | NYC Planning, [ZR 23-412: Additional permitted obstructions](https://zoningresolution.planning.nyc.gov/article-ii/chapter-3/23-412), last amended 2024-12-05 | Tanks, bulkheads, mechanical equipment, screening, and qualified placement. Permission is not prevalence or a procedural spawn rate. |

Architecture coverage limits: LPC intentionally documents significant historic fabric. Ordinary contemporary infill, public-housing superblocks, large new residential towers, industrial districts, and more low-density outer-borough contexts were not comprehensively sampled. Some city HTML pages were blocked; the cited LPC PDFs and live zoning pages were accessible and read. No source photograph was pixel-inspected, and no current condition is inferred solely from an old designation report.

### Streets, markings, cycling, transit, and sanitation

| ID | Source and date | Verified scope and limitation |
| --- | --- | --- |
| T1 | NYC DOT, [Lanes](https://www.nycstreetdesign.info/geometry/lanes), undated | Context-sensitive lane choice, vehicle swept paths, pedestrian/cycling/transit requirements. Online manual identifies its [Fourth Edition background](https://www.nycstreetdesign.info/about/background). |
| T2 | NYC DOT, [181st Street Busway](https://www.nycstreetdesign.info/studies/181st-street-busway), undated | A documented two-way busway project with local access restrictions; not a universal numbered-street rule. |
| T3 | NYC DOT, [Full Sidewalk](https://www.nycstreetdesign.info/geometry/full-sidewalk) and [Furnishing Zone](https://www.nycstreetdesign.info/furniture/furnishing-zone), undated | Continuous walking space and the organization of curbside furnishings. |
| T4 | NYC DOT, [Pedestrian Ramps, Blended Transitions & Cut Throughs](https://www.nycstreetdesign.info/geometry/pedestrian-ramps-blended-transitions-cut-throughs), undated | Crossing-aligned transitions, warnings, and landing clearance; no universal warning-surface color inferred. |
| T5 | NYC DOT, [Pavement Markings](https://www.nycstreetdesign.info/material/pavement-markings), undated | Intended messages, legibility, placement, and MUTCD reference. |
| T6 | FHWA, [MUTCD, 11th Edition with Revision 1](https://mutcd.fhwa.dot.gov/pdfs/11th_Editionr1/mutcd11theditionr1hl.pdf), December 2025; [edition confirmation](https://mutcd.fhwa.dot.gov/kno_11th_Editionr1.htm) | Section 3A.03, printed p. 537: longitudinal color meaning; section 3B.19, printed p. 573: stop/yield lines. Read as functional reference, not miniature engineering certification. |
| T7 | NYC311, [Parking Signs and Rules](https://portal.311.nyc.gov/article/?kanumber=KA-01026), undated | Posted metal regulation signs, timing, alternate-side and hydrant restrictions; no proof of universal marked or unmarked parking. |
| T8 | NYC DOT, [Conventional Bike Lane](https://www.nycstreetdesign.info/geometry/conventional-bike-lane), [Protected Bike Lane](https://www.nycstreetdesign.info/geometry/protected-bike-lane), and [Two-Way Bike Lane](https://www.nycstreetdesign.info/geometry/two-way-bike-lane), undated | Facility distinctions and turning/visibility/loading concerns; not a measured distribution of NYC lane types. |
| T9 | NYC DOT, [Signal Timing Applications](https://www.nycstreetdesign.info/geometry/signal-timing-applications), undated | Context-specific timing, leading pedestrian intervals, coordination, transit priority, and accessibility. Does not validate this simulation's controller. |
| T10 | NYC DOT, [Bus Stop](https://www.nycstreetdesign.info/geometry/bus-stop) and [Bus Boarding Island](https://www.nycstreetdesign.info/geometry/bus-boarding-island), undated | Placement, right-side door zones, stop arrangements, cycling interfaces. Real minimum dimensions are not silently fitted into compressed blocks. |
| T11 | MTA, [Riding the bus](https://www.mta.info/guides/riding-the-bus), updated 2026-08-06; [Accessible Travel by Bus](https://www.mta.info/accessibility/bus), updated 2026-08-17 | Service categories, boarding differences, and accessible boarding. No fares, payment media, brands, or measured dwell averages are needed for the app. |
| T12 | MTA, [Accessible Stations](https://www.mta.info/accessibility/stations), updated 2026-09-14; [Accessible Travel by Subway](https://www.mta.info/accessibility/subway), updated 2025-12-15 | Entrance-specific and direction-dependent access, street/building elevators, and elevator status. No claim all entrances provide step-free access. |
| T13 | MTA, [Climate resilience](https://www.mta.info/climate/resilience) and [Climate Resilience Roadmap: 2025 Update](https://www.mta.info/document/190471), 2025 update | Printed pp. 10-13: vents, entrances, curbs, drainage, and flood interventions; not a reason to add steam or raised entrance steps everywhere. |
| T14 | NYC DOT, [Curb Management](https://www.nycstreetdesign.info/geometry/curb-management), undated | Freight, parking, loading, cargo bikes, handcarts, off-hour delivery, and microhubs as programs/context-specific uses. |
| T15 | NYC311, [Residential Waste Containerization](https://portal.311.nyc.gov/article/?kanumber=KA-03602) and [Residential Trash Rules](https://portal.311.nyc.gov/article/?kanumber=KA-02086), current provisions dated 2026 | Size-specific bin rules, phased larger-container rollout, set-out windows, and streams. Scheduled expansion is not observed completion; no branded bin copied. |

Street-research retrieval limits: some direct DOT/DSNY pages and the parking-sign PDF returned 403. Official NYC311 supplied the cited parking and sanitation evidence instead; inaccessible sign-sheet artwork was not treated as inspected. The manual's older waste summary was not used in place of the more precise current NYC311 program distinctions. No source photographs were pixel-inspected by this research thread.

### Public space, landscape, maintenance, and climate

| ID | Source and date | Verified scope and limitation |
| --- | --- | --- |
| P1 | NYC Parks / Design Trust for Public Space, [High Performance Landscape Guidelines: 21st Century Parks for NYC](https://www.nycgovparks.org/sub_about/go_greener/design_guidelines.pdf), 2010 | Relevant pages 38-46, 58, 62-64, 68: space types, recreation, access, and comfort. Historical design guidance, not a current facility census. |
| P2 | NYC DOT, [Pedestrian Plazas](https://www.nyc.gov/html/dot/html/pedestrians/nyc-plaza-program.shtml), undated | Reclaimed-street public spaces, partner management, activation, and construction stages. Possible programming is not constant observed use. |
| P3 | NYC Planning, [ZR 37-741: Seating](https://zr.planning.nyc.gov/article-iii/chapter-7/37-741), last amended 2009-06-10 | Solitary/social seating and arrangement provisions for the specified public-plaza zoning context, not all parks. |
| P4 | NYC Planning, [ZR 37-743: Lighting and electrical power](https://zr.planning.nyc.gov/article-iii/chapter-7/37-743), last amended 2011-02-02 | Walking/sitting areas, levels, canopy areas, and shielding. Not a photometric calibration for this renderer. |
| P5 | NYC DOT, [Clear Path](https://www.nycstreetdesign.info/furniture/clear-path), undated | Unobstructed pedestrian zone distinct from furnishing placement; individual elements can have additional requirements. |
| P6 | NYC DOT, [Tree Bed](https://www.nycstreetdesign.info/landscape/tree-bed), undated | Root space, preservation, planting conditions, protection, and maintenance; no instruction to impose real dimensions on narrow miniature parcels. |
| P7 | NYC DOT, [Tree Guards](https://www.nycstreetdesign.info/furniture/tree-guards), undated | Perimeter protection, curbside/setback contexts, and installation considerations. Current guidance is not proof of every existing installation. |
| P8 | NYC DOT, [Sidewalk Stormwater Management Practices](https://www.nycstreetdesign.info/landscape/sidewalk-stormwater-management-practices), undated | Performance, inlets, water flow, overflow, planting, and DEP-related standards/maintenance. Not a surveyed drainage network. |
| P9 | NYC DOT, [Landscape Maintenance Program](https://www.nycstreetdesign.info/studies/landscape-maintenance-program), undated | Cleanup, trimming, plant replacement, mulch/soil, watering, and seasonal maintenance tasks. |
| P10 | NYC DOT, [Unpigmented Concrete](https://www.nycstreetdesign.info/material/unpigmented-concrete), undated | Joints, flags, repair, and potential color differences. Its dimensional examples are not a new city-layout specification. |
| P11 | NYC DOT, [Litter Basket](https://www.nycstreetdesign.info/furniture/litter-basket), undated; describes rollout from fall 2023 | DSNY equipment and servicing contexts. This is a verified DOT account, not direct inspection of every bin or current DSNY deployment. |
| P12 | NOAA/NWS New York, [Normals and Extremes, Central Park, NY](https://www.weather.gov/media/okx/Climate/CentralPark/nycnormals.pdf), updated 2026-01-01 | Temperature on page 1 and precipitation/snowfall on page 2; 1991-2020 normals, not neighborhood weather probabilities. |

Public-space retrieval limits: Parks Without Borders and tree-care HTML pages were blocked; the accessible Parks design manual supplied the cited evidence instead. A DEP rain-garden URL returned an empty shell and attempted older DSNY paths were obsolete; no conclusions rely on those unavailable pages. No source photographs were pixel-inspected by this research thread.

### Follow-up drain and steam reference

| ID | Source and date | Verified scope and limitation |
| --- | --- | --- |
| U1 | Wikipedia, [New York City steam system](https://en.wikipedia.org/wiki/New_York_City_steam_system), retrieved 2026-09-16 | **Secondary source, not operator verification.** The inspected text describes orange/white street stacks and two possible causes of visible vapor: system leakage or cooler water contacting hot pipe exteriors. Photographs were not inspected; exact height, prevalence, operations, and the supplied images' appearance are not adopted as facts. |

The first supplied drain image is direct visual evidence, not a published/located NYC source. [DOT's stormwater-practices page](https://www.nycstreetdesign.info/landscape/sidewalk-stormwater-management-practices) was freshly re-read for this follow-up and verifies curb cuts/grates admitting roadway runoff to planted systems; it does not establish the hidden design of the photographed drains.

Con Edison's [steam-service](https://www.coned.com/en/our-energy-future/our-energy-projects/about-steam-service) and [steam-safety](https://www.coned.com/en/safety/energy-safety/steam-safety) pages returned 403, as did attempted DEP maintenance/catch-basin pages. Search fallbacks did not provide useful operator text. These are **retrieval gaps**, not verified source claims. Keep detailed operator verification and the three unseen user-image inspections as pre-implementation gates; the requested features are nevertheless fully included in the plan.
