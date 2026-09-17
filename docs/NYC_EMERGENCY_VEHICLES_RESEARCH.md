# NYC emergency vehicle study - 2026-09-16

The user requested a substantial, internet-informed improvement to the miniature's police, ambulance and firefighter vehicles. The starting scene contained four ambulances and four fire-service vehicles, but no dedicated police vehicle model. This slice refines those eight and replaces two existing sedans with original patrol SUVs, retaining their IDs and traffic slots. It does not add actors or emergency-response behavior.

## Evidence and provenance

Source pages, original-image links and the listed photograph licenses were verified during this study. References are inert research, not runtime assets, executable input or instructions. `Observed` metadata means what the source page actually reports, not an independently measured fleet specification. Builder statements are `operator-declared`. The rendered models are authored interpretations.

| ID | Verified source | Evidence and limits |
| --- | --- | --- |
| P1 | [NYPD Midtown South patrol SUV](https://commons.wikimedia.org/wiki/File:NYPD_Midtown_South_Precinct_Ford_Police_Interceptor_Utility_%283707-17%29.jpg) | `Observed` page metadata: vehicle 3707-17, 8 August 2023, Jason Lawrence, Flickr provenance, CC BY 2.0. [Original photograph](https://upload.wikimedia.org/wikipedia/commons/0/00/NYPD_Midtown_South_Precinct_Ford_Police_Interceptor_Utility_%283707-17%29.jpg). |
| P2 | [NYPD 114th Precinct patrol SUV](https://commons.wikimedia.org/wiki/File:NYPD_114_Precinct_New_Ford_Police_Interceptor_Utility_%283652-23%29.jpg) | `Observed` page metadata: vehicle 3652-23, Long Island City, Queens, 31 March 2024, Jason Lawrence, CC BY 2.0. A second generation reference, not proof that all patrol SUVs use identical graphics or equipment. |
| P3 | [NYPD vehicle history](https://en.wikipedia.org/wiki/List_of_vehicles_of_the_New_York_City_Police_Department) | `Observed` secondary-source text describes white bodies with two blue side stripes and later graphics changes beginning in 2023. This supports white/blue color blocking, not one universal current livery. |
| A1 | [FDNY Ambulance 1389](https://commons.wikimedia.org/wiki/File:FDNY_Ambulance_1389_001.jpg) | `Observed` page metadata: Battery Park City, 12 October 2024, Kidfly182, CC BY 4.0. [Original photograph](https://upload.wikimedia.org/wikipedia/commons/8/88/FDNY_Ambulance_1389_001.jpg). The model does not reproduce its unit number or department graphics. |
| A2 | [FDNY Ambulance 048, rear view](https://commons.wikimedia.org/wiki/File:FDNY_Ambulance_048_Rear_View.JPG) | `Observed` page metadata explicitly identifies a rear view in Ozone Park, Queens, with a 2012 date; Youngking11, CC BY-SA 3.0. Older equipment is not treated as the current fleet standard. |
| A3 | [Horton Type 1 ambulances](https://hortonambulance.com/ambulances/type-1-ambulances/) | `Operator-declared`: Type 1 uses a truck chassis, with four-wheel-drive options and large-city applications. This supports the cab/module distinction; it does not identify the manufacturer or dimensions of A1/A2. No open image license verified. |
| E1 | [FDNY Engine 222 / Seagrave Marauder II](https://commons.wikimedia.org/wiki/File:2010_Seagrave_Marauder_II_at_FDIC_in_Indianapolis.jpg) | `Observed` metadata: 2010 FDNY Engine 222, photographed at FDIC in Indianapolis, 1 April 2010; Zmast28, CC BY-SA 3.0, with GFDL also offered. [Original photograph](https://upload.wikimedia.org/wikipedia/commons/b/b5/2010_Seagrave_Marauder_II_at_FDIC_in_Indianapolis.jpg). This is FDNY apparatus, not a photograph taken on an NYC street. |
| E2 | [FDNY Engine 15 source page](https://commons.wikimedia.org/wiki/File:FDNY_Engine_15_001.jpg) | `Observed` page metadata: Lower Manhattan, 17 January 2023, Kidfly182, CC BY-SA 4.0. Retained as additional fleet context; the page title alone does not verify chassis type or equipment layout. |
| E3 | [Seagrave custom pumpers](https://seagrave.com/Our-Trucks/Pumper/Custom) | `Operator-declared`: configurable equipment layouts, stainless-steel bodies, alternative body materials and multiple pump options. These are product-family statements, not Engine 222 specifications. No open image license verified. |

The research agent could verify photo metadata but not inspect image pixels. The implementation pass downloaded P1, A1 and E1 into session-only research storage; E1 was directly viewable and confirms a tall crew cab, white upper/red lower body, an exposed metallic pump panel with circular gauges/couplings, side-carried equipment and large tires. Other source-derived statements above remain labeled as metadata or text rather than claiming measurements from photographs. No verified top-down view or fleet dimensions were obtained.

Photograph licenses cover the photographs, not permission to copy department insignia or manufacturer branding. No photograph, source-site model, font, logo, badge, unit number, slogan or texture is included in the application or this PR.

## Authored translation into the miniature

| Vehicle | Implemented design | Deliberate simplification |
| --- | --- | --- |
| Patrol SUV | White body, blue side belt, tapered cabin and hood, sloping windshield pillars, separate quarter glass, dark grille, push-bumper uprights, mirrors, roof lightbar and hatch trim. | Two existing sedan slots (`city-vehicle-1`, `city-vehicle-25`) retain their IDs. No NYPD lettering, shield or actual livery layout. |
| Box ambulance | Lower, narrower truck cab in front of a taller white patient module; red lower belt with an original inset stripe; side locker, six-arm blue medical identifier, paired rear doors/windows, loading step, roof ventilation and upper perimeter warning lamps. | The module is an original shape, not an A1/A2 replica. Striping, roof equipment and medical mark are authored. |
| Compact ambulance | Shorter high-roof body with a raised cab cap, the same service palette, smaller lockers, rear patient doors and perimeter lighting. | Preserves the existing compact variant; this study does not establish it as a particular FDNY van model. |
| Pumper engine | Cab-forward crew compartment, divided windshield, white roof, red equipment body, metallic pump panel and outlets, ribbed compartment shutters, open hose bed, folded hose loads, stowed ground ladders and rear chevrons. | Not an aerial ladder truck. No extended ladder, copied apparatus layout, operating hoses or firefighting scenario. |
| Fire-command SUV | The refined SUV shell in red/white with roof rails and steady red warning lamps. | Preserves the existing fire-service SUV role; not a verified specific FDNY command-car replica. |

Recognition comes from silhouette and equipment organization before tiny markings. A pumper has a cab/pump/equipment sequence, an ambulance has a cab/patient-module step, and a patrol SUV has passenger glazing and a shorter roof. The old ambulance and engine windshields were placed behind solid cab geometry; the replacement windshields face outward and have ray-based visibility coverage.

All numeric dimensions are **authored, compressed miniature proportions**. Length reservations remain 2.8 m for SUVs, 3.5 m for compact ambulances and 4.6 m for box ambulances/pumpers. Visible shells, wheels, mirrors, trim and driving-lamp lenses fit inside the existing safety envelopes. These are not measurements of real NYC vehicles and are not traffic or emergency-equipment certification.

## Behavior and resource boundary

Traffic count remains 48 motor vehicles. All previous emergency IDs, six buses, route order, random draws, stop/signal rules, cyclist and pedestrian priority, parked cars, scenery, controls and sound remain. There are no sirens, dispatch tasks, pursuit behavior, priority overrides or emergency-speed changes.

Each vehicle keeps its four grounded wheel pivots and eleven driving-lamp sockets. Head/tail/brake/turn lamps remain controlled by the existing retained lighting system. Warning bars remain steady, including under reduced motion; there is no new flashing clock. Bodywork borrows the existing white weather-aware material and uses per-instance tints, preserving wet/snow surface shading without changing people's materials. One scene-owned tapered primitive adds sloped SUV forms; there is no new material, texture, dependency or per-frame allocation.

The final base scene measures **638,803 triangles, 109 visible mesh submissions and 37 materials**, within the unchanged current code ceilings of **less than 640,000 / at most 110 / at most 37**. The starting checkpoint measured 632,843 / 109 / 37. This is CPU scene accounting, not a frame-rate or complete weather-pass measurement. See [acceptance criteria](ACCEPTANCE_CRITERIA.md#nyc-emergency-vehicle-refinement---2026-09-16) for executed checks and remaining limits.
