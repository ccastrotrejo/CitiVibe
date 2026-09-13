# Night lighting: physics, perception and implementation

**Research date: 2026-09-13.** This is a source-backed lighting study and implementation record for the original CitiVibe miniature. Sixteen primary references cover photometry, light transport, display rendering, outdoor lighting, vehicle signals and WebGL resource management. The scene is physically informed artwork, not calibrated roadway illumination, automotive certification or a full light-transport simulation.

The user's request is better, smoother nighttime lighting and functioning headlights, rear/brake lamps and indicators. Latest `origin/main` was fetched before edits; the worktree was already at `b81eb32`. The larger city, car-free park, courts, population, weather and controls remain unchanged.

## Evidence and scope

- **Observed:** source pages and r186 implementation documentation were inspected; local source inspection found hard-edged additive light discs, painted vehicle lamp plates, and vehicle glazing sharing building-window emission.
- **Operator-declared:** published Three.js behavior, government standards and technical-author explanations below. Reading a standard does not establish that this fictional scene meets it.
- **Inferred:** practical consequences of the physics for this orthographic scene.
- **Proposed / implemented:** artistic RGB values, intensity budgets, miniature lamp dimensions and signal anticipation distances. These are not measurements recovered from New York or an existing game.

No source model, texture, photograph, font, map, logo, live API or third-party runtime service is included. Reference material is inert research, never executable app input.

## 1. What light quantities mean

Photometry weights light by visual sensitivity; radiometry measures electromagnetic energy. They are related but not interchangeable [S9].

| Quantity | Unit | Interpretation |
| --- | --- | --- |
| Luminous flux | lumen | Total visible-light output |
| Luminous intensity | candela | Output per solid angle in a direction |
| Illuminance | lux | Incident luminous flux per surface area |
| Luminance | candela per square metre | Directional light leaving a surface |

For an ideal point source, incident illuminance is proportional to

`E = I(direction) * max(0, cos(theta)) / distance^2`.

The cosine term accounts for the receiving surface's orientation. Doubling source-to-surface distance reduces illumination to one quarter, before considering occlusion or fog. A bare source and a shielded luminaire with the same total output need not illuminate the same places.

Three.js's point-light intensity is in candela, and its default decay exponent is two [S3]. Its point-source power relation, `lumens = 4 * pi * candela`, assumes isotropic emission; it is not a universal conversion for headlamps or street fixtures. A positive distance limit adds a smooth, deliberately nonphysical cutoff. r186 also bounds the near-source singularity.

**Application:** retain `decay = 2` for the real local spotlights. Use downward aiming and feathered angular cones instead of making light travel infinitely far. Scene geometry is in metres, but artistic materials, exposure and simplified sources mean no measured-lux claim is justified. Orthographic projection changes framing, not the inverse-square law between lamp and road.

## 2. Four different meanings of "smooth light"

| Effect | Physical/rendering cause | What it cannot replace |
| --- | --- | --- |
| Gradual falloff | Distance, incidence and emission direction | Correct color conversion |
| Soft shadow edge | Finite emitter size and occluder geometry | A larger painted glow |
| Feathered spotlight boundary | Angular intensity distribution | Actual area-light shadows |
| Halo or bloom | Optical/image-space spread of a bright source | Illumination of nearby surfaces |

Finite area emitters create penumbrae [S16]. `SpotLight.penumbra` softens its cone, not its shadow. Shadow-map filtering addresses sampling artifacts; it does not reconstruct finite-emitter transport [S5].

An emissive mesh looks luminous, but ordinary forward rendering does not make it light its surroundings [S4]. This was important here: vehicle lamp plates were merely painted; replacing their colors alone would still leave the road dark.

Bloom operates on the rendered image. Three.js's bloom pass extracts bright content and blurs multiple resolutions [S8]. Excessive bloom erases signal colors, merges adjacent lamps and makes streets look foggy even in clear weather.

**Implemented:** soft ground footprints, small depth-tested source halos, explicit luminous lenses and a bounded set of actual local lights. No full-screen bloom/composer was added. The halos are a restrained optical cue, not simulated volumetric scattering or a claim that the air itself emits light.

