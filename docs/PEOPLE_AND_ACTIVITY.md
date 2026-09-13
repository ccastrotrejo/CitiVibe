# People and activity

## Implemented population follow-up - 2026-09-13

The user's request expands the existing people, not the street grid or application UI. The previous implementation built a single articulated walker shape inside `scene.ts`, alternating two skin materials and four shirts. `ActorSimulation` and `CityTraffic` moved those figures along shared paths; `Locomotion` posed their hips, knees, ankles and arms. Cyclists and court players had separate integration paths. Those movement systems remain, with a shared original people builder and deterministic profiles.

| Population | Before | Now |
| --- | ---: | ---: |
| Neighborhood walkers | 96 | 144 |
| Gate-connected park walkers | 24 | 36 |
| Reservoir runners | 12 | 18 |
| Protected-lane cyclists | 12 | 12 |
| Court players | 6 | 6 |
| Meadow children / guardians | 0 | 6 / 2 |
| Active/posable human total | 150 | **224** |
| Resting picnic neighbors | 8 | 8 |
| Motor vehicles | 36 | 36 |

There are **232 people including resting figures**, up from 158. The 224 active/posable people include the two stationary guardians; 36 vehicles bring the active rig accounting total to 260. Two sports balls and the occasional airplane remain separate. Counts are fixed, not an unbounded spawning system or a claim about NYC density.

## Appearance and behavior

[`people.ts`](../src/content/people.ts) creates immutable, stable-ID profiles. Independent keyed samples select skin, body build, hair, glasses, garment colors and optional accessories. Changing someone's activity does not determine their skin or build. The scene does not store gender, ethnicity, health, salary or personality labels.

| Dimension | Implemented variation |
| --- | --- |
| Age | Children 7-11, teens 12-17, young adults 18-29, adults 30-59 and older adults 60-83. Children/teens are students, not adult workers. Older people can exercise, work, stroll or rest. |
| Stature | Authored child range approximately 1.12-1.47 m, teen range 1.44-1.81 m, adult range 1.53-1.93 m. These are reference statures, not exact mesh-top heights: hair and hats extend silhouettes. Child heads have a slightly larger proportion. |
| Build and skin | Seven skin colors and independently varied lateral build. Body shape and skin tone never select work roles or walking pace. |
| Hair | Cropped, bob, curls, ponytail, bun or bald, with multiple colors and optional gray hair. |
| Clothes | Suits, business-casual separates, hoodies, casual shirts, coats, tunics, overalls, scrubs, aprons, protective workwear, plain service uniforms and sportswear. |
| Accessories | Caps, beanies, sun hats, brimmed hats, simplified safety helmets, uniform caps, chef hats and cycling helmets; optional glasses, backpacks, satchels, briefcases and totes. Task-specific helmets override casual hats where appropriate. |
| Work roles | Lawyer, software engineer, analyst, office worker, firefighter, police officer, healthcare worker, construction worker, courier, chef, gardener, teacher and artist. All thirteen have work-clothed representatives in the shipped street manifest. |
| Running | Shorts with a distinct hem, exposed thighs/shanks, socks, trainers with contrasting soles, sports tops, optional caps, bent arms and a true flight interval. |

Desk jobs share clothing rather than each having one exclusive costume. A software engineer may wear a hoodie, office separates or a suit; lawyers and analysts can wear office separates. Protective clothing and service uniforms use invented colors, broad bands and plain shapes. Police figures have a small radio, belt and plain badge, **no weapons or real agency insignia**. Jobs are visual context, not functioning emergency services, careers, workplace access or schedules.

Desired walking speed is purpose-driven and individually varied: commuters 1.22-1.56 m/s, tourists 0.86-1.10 m/s, other walkers 0.94-1.29 m/s. Runners retain 2.4-2.65 m/s. These are the user's requested fictional behavior choices, not source-measured occupational averages. Congestion and safe headway take priority, so a commuter can still slow behind a strolling neighbor. Sightseeing park visitors pause briefly once per circuit. There is no overtaking, road-crossing pedestrian AI or destination-routing service.

Six shorter children run in three dephased, separated small circles in the south meadow near two guardians. They remain inside the authored play envelope, away from gates, walking paths, water, picnic blankets and courts. This is bounded ambient play, not a childcare or general crowd-behavior simulation. Eight existing picnic figures now use the varied people artwork in seated poses.

## Geometry, motion and resource ownership

[`person.ts`](../src/world/person.ts) attaches clothes, headwear, hair and bags to the existing skeleton. The skeleton is scaled in an inner root, leaving the actor's world transform and snow support unchanged. [`locomotion.ts`](../src/world/locomotion.ts) divides world distance/speed by stature scale before its local inverse-kinematics solve. Smaller people therefore take shorter steps rather than sliding smaller legs through an adult-length stride.

The conservative swept-body envelope is 0.8 x 1.2 m. Shared-route headway is 1.9 m; park geometric clearance is 1.65 m to include simultaneous next-tick movement through tight bends. The enlarged-body regression exposed overlaps that the old 0.7 m square proxy missed; the simulation spacing, not the assertions, was corrected. Actual articulated meshes are checked across gait phases against the new envelope.

