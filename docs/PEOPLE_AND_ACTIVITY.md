# People and activity

## Street-life population and bicycle activity - 2026-09-13

The bounded population increases from 232 to **328 people**, including eight unchanged picnic neighbors. There are 200 street walkers, 55 park walkers, 24 runners, fifteen road cyclists, nine additional roaming shared-bike riders, six court players, eight meadow family figures and three station users. Moving motor vehicles hold at **48**, preserving the six original buses. The older 464-person doubling target remains planned; the current increase is smaller.

Three original bike stations own ten persistent bicycles each in parallel side-by-side rows, with eleven docks and one adult user. Two occupy inter-building pockets and the third sits beside Juniper Court. The current simulation connects the three station users to road trips returning to their own dock; the earlier 0.8 m/48-second vignette description is historical. Nine bikes remain at the station while the tenth is away. The walking and riding representations are mutually exclusive, retain the same classic/electric type and use the same ID-derived clothing/skin colors. Hands track the moving saddle/release control in bicycle-local coordinates; a retained travel odometer drives wheels and walking without resetting at redocking.

**2026-09-16 correction:** Juniper's previous departure guard demanded an unrealistically large simultaneous gap in roadway, sidewalks and cycle traffic, so its rider could wait at the dock indefinitely. The rider now walks to the existing access and requests a short-lived crossing reservation. Bodies already inside or too close to brake clear first; approaching traffic and walkers hold outside. The grant remains until the rider and bicycle clear the access, in both directions. This is fictional miniature conflict arbitration, not a real NYC traffic-control installation. Signals, crosswalks, sidewalks, court runoffs and the park remain intact.

Classic blue bicycles mix with original silver electric models at every station and throughout the existing cycling fleet. Electric bikes have thicker low frames, dark battery enclosures, displays and larger front lamps, while retaining blue baskets and the same contact dimensions. Electric riders still pedal and obey the existing speed, braking, signal and weather limits; this is an appearance/operation distinction, not calibrated motor/battery physics. Green confirmation stays attached to the active dock, including Juniper's last slot, and never marks an away bike as locked. No extra people, bikes, rental UI or station-to-station destination selection is introduced.