## 3. Linear color and highlight handling

Three.js calculates lighting in Linear-sRGB. CSS/hex colors are interpreted as sRGB and converted to the working space; color/emission textures and numeric data maps have different color-space roles [S1, S4]. A normal or height map must not receive the same conversion as a color photograph.

The renderer defaults to sRGB output but no tone mapping [S2]. Missing or double output conversion can make a scene washed out, harsh or unexpectedly dark. Increasing intensity does not fix that pipeline.

**Implemented:**

- Explicit sRGB output and Neutral tone mapping at exposure 1.
- Existing environment palettes remain linear; procedural height/retention and halo masks remain data textures.
- Shader-authored ground illumination uses the tone-mapping and output-color shader chunks.
- Existing directional shadows use PCF soft filtering without larger shadow textures.
- Vehicle glazing no longer carries the building-window tag. It stays dark glass at night rather than glowing like an occupied apartment.
- Building windows keep their existing deterministic occupancy and warm/cool variety.

Neutral tone mapping provides a highlight shoulder without introducing a new automatic-exposure clock. Lens color, placement and intensity differences must remain readable after the display transform.

**Limitation:** additive cues are composited directly rather than accumulated in a dedicated linear HDR render target with one final output pass. They are intentionally low intensity and visually tuned, not a photometrically exact composition pipeline.

## 4. Outdoor lighting and the nighttime composition

DarkSky and the Illuminating Engineering Society recommend useful, targeted, low-level, controlled, warm-colored outdoor lighting [S12]. The goal is not to make every surface equally bright.

Warm path lighting against a cooler ambient sky helps distinguish routes from vegetation. Exact correlated color temperature would require spectral information; RGB swatches only approximate its appearance. The warm `#ffdab0` public-light tint and near-neutral `#fff1db` vehicle tint are authored colors, not calibrated Kelvin conversions.

**Implemented public-light behavior:**

- All 66 street fixtures and fifteen park lamps retain their positions.
- Street lamps have an opaque upper housing and a luminous underside rather than an entirely glowing block.
- Street footprints have 6.5 m support radii; park footprints use 4.6 m and less intensity. These are finite supports, not uniform bright circles.
- The core fades with `1 / (1 + 5*r*r)^1.5`, multiplied by a smooth cutoff between normalized radius 0.65 and 1. The exponent is motivated by inverse-square distance plus cosine incidence on a plane; the scale and cutoff are artistic.
- Small halos retain depth testing and never write depth.
- Taxi roof signs and the sixteen globes at eight subway entrances now share the dusk-driven fixture emission. They remain original unbranded scenery, not operational taxi or transit status.
- All public emission and footprints follow the retained environment's continuous night value.

The finite footprint is a lighting approximation, not an IES photometric distribution. It deliberately leaves dark intervals, lawns and roofs rather than making the whole city uniformly emissive.

## 5. Receiving surfaces, wet roads and snow

At a smooth water boundary, reflection depends strongly on angle. PBRT gives water's refractive index near 1.333 and describes Fresnel reflection [S11]. At normal incidence, an air/water interface reflects only about two percent; reflectance increases toward grazing angles. Wet asphalt also combines water, rough aggregate, absorption and geometry, so it should not become a perfect mirror.

The existing weather adapter already darkens wet exposed surfaces and lowers roughness. **This pass preserves that behavior.** Nearby real spotlights can produce material-dependent highlights. Decorative diffuse footprints are reduced on wet ground instead of being mislabeled as accurate reflections.

Ground-light meshes sample the same 0.5 m static top-envelope information used for weather:

1. Height and local snow retention are stored together in one fixed RG float texture.
2. A small tessellated plane follows near-ground height and retained snow depth.
3. The fragment shader rejects roofs, elevated structures and below-grade openings outside the ground-height band.
4. A small depth separation avoids coplanar fighting; ordinary depth testing hides the footprint behind camera-visible geometry.

