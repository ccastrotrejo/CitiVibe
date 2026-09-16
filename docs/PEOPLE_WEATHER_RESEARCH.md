# Weather-aware people: research and implementation

Research date: **2026-09-16**. This is an original, deterministic miniature behavior system, not a calibrated model of NYC residents or a clothing/safety recommendation. The user approved visible departures through existing park gates, walking outside during adverse weather, and returning during sustained sunny weather. No indoor destinations, new population, street-grid changes or live weather service are authorized. The user subsequently approved commit, push and a pull request; deployment remains excluded.

## Findings that change the design

**Rain does not justify accelerating everybody.** Umbrella use changes the space people need, interactions with opposing traffic, and flow. An exposed person may want to hurry while actually moving slowly behind another pedestrian. Desired speed and collision-constrained speed must remain separate.

**Snowfall, cold air and ground snow are different inputs.** Clothing can respond to snowfall before much snow has accumulated; cautious locomotion should also persist on snow-covered ground after the sky clears. A sunny selection must not instantly erase snow or force people into summer clothing.

**Leaving a seat is an activity transition, not a visibility toggle.** Preserve each neighbor, stand before traveling, walk through an actual gate, and return to the same seat. The user specifically chose continuing along surrounding sidewalks, not disappearing into an invented shelter.

**A short sunny interruption is not a return signal.** Equipment and activity need separate confirmation delays. A returning person must recheck conditions before sitting. Rain that restarts during sitting should reverse the current pose without snapping back to a fully seated figure.

These findings inform the implementation below. The numerical choices are authored miniature tuning, not empirical population percentages.

## Evidence register

The research inspected eleven usable references directly. Seven further targets were located but could not be verified sufficiently. Labels distinguish observations reported by inspected studies from recommendations and implementation choices.