Court skeleton scale and existing hand/paddle targets remain unchanged; appearance and sports clothing vary without rescaling courts or disconnecting contacts. Cyclists retain their existing fitted bicycle/pedal dimensions with varied rider build, skin, clothing, backpacks and helmet colors. Neither subsystem claims individually refitted anthropometric equipment.

[`PlayActivity`](../src/world/playActivity.ts) samples retained simulation time without timers or per-frame allocations. Circle and gait periods wrap independently, so a circuit seam does not reset a partial stride. Pause/hidden time retain the sample; rebuilding graphics reproduces it. Reduced motion uses the zero-time still, with only support height changing if resumed weather changes snow depth.

People borrow scene-owned boxes, 20-triangle head/hair geometry and **one neutral material**. [`ActorInstances`](../src/world/actorInstances.ts) uploads each part's color once and batches across the population; only transform matrices change during movement. No per-person materials, textures, React frame state, backend or downloaded artwork are introduced. Sidewalk headway checks are grouped by existing route instead of comparing each walker with the whole neighborhood.

The larger, richer human population revises the base source-scene triangle allowance from 550,000 to 600,000 (+9.1%); the 110-submission and 36-material limits remain unchanged. This is an explicit art-budget tradeoff, not a verified frame-rate increase or device-performance promise. Current measured results and browser limitations belong in [acceptance criteria](ACCEPTANCE_CRITERIA.md).

## Research evidence and limits

Public text references were checked on 2026-09-13. **Observed** below means the referenced source text was read; its statements are attributed guidance, not our measurements of real residents. **Proposed** means a design interpretation. Implementation descriptions above, unlike these proposals, refer to shipped source changes.

| Source | Observed source text | Proposed interpretation / implementation boundary |
| --- | --- | --- |
| [O*NET: Lawyers](https://www.onetonline.org/link/summary/23-1011.00) | Tasks include legal interpretation, consultation, document preparation/review and conferring with colleagues. | Shared office clothing and document-carrying cues are reasonable; a suit or briefcase does not identify every lawyer. No actual legal work is simulated. |
| [O*NET: Software Developers](https://www.onetonline.org/link/summary/15-1252.00) | Work includes requirements, design, testing, documentation and collaboration. | Backpacks and varied casual/formal clothing avoid a mandatory hoodie stereotype. Laptop work/conversation animations were considered but are not implemented. |
| [O*NET: Management Analysts](https://www.onetonline.org/link/summary/13-1111.00) | Tasks include gathering information, analyzing data, interviewing staff and documenting findings. | Office roles may share report/bag cues. This source covers management analysts, not every analyst specialty or all office employment. |
| [O*NET: Firefighters](https://www.onetonline.org/link/summary/33-2011.00) | Tasks reference protective clothing/equipment, maintenance, drills, inspections and public education. | Coat, boots, helmet and contrasting bands communicate a workwear variant. Geometry is not PPE certification; no emergency spectacle or equipment simulation is implemented. |
| [O*NET: Police and Sheriff's Patrol Officers](https://www.onetonline.org/link/summary/33-3051.00) | Foot patrol, road information, community relations and community programs are documented activities. | An unarmed walking uniform variant is sufficient; no copied agency branding, pursuit or demographic targeting. |
| [CCOHS: High-Visibility Safety Apparel](https://www.ccohs.ca/oshanswers/prevention/ppe/high_visibility.html) | Visibility apparel and contrasting bands help workers be noticed; fluorescence and retroreflection are different mechanisms. | Contrasting workwear bands are a visual cue only. There is no retroreflective shader, safety certification or requirement that every worker wear a vest. |
| [FHWA: MUTCD 2009, section 4E.06](https://mutcd.fhwa.dot.gov/htm/2009/part4/part4e.htm#section4E06) | Historical crossing guidance uses 3.5 ft/s in clearance calculations and explicitly considers slower pedestrians and wheelchair users. | Supports accommodating varied pace, not a measured walking average. This is historical guidance, not current traffic-code compliance or evidence of commuter/tourist speed differences. |
| [CDC: Growth Charts](https://www.cdc.gov/growthcharts/cdc-growth-charts.htm) | Percentile curves describe childhood/adolescent body-measurement distributions and help track growth; charts are not a sole diagnostic instrument. | Use multiple child/teen statures. The authored age-to-stature formula does not reproduce CDC percentiles or predict individual growth. |
| [WHO: Ageing and Health](https://www.who.int/news-room/fact-sheets/detail/ageing-and-health) | Age-related changes are not uniform; there is no typical older person. | Older people can run, work and rest. Gray hair is optional; old age does not impose a slow gait, stoop or mobility aid. Mobility-device rigs are not part of this implementation. |
| [NHS: Couch to 5K](https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/) | Recommends comfortable clothing, supportive running shoes and safety/visibility considerations; its program uses walk/run intervals. | Supports exercise-appropriate clothing and footwear. Shorts are the user's visual direction, not a universal running rule. Walk/run training intervals and phone armbands are not implemented. |

The researcher used O*NET and CCOHS after BLS/OSHA access returned HTTP 403. The NHS attire sections were verified in public HTML after its simplified extract omitted them. No images, models, fonts, code, real-city population records or private personal information were downloaded or shipped. Additional role variants (such as chef, gardener or artist) are original commonplace art choices, not independently measured occupational findings.