Station poses sample retained simulation time and traffic state, including tire/foot support under snow. Pause and hidden suspension freeze both poses and reservations, graphics recovery reconstructs them, and reduced motion holds a docked still. Rigs join the existing shared actor batches with no new timers, React frame state or geometry/material owners. The [source study](NYC_CITY_RESEARCH.md#classic-and-electric-shared-bikes---2026-09-16) separates operator guidance from original miniature design.

### Two-way sidewalk movement

All 24 neighborhood blocks support genuine clockwise and counterclockwise travel on the same sidewalk, with a retained direction per person. Lane centers sit 6.2 and 7.2 m from road centers; the straight swept-body band is 5.8-7.6 m, with a 7.7 m building-side reservation through bends. The graph now has 144 directed crossing links, each 15.8 m long with a further two-metre protected landing. Crossing admission, the eight-person destination cap, seeded trip/rest choices and uninterrupted gait distance remain.

Local paving and zebra paint widen without changing the street grid, park-facing strips or cycle tracks. Building/stoop reductions, one small annex shift, adjusted shed supports, retained-ID street-lamp relocations, eight 0.30 m metro shifts, raised tree crowns and a 0.40 m court-fence shift keep the new lane clear. The road population uses deterministic bounded initial-lane reassignment when a seeded preferred lane is full; it does not silently omit vehicles.

The historical movement and population checkpoints below describe their earlier baseline, including the former one-way sidewalk graph; current verification belongs in [acceptance criteria](ACCEPTANCE_CRITERIA.md).

## Connected movement follow-up - 2026-09-13

Previously, all 144 neighborhood walkers repeated one clockwise loop around their assigned block. Their pace varied by profile, but they did not use the existing pedestrian signals or crosswalks. Park walkers used two fixed gate-connected circuits, runners used the reservoir loop, court players repeated bounded practice choreography, and meadow children followed small play circles. Those park, sports and family systems are preserved.

[`pedestrians.ts`](../src/world/pedestrians.ts) now connects the 24 neighborhood blocks with **72 directed crosswalk links**, matching the already painted zebras at intersections. Walkers choose destinations one to three block hops away, favor crossings that shorten the trip, and retain continuous position and heading at departure/arrival. Sidewalk travel stays clockwise; opposite pedestrian directions use opposite sides of an intersection. This is an original small routing graph, not NYC GIS or unrestricted navigation.

Each person has an independent seed stream for destination choices, trip pace (90-100% of their profile's desired pace), stopping positions and 1.5-6 second standing rests. Arriving at a destination leads to a mid-sidewalk pause, either neutral resting or a small looking-around torso turn. Sightseeing purpose favors looking around. Choices occur at trip decisions, not as per-frame positional noise. No new materials, figures, controls, timers or React frame state are added.

Crossing admission requires the pedestrian phase, an unoccupied intersection reservation, a clear crosswalk/landing corridor, and space on the destination block. One person reserves a junction at a time, including two metres beyond the far endpoint; incoming traffic remains behind existing stop bars. The three-second WALK admission window ends normally, then all-red clearance waits for the last reserved person to clear. Nobody must accelerate to beat the light. A failed attempt lasts at most twelve seconds before the walker continues around the block and chooses an alternative destination. An eight-person destination-block cap includes incoming reservations and prevents packing a whole narrow sidewalk loop solid.

The actor's continuous `travelDistance` drives the walking gait across block changes; route-local `distance` is never substituted into the gait at a transfer. Seeds, destinations, pauses and crossing reservations belong to the retained simulation. Pause/hidden-time suspension cannot advance them, and graphics restoration does not replace them. Reduced motion suppresses looking-around turns while preserving deliberate resumed stepping.

**Limits:** no overtaking, lane-changing crowd solver, conversation partners, building entry, working subway trips, or street-to-park itinerary transfer. Park visitors still enter/leave through their existing gates. Street walkers can remain on a block for multiple circuits when a destination is busy; not everyone must cross within the same time window. Bus schedules, court and meadow behavior are unchanged. The separately requested [population doubling](ROADMAP.md#next-planned-task---double-the-people) remains planned, not implemented.

### Movement research and design decisions

Primary-source text was checked on 2026-09-13. **Observed** means source text was verified, not that real residents or this application's behavior were measured. **Proposed** identifies the original miniature design interpretation; the implementation is described above. No source code, models, GIS or personal movement data is shipped.

| Primary source | Observed source guidance | Proposed interpretation and limits |
| --- | --- | --- |
| [Reynolds, Steering Behaviors for Autonomous Characters (1999)](https://www.red3d.com/cwr/steer/gdc99/) | The introduction separates action selection, steering and locomotion; graph pathfinding differs from following the resulting route. | Separate destination/activity decisions from geometric route following and the existing grounded gait. This does not establish actual pedestrian destination frequencies. |
| [Eclipse SUMO: Persons](https://sumo.dlr.de/docs/Specification/Persons.html) | Person plans connect walking, riding and stopping stages; stops can represent activities with durations or end times. | Use explicit walking and brief standing-activity states. Riding, shopping, building entry and working transit are not added. The chosen 1.5-6 second rests are artistic timing. |
| [Eclipse SUMO: Pedestrians](https://sumo.dlr.de/docs/Simulation/Pedestrians.html) | Sidewalks, crossings and connecting walking areas constrain routing. Excess inflow creates queues; vehicles cannot traverse occupied pedestrian conflicts. | Add real crosswalk edges and reserve the landing before entry. Clockwise routes, one-person junction ownership and the eight-person block cap are simplified choices, not a calibrated crowd model. SUMO's obstacle-ignoring jam recovery is deliberately not used. |
| [Eclipse SUMO: Randomness](https://sumo.dlr.de/docs/Simulation/Randomness.html) | Fixed seeds reproduce random sequences; separate streams decouple simulation aspects. | Give each walker a separate retained stream, independent of road-traffic randomness. Destination and activity choices within that person's stream are coupled; changing the rules does not promise compatibility with old replay fingerprints. Stable update order and retained timers matter as well as the seed. |
| [FHWA: MUTCD 11th Edition, Revision 1 (December 2025), section 4I.06](https://mutcd.fhwa.dot.gov/pdfs/11th_Editionr1/mutcd11theditionr1hl.pdf) | Printed pp. 723-725 distinguish WALK admission from clearance for people already crossing. Clearance guidance uses 3.5 ft/s (about 1.07 m/s), considers slower people, and specifies a minimum two-second steady-hand buffer before conflicting vehicles. WALK is generally at least seven seconds, with a four-second option in stated circumstances. | Preserve actual crossing occupancy rather than accelerating slower figures to beat a timer. **The miniature retains its three-second WALK admission and occupancy-held all-red phase; these timings and the two-metre landing reservation are not MUTCD-compliant signal design or the specified two-second buffer.** No traffic-engineering or accessibility certification is claimed. |

SUMO text was verified against its primary documentation source, including `Specification/Persons.md` (plans/stops), `Simulation/Pedestrians.md` (connectivity, queues, conflicts) and `Simulation/Randomness.md` (seed/stream behavior). The current FHWA guidance above supersedes the historical 2009 reference below for this movement study. These sources support purposeful trips, constrained crossings and repeatability, not the particular one-to-three-hop range, clockwise circulation, activity weights or crowd cap.

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

Profile walking speed is purpose-driven and individually varied: commuters 1.22-1.56 m/s, tourists 0.86-1.10 m/s, other walkers 0.94-1.29 m/s. Street trips use 90-100% of that desired pace. Runners retain 2.4-2.65 m/s. These are fictional behavior choices, not source-measured occupational averages. Congestion, safe headway and crossing clearance take priority, so a commuter can still slow behind a strolling neighbor. Sightseeing park visitors pause briefly once per circuit. The connected street-trip follow-up above supersedes the earlier sidewalk-loop-only behavior.

Six shorter children run in three dephased, separated small circles in the south meadow near two guardians. They remain inside the authored play envelope, away from gates, walking paths, water, picnic blankets and courts. This is bounded ambient play, not a childcare or general crowd-behavior simulation. Eight existing picnic figures now use the varied people artwork in seated poses.

## Geometry, motion and resource ownership

[`person.ts`](../src/world/person.ts) attaches clothes, headwear, hair and bags to the existing skeleton. The skeleton is scaled in an inner root, leaving the actor's world transform and snow support unchanged. [`locomotion.ts`](../src/world/locomotion.ts) divides world distance/speed by stature scale before its local inverse-kinematics solve. Smaller people therefore take shorter steps rather than sliding smaller legs through an adult-length stride.

The conservative swept-body envelope is 0.8 x 1.2 m. Shared-route headway is 1.9 m; park geometric clearance is 1.65 m to include simultaneous next-tick movement through tight bends. The enlarged-body regression exposed overlaps that the old 0.7 m square proxy missed; the simulation spacing, not the assertions, was corrected. Actual articulated meshes are checked across gait phases against the new envelope.

Court skeleton scale and existing hand/paddle targets remain unchanged; appearance and sports clothing vary without rescaling courts or disconnecting contacts. Cyclists retain their existing fitted bicycle/pedal dimensions with varied rider build, skin, clothing, backpacks and helmet colors. Neither subsystem claims individually refitted anthropometric equipment.

[`PlayActivity`](../src/world/playActivity.ts) samples retained simulation time without timers or per-frame allocations. Circle and gait periods wrap independently, so a circuit seam does not reset a partial stride. Pause/hidden time retain the sample; rebuilding graphics reproduces it. Reduced motion uses the zero-time still, with only support height changing if resumed weather changes snow depth.

People borrow scene-owned boxes, 20-triangle head/hair geometry and **one neutral material**. [`ActorInstances`](../src/world/actorInstances.ts) uploads each part's color once and batches across the population; only transform matrices change during movement. No per-person materials, textures, React frame state, backend or downloaded artwork are introduced. Sidewalk headway checks are grouped by current block; crosswalk admission additionally checks the population against its reserved corridor.

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