**Important distinction:** depth testing is camera visibility, not lamp-to-surface visibility. The height-band mask prevents pools on rooftops and down stairwells, but it is not ray-traced occlusion. The top envelope also cannot describe every surface under a canopy. Local lights are unshadowed, so limited wall/foliage light leakage remains possible. No planar reflections, screen-space reflections, wet-road ray tracing or spatial hydrology were added.

## 6. Fog and glare

For a homogeneous participating medium, direct transmittance follows Beer-Lambert attenuation, `T(d) = exp(-sigma_t*d)` [S10]. Scattering into the view also depends on the light field and phase function.

Three.js's ordinary exponential fog blends surface color with a fog color; it does not solve lamp-lit volumetric scattering. Increasing fog density alone cannot create physically correct headlight shafts.

**Implemented:** preserve the existing weather fog and gently broaden static halos in mist. Headlight cues stay on the ground; no large luminous cones are drawn through clear air. This is deliberately subtler than a volumetric effect and avoids a new raymarching pass.

## 7. Vehicle lamp colors and functions

FMVSS No. 108's Table I-a distinguishes lamp functions and placement [S13]. The complete standard contains detailed applicability, photometry and installation requirements; this table is only a design reference.

| Function | Standards-derived pattern | CitiVibe implementation |
| --- | --- | --- |
| Headlamps | White, forward-facing pair | Two visible front lenses and paired forward road footprints |
| Taillamps | Red rear pair | Two steady red rear lenses when driving lights are on |
| Stop lamps | Red, activated by service braking | Rear lenses brighten during deceleration and brake-held traffic stops |
| Front indicators | Amber | Separate left/right amber front lenses |
| Rear indicators | Amber or red | Separate amber rear lenses, distinguishable from braking |
| High-mounted stop lamp | Red; vehicle-class applicability varies | A small red upper brake element on the original rigs |
| Reverse lamps | White, active for reverse | Not added: current vehicles never reverse |

Amber rear indicators are allowed in the referenced US standard, not universally mandated. The city also uses small side repeaters for miniature readability, not a claim that all vehicle classes require the same installation.

All 36 motor vehicles, including buses, vans, trucks and taxis, use the same behavior contract. Lamps attach to the actual body transform, including heading and suspension. The sedan/taxi upper brake element sits against the rear cabin rather than floating over the trunk.

### Headlight activation

Lights fade with nighttime demand and also operate in rain, snow or poor visibility during daylight. The activation function combines night, rainfall intensity, snow and the existing mist/fog value. It does not fetch real weather. Clear afternoon driving does not require bright headlight pools; brake and turn signals still function in daylight.

This is a chosen visibility policy, not a complete implementation of every jurisdiction's lighting law or ambient-light sensor.

### Brake logic

The standard links stop lamps to brake application, not simply being motionless. The miniature has no separately modeled brake pedal, so its existing traffic solver supplies an explicit proxy: deceleration above 0.2 m/s², or a traffic wait with the service brake assumed held.

Brake intensity is independent of nighttime brightness. Tail level is 0.3 and brake level 1 before artistic lens scaling, yielding a clearly stronger stop indication. This ratio is not a legal photometric result. At a normal moving cruise, the brake state is off.

## 8. Turn intent and timing

A turn indicator should communicate the upcoming route, not infer intention only after the body has started rotating.

**Implemented:** the traffic solver reads the current route segment and its immediate next junction. It signals within 12 miniature metres before an actual turn, remains active while queued and throughout the junction, and cancels when established on the outgoing link. A straight junction does not inherit a later turn's signal. Left/right follows the driver's frame: vehicle artwork faces local +Z, so its left is local +X.

The existing routing, speeds, reservations and traffic-signal schedule are not changed. Historical motion fingerprints remain identical after omitting only the newly added lighting metadata.

FMVSS Figure 2 has flash-rate and duty-cycle test envelopes with class-dependent details [S13]. Its outer chart spans 60-120 flashes/minute and 30-75% current-on time; that bounding rectangle is not a universal compliance rule.