| # | Source and inspected evidence | What it supports | Limits |
| --- | --- | --- | --- |
| 1 | Guo et al., [Impact of holding umbrella on uni- and bi-directional pedestrian flow](https://arxiv.org/abs/1606.03434), [PDF](https://arxiv.org/pdf/1606.03434). Methods and conclusions inspected. | **Observed:** a controlled experiment with 100 undergraduate participants and 1 m umbrellas found changed flow and bidirectional lane formation. | Umbrella carrying is not the same experiment as exposure to rain. The sample and ring corridor do not establish NYC behavior or a universal speed multiplier. |
| 2 | Xie et al., [Experimental study on pedestrian flow characteristics at crosswalks under rainy conditions](https://ira.lib.polyu.edu.hk/handle/10397/102617), 2017. Institutional abstract inspected. | **Observed, abstract only:** 97 scenarios, repeated three times, varied rain intensity, width, density, umbrella share and directional split. These are interacting variables. | Full numerical results were not verified. No speed-reduction percentage is imported from search snippets. |
| 3 | Best and Wu, [Modified stepping behaviour during outdoor winter walking increases resistance to forward losses of stability](https://pmc.ncbi.nlm.nih.gov/articles/PMC10209205/), 2023, DOI 10.1038/s41598-023-34831-3. Methods, results and Table 2 inspected. | **Observed:** winter surface conditions changed stability-related behavior; the study did not find significant differences in mean speed, stride length or step width. | Seventeen participants; not evidence that winter never changes speed. Table 2 is nondimensionalized, not raw metres per second. |
| 4 | [Gait Speed with Anti-Slip Devices on Icy Pedestrian Crossings Relate to Perceived Fall-Risk and Balance](https://pmc.ncbi.nlm.nih.gov/articles/PMC6678553/), 2019, DOI 10.3390/ijerph16142451. Abstract and methods inspected. | **Observed:** perceived risk and balance relate to gait speed. A friction coefficient alone is insufficient to describe behavior. | Nine participants and nineteen anti-slip devices; not a general crowd or footwear model. |
| 5 | CDC, [Preventing hypothermia and frostbite](https://www.cdc.gov/winter-weather/prevention/index.html). Relevant clothing and wetness guidance inspected. | **Guidance:** layered loose-fitting clothes, water-resistant coat/boots, head covering and scarf are coherent winter protection; wetness matters even above freezing. | Advice does not measure how often people choose each outfit. No demographic or medical inference is made about individual characters. |
| 6 | US National Weather Service, [Outdoor lightning safety](https://www.weather.gov/safety/lightning-outdoors). Shelter distinctions inspected. | **Guidance:** an open-sided picnic shelter or tent is not a safe lightning shelter. | Thunderstorms are not this feature. The miniature's umbrella, pergola or outside walking behavior is never represented as lightning protection. |
| 7 | Robert Nystrom, [Game Programming Patterns: State](https://gameprogrammingpatterns.com/state.html). FSM chapter inspected. | **Technical reference:** explicit states and transitions prevent contradictory flags such as sitting and departing simultaneously. | Do not reproduce the book or import an unnecessary framework. A small local state machine suffices. |
| 8 | Glenn Fiedler, [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/). Fixed-step and bounded catch-up discussion inspected. | **Technical reference:** use bounded simulation steps rather than elapsed wall time for motion and transition delays. | Retain the repository's existing 30 Hz / maximum three steps per frame contract; research is not permission to change the clock or add interpolation. |
| 9 | PCG, [Minimal C library usage](https://www.pcg-random.org/using-pcg-c-basic.html). Initialization and stream documentation inspected. | **Technical reference:** reproducible initialization and independent streams separate appearance choices from routing. | Conceptual reference only. No PCG dependency or C implementation is added; the existing keyed person hash is reused. |
| 10 | Three.js, [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html). Live official documentation inspected. | **API documentation:** shared geometry/materials, local instance matrices, explicit buffer updates, dynamic bounds and disposal ownership. | Live docs are not a release-specific audit. This repository pins Three.js 0.186.0; local source and behavior checks govern compatibility. |
| 11 | Three.js, [Object3D](https://threejs.org/docs/pages/Object3D.html). Visibility and matrix properties inspected. | **API documentation:** visibility is distinct from a transform; local/world matrices have different roles. | Setting a hidden source object's `visible` flag does not remove its already-submitted instance. |

### Retrieval gaps, not supporting evidence

- [OSHA winter-weather precautions](https://www.osha.gov/winter-weather/hazards-precautions): HTTP 403/timeouts prevented verification of walking guidance.
- [Royal Meteorological Society / MetLink Beaufort scale](https://www.metlink.org/fieldwork-resource/beaufort-scale/): partial page retrieval did not verify the relevant umbrella row.
- [PLOS Climate recreation/weather review](https://doi.org/10.1371/journal.pclm.0000266): publisher/DOI retrieval timed out.
- [Dallas park mobility study](https://www.mdpi.com/2413-8851/8/2/59): publisher access failed. No visitation or dwell-time effects are claimed.
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): substantive text was not retrieved by the research run. Existing application behavior/tests, not this failed retrieval, establish the lifecycle contract.
- Historical Three.js r183 source targets: transport failures prevented inspection; r183 is also not the installed version. No release-specific guarantee is derived from that attempted lookup.
- [Three.js cleanup manual](https://threejs.org/manual/en/cleanup.html): transport failure; resource ownership is checked in the local scene instead.

Aggregate park attendance is not individual departure behavior. Even a verified reduction in visits would not prove that everybody already seated leaves immediately or that the same people later return. Those are explicitly authored rules requested for this miniature.

## Authored response policy

### Inputs and personal variation

`PeopleWeather` reads the blended environment frame, not just a dropdown label. Effective rainfall is `rain * rainIntensityMmH`; Rain at 0 mm/h therefore does not trigger rain equipment or departures. Snowfall, temperature, wind, wetness and retained ground snow are separate inputs.

`createWeatherTraits(id)` reuses the existing independent person hash with named weather keys. It chooses rain protection, response delay, hurry tendency, return delay, cold threshold and winter headwear without tying any of them to skin, age, build or occupation. It does not consume the pedestrian trip or road traffic random streams.

The approximately 58% umbrella preference is an **authored distribution**, not a surveyed rate. The actual visible share depends on response timing, runners, wind and cold. Runners use hands-free rainwear rather than carrying an open umbrella.

### Clothing and pace

| Rule | Authored value / behavior | Reason |
| --- | --- | --- |
| Rain response | Enter above 0.2 mm/h effective rain; remain active above 0.08 mm/h. | Avoid equipment flickering around a blended threshold. |
| Snow response | Enter above 0.08 snowfall weight; retain adverse conditions above 0.02. | Begin responding before the preset fully settles. |
| Clothing reaction | 0.8-4.0 simulation seconds, keyed per person. | Visible variation without a simultaneous crowd switch. |
| Umbrella transition | 0.6 simulation seconds. | A readable open/stow change, not per-frame creation/destruction. |
| Stowing/removing layers | At least 8 seconds of dry conditions plus the personal reaction delay. | Short sunny interruptions do not immediately reset everyone. |
| Winter layers | Snowfall or a personal cold threshold of 3-7 C; retain a 3 C warming margin. | Snow brings coats immediately after the reaction delay; sunny-but-cold retains them. |
| Wind policy | Prefer raincoat at 7 m/s; return to umbrella eligibility only after 5 seconds below 5.5 m/s. | An artistic anti-chatter rule, not a certified umbrella failure threshold. |
| Rain hurry | At most a 12% desired-pace increase, moderated by wetness. | Some people hurry, not all. Queues and clearances still dominate actual speed. |
| Snow-covered ground | Walking pace trends toward as low as 72% of dry pace; runners toward 60%. | Conservative miniature tuning, not a measured universal reduction. |
| Pace easing | 0.8-second response time. | Avoid a sudden speed jump at a weather threshold. |

Winter protection is an ensemble, not just a hat: coat, sleeves, head covering and scarf. Snow-covered-ground runners use conservative walking rather than an airborne running pose. Personal palette and identity remain; no branding or downloaded clothing assets are introduced.

Rain still permits short ordinary standing pauses on city sidewalks. The feature does not introduce destination-aware shelter seeking for every passerby, regional temperature fields, local umbrella collision physics, fall simulation or medical risk.

### The eight seated neighbors

The existing `picnic-neighbor-*` IDs become simulation-driven rather than static rendered figures. The total remains **328 people**. Eight formerly static people join the retained actor collection, bringing its size from 354 to **362 rigs**, not adding eight new people.

1. **Seated:** sustained rain/snow starts a personal reaction delay. Paired departure order leaves space for one neighbor to turn without blocking the other.
2. **Rising:** a 1.2-second grounded stand-up transition completes before horizontal travel begins.
3. **Departing:** walk through authored clear lawn approaches and the existing east gate. A retained gate reservation prevents two converging branches from trapping each other.
4. **Outside:** walk clockwise on the existing perimeter sidewalks, outside the fence and motor/cycle lanes. Nobody is hidden, destroyed, teleported, or gathered in an invented indoor shelter.
5. **Returning:** use the south entrance and existing northbound mall/east walking curves. Entering through a different gate avoids counterflow at the departure merge. Branch back onto the lawn and approach the original seat.
6. **Sitting:** recheck conditions, then lower into the seat with grounded feet. If rain resumes, reverse the current pose; if it resumes while returning, finish the safe path to the seat without sitting and depart again.

Return eligibility requires sustained Sunny, no active precipitation, temperatures above 8 C, ground-snow cover below 0.08 and a simplified dry-seat check. The wet-seat variable dries over approximately 60 simulation seconds; eligibility begins when less than 15% remains. This is a compressed visual rule, **not a moisture model or drying-time estimate**. A personal 5-25 second readiness delay and travel to the next south-gate opportunity stagger returns further.

The surrounding walk can take several simulated minutes. Sunny makes return eligible; it does not teleport everybody back or force a mid-sidewalk U-turn. The visible picnic pads remain existing scenery, not a newly modeled packing/inventory system.

## Integration and invariants

- CPU response/activity state belongs to the retained simulation. Rebuilding WebGL resources does not recreate the people, choose new clothes, reset posture, or restart a route.
- Pause and page suspension freeze reaction, equipment animation, travel, gait, wet-seat recovery and return timers. There is no hidden-tab catch-up.
- An explicit weather choice while paused updates clothing as a static appearance without advancing route/posture. Resume continues from the retained state.
- Weather modifies desired pedestrian pace before existing crossing, landing, destination-capacity and headway constraints. It never grants right of way.
- Full oriented body envelopes govern the additional park travelers. Same-direction headway uses a consistent leader/follower ordering; symmetric "both approaching" checks can deadlock at a merge.
- Exterior paths use distance-exact line segments and small corner bevels. A freely interpolated long rectangle overshot toward street signal hardware during development; the corrected route retains the existing sidewalk envelope.
- Optional garment meshes remain allocated, sharing existing primitives/materials. Because `ActorInstances` hides source meshes and copies their matrices, accessory suppression must affect the submitted transform, not rely on `visible`.
- No new React frame state, network calls, dependencies, weather menu, timers, buildings, park infrastructure or scene-budget increases.

## Verification targets and limits

The focused tests cover deterministic varied equipment, zero-intensity Rain, mixed precipitation, cold after sunshine, windy fallback, threshold chatter, wet-seat delay, complete departure/return cycles, interrupted returns, bounded steps, static paused appearance, actor identity, and real-population merges.

Route verification uses full oriented footprints against rendered solid scenery and excludes the pools and meadow play area. Clothing verification must cover every supported age/build, planted ankles through rise/sit and gait, compact canopy clearance, hand-to-shaft contact, dry restoration and uploaded instance matrices. Scene-budget checks must include the allocated weather geometry, not only whichever equipment is currently visible.

Browser verification should exercise real weather controls, paused pixel stability, genuine WebGL loss/restoration, and readable clothing at close range. Unit/CPU scene counts are not frame-rate evidence. Physical-device FPS, long-session comfort and all-angle aesthetic approval remain separate gates.

Executed outcomes belong in [acceptance criteria](ACCEPTANCE_CRITERIA.md); architecture and current behavior are summarized in [people and activity](PEOPLE_AND_ACTIVITY.md), [technical architecture](TECHNICAL_ARCHITECTURE.md) and the [experience contract](EXPERIENCE_SPEC.md).