**Chosen miniature timing:** 75 flashes/minute, 0.8-second period, nominal 50% on interval, and 35 ms softened edges. Every lamp on one side of a vehicle shares its phase, while stable ID-derived offsets prevent the entire fleet blinking in unison. The offsets use the simulation clock, never wall-clock intervals.

Reduced motion holds the requested amber side steady rather than flashing. Pause, hidden-page suspension and renderer recovery preserve the retained time and intent. No autonomous light timers are created.

## 9. Bicycles and traffic signals

New York DMV distinguishes nighttime bicycle lamps from reflectors and describes forward/rear visibility [S14]. The twelve bicycles now have small white front and red rear lamps with much smaller forward footprints. Wheel/reflector paint is not turned into a permanently luminous object.

The MUTCD discusses signal aiming, visors, dark backplates, separated indications and nighttime glare [S15]. The existing city already has hoods, dark inactive lenses and vertically separated signal faces. Those remain driven by the same intersection controller as traffic. The lighting pass does not independently crossfade red and green or change reservations.

**Retained simplification:** current junctions use green, all-red clearance and pedestrian phases. The unused amber traffic-signal batch is not evidence of a working yellow approach phase. Adding a safe yellow phase would require a separate stopping/reservation behavior change; it is not disguised as a cosmetic bulb update here.

## 10. Rendering cost and ownership

Forward-rendered real lights add material-shader work, and shadow maps add scene passes [S5]. A shadowed point light can require six directional renders. Hundreds of independent real lights and hundreds of shadow maps are inappropriate for this scene.

The implementation instead has:

| Layer | Fixed scope | Role |
| --- | --- | --- |
| Vehicle lenses | 420 instances in one batch | All 36 motor vehicles and twelve bicycles |
| Source halos | Capacity 507 in one batch | Public fixtures and visible vehicle lamps |
| Ground illumination | Capacity 183 in one batch | 87 static footprints plus paired footprints for 48 moving rigs |
| Actual local lights | Six public spots and two vehicle spots | Material response in focused views |
| Height/retention texture | 680 x 680 RG float | 3,699,200 data bytes; fixed allocation |

The three added batches use shared geometry/materials; counts change without spawning meshes. Eight spotlight objects are allocated once. They have inverse-square decay, finite ranges of at most 16 m, soft cones and no additional shadow maps.

The recreation-area follow-up adds six 6.4 m twin-head poles: four outside basketball's runoff and two outside pickleball's. Opaque upper housings and pitched luminous undersides aim inward, with overlapping 10 m basketball and 8 m pickleball footprint radii. Their focused-view intensity scale is 140 versus 65 for street/park fixtures; these are artistic renderer parameters, not measured court illuminance. All six share the existing public slots. The total is now 66 street, fifteen park and six court fixtures, without new material types or static mesh submissions.

Actual local-light intensity fades in between zoom 1.2 and 2.8. Candidates are ranked around the current view target, and the outer candidate has zero contribution at the selection boundary. Reassigning a fixed slot therefore does not abruptly switch a fully lit source. Overview relies on the all-city cues instead of highlighting an arbitrary small subset.

Lightweight preserves lenses, indicators, halos and ground footprints but sets the eight detailed light contributions to zero. It does not create a different traffic simulation. The fixed light count avoids shader recompilation from adding/removing light objects, although zero-intensity slots are not a promise of zero GPU instruction cost.

The adapter owns its three instance buffers, geometries, materials, two textures and eight spotlights. It borrows actor rigs, their retained simulation state and the static weather surface. Disposal is idempotent [S6, S7]. Graphics recovery also rebinds retained suspension poses, so attached lamps do not snap to neutral while paused.

## 11. Verification and remaining limits

Behavior coverage includes daylight/poor-visibility activation, distinct brake/tail states, both turn directions, queues, straight segments, cancellation, independent 75/minute cycles, reduced-motion steady indicators, matrix orientation, fixed allocations, surface/snow sampling, boundary falloff, disposal, hidden time and exact paused graphics reconstruction.

An isolated WebKit renderer compiled the new shaders and produced actual night overview, street and vehicle images. Reviewing the first captures exposed excessive additive headlight overlap; duplicate rig registration was corrected and footprint intensity reduced. These were implementation findings, not merely research proposals.

See [acceptance criteria](ACCEPTANCE_CRITERIA.md#night-lighting-follow-up---2026-09-13) for the final executed checks. Chromium still crashes before page assertions, and served WebKit navigation remains blocked in this environment. In-memory rendering is useful shader/visual evidence, not a successful production-loading, browser-interaction or device-performance test.

Not implemented or claimed: full global illumination, calibrated lux/nits/CCT, physically exact bloom, true area-light shadows, ray-traced reflections, volumetric light transport, regulatory compliance, automatic exposure, a new traffic phase controller, or physical-device FPS certification.

## Source register

Sources were inspected on 2026-09-13; Three.js implementation checks used r186. The linked technical texts are paraphrased, not copied into runtime assets.

| ID | Primary source | Relevant evidence |
| --- | --- | --- |
| S1 | [Three.js color management](https://threejs.org/manual/pages/color-management.html) | Linear-sRGB working space, input/output conversions, texture roles |
| S2 | [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html.md) | Tone mapping, output color, renderer statistics and lifecycle |
| S3 | [Three.js PointLight](https://threejs.org/docs/pages/PointLight.html.md) | Candela, lumens, inverse-square decay and finite range |
| S4 | [Three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html.md) | Emission versus lighting; metallic/roughness material controls |
| S5 | [Three.js shadows](https://threejs.org/manual/pages/shadows.html) | Shadow-map costs and surface-plane approximations |
| S6 | [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html.md) | Shared submissions, instance updates, bounds and disposal |
| S7 | [Three.js cleanup](https://threejs.org/manual/pages/cleanup.html) | Explicit application-owned GPU resource disposal |
| S8 | [Three.js UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html.md) | Bright-pass extraction, strength/radius and mip-chain blur |
| S9 | [PBRT 4: radiometry](https://www.pbr-book.org/4ed/Radiometry,_Spectra,_and_Color/Radiometry) | Photometric units, especially section 4.1.4 and Table 4.2 |
| S10 | [PBRT 4: transmittance](https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance) | Optical thickness and Beer-Lambert attenuation |
| S11 | [PBRT 4: specular reflection and transmission](https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission) | Fresnel behavior and water refractive index |
| S12 | [DarkSky/IES five lighting principles](https://darksky.org/resources/guides-and-how-tos/lighting-principles/) | Useful, targeted, low-level, controlled, warm outdoor lighting |
| S13 | [Official eCFR FMVSS 108, 2026-09-10 XML](https://www.ecfr.gov/api/versioner/v1/full/2026-09-10/title-49.xml?part=571&section=571.108) | Table I-a; S4, S7.3.12, S9.1 and S14.9.3.3-5 |
| S14 | [New York DMV: sharing the road](https://dmv.ny.gov/new-york-state-drivers-manual-and-practice-tests/chapter-11-sharing-the-road) | Bicycle lighting and reflector distinctions |
| S15 | [FHWA MUTCD 11th Edition, Revision 1](https://mutcd.fhwa.dot.gov/pdfs/11th_Editionr1/mutcd11theditionr1hl.pdf) | Sections 4D.06 and 4E.01-05; aiming, contrast and nighttime glare |
| S16 | [PBRT 4: area lights](https://www.pbr-book.org/4ed/Light_Sources/Area_Lights) | Finite emitters, penumbrae and smoother illumination |

**Availability caveats:** older Three.js `/manual/en/` links returned 404; current `/manual/pages/` and official Markdown documents were read instead. eCFR's ordinary HTML and official Figure 2 image were access-restricted. Its official dated XML was available; the numeric figure labels were checked using the identified [Cornell diagram mirror](https://www.law.cornell.edu/images/ecfr/er04de07.018.svg), not a second independent primary standard. The September 11 eCFR snapshot was unavailable; September 10 was used. The MUTCD version was checked against its [official edition-status page](https://mutcd.fhwa.dot.gov/kno_11th_Editionr1.htm). Candidate NYC DOT/NHTSA pages that could not be accessed were not treated as verified sources.
