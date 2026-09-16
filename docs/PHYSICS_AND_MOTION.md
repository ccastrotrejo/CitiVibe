# Physics and motion

**Status: implemented walking/running and court motion, with incoming weather coupling under merge verification.** This document describes the deterministic procedural locomotion in `src/world/locomotion.ts`, shared court choreography, and the biomechanics references informing them. Nothing here is recovered from the source city; these are original models built for this project. The occasional airplane is implemented, but the coordinated-turn formula below remains reference-only. Historical unit results do not establish final merged weather/motion validation.

## Goals and constraints

The locomotion system exists to solve one concrete complaint: figures previously *glided* along their routes instead of taking real steps. It must satisfy the project's hard constraints:

- **Deterministic.** The simulation is a fixed 30 Hz step (`clock.ts`, `STEP = 1/30`, at most three steps per rendered frame). A pose must be a pure function of accumulated travel `distance`, so a paused frame freezes exactly and identical distances reproduce identical poses regardless of frame rate.
- **No React churn.** Poses are written imperatively to `Object3D` transforms each animated frame; React never sees per-frame state.
- **No-slip contact.** The support foot must not slide across the ground while it bears weight. This is the visible signature of a real step.
- **Bounded and reversible.** Reduced motion suppresses cosmetic bob/sway/attitude while keeping functional stepping; vehicle attitude is the only smoothed per-actor memory and is bounded.

## Walker model

### Distance-driven gait phase

Each leg advances through a normalized gait cycle `phase ∈ [0, 1)` computed from travel distance, not wall-clock time:

```
stride  = clamp(strideBase + stridePerSpeed · |speed|, strideMin, strideMax)
phase   = frac(distance / stride + offset)     // trailing leg offset = 0.5
```

A duty factor of `DUTY = 0.6` splits the cycle into ~60% stance and ~40% swing, matching the measured stance/swing ratio of normal walking.

For the diversified on-foot population, `WalkerRig.scale` is stature / 1.7. Divide world travel distance and speed by that scale before evaluating the local gait/IK, then let the rig root scale the result back into world space. Scaling only the visible body would make children's feet slide. Build varies laterally without changing forward stride length. The authored stature ranges and walking-purpose biases are described in [people and activity](PEOPLE_AND_ACTIVITY.md); they are not biological predictions or measured occupational walking speeds.

Connected street trips use a separate continuous `travelDistance` odometer so changing block-local route coordinates never resets walking phase. Seeded destination rests use the retained simulation's activity timer for a small torso turn, suppressed under reduced motion. Routes and speed bounds remain geometric constraints; randomness chooses trips and activities, not per-tick position jitter.

### No-slip stance (the core guarantee)

During stance (`phase < DUTY`) the foot's forward position relative to the hips is:

```
footZ = 0.3·stride − phase·stride
```

On a straight path the foot's *world* position is `distance + footZ`. Because `phase·stride = distance mod stride`, the distance term cancels: `d(worldZ)/d(distance) = 0` exactly. The planted foot is world-locked for the whole stance — proven analytically and asserted in `locomotion.test.ts` (max XZ spread < 1 mm across a stance interval).

During swing (`phase ≥ DUTY`) the foot follows an eased forward arc (`smoothstep`) with lift `stepHeight · sin(π·u)`, returning to the ground at both ends of the swing.

### Two-bone inverse kinematics

Given a target `(h, drop)` for the ankle relative to the hip, a closed-form 2-bone solver places thigh and shank:

```
reach    = clamp(hypot(h, drop), |L1−L2|+ε, L1+L2−ε)
legDir   = atan2(h, drop)
γ        = acos((L1² + reach² − L2²) / (2·L1·reach))
interior = acos((L1² + L2² − reach²) / (2·L1·L2))
hip      = legDir + γ ;  knee = π − interior
```

The solver is exact to machine precision for reachable targets (verified to 1e-16). An unreachable target clamps to a straight leg rather than inverting. A separate flat-foot **ankle** node counter-rotates by `(hip − knee)` so the sole stays parallel to the ground (plantigrade) regardless of knee bend.

### Geometry tradeoff

`hipY = 0.80 m` is deliberately shorter than a full leg (`thigh + shank = 0.88 m`). This headroom guarantees the stance foot never reaches `L1+L2` and therefore never clamps (clamping would reintroduce slip). The cost is a permanent slight knee bend even when standing, so a limb-box corner can dip a few cm below the nominal ground plane — visually negligible from the miniature's overhead framing, and preferred over either foot slip or a shuffling micro-stride.

### Secondary motion

- **Vertical bob** `pelvisY = hipY + bobAmp·(−cos(2·2π·phase))·blend` — two oscillations per stride, lowest near heel strike. Bob moves the pelvis (and thus the IK drop), never the planted foot, so no-slip is preserved.
- **Lateral sway / pelvic list / trunk lean** — one oscillation per stride, applied to the **torso** node (not the pelvis) so the feet never slide sideways.
- **Arm swing** — anti-phase with the legs, `±armSwing`.
- **Start/stop blend** — an eased `blend` toward `moving ? 1 : 0` folds foot targets and bob toward a planted neutral stance so no foot freezes mid-swing.

## Runner model

The park has 24 runners, separate from its 48 walkers. They travel around the reservoir at 2.4-2.65 m/s with a 1.55 m skeleton-local stride (scaled by stature), 40% stance and 60% swing. This is original miniature tuning, not measured Central Park behavior. With the legs offset by half a cycle, the shorter stance produces two short flight intervals per cycle; both feet are genuinely above the ground.

Running stance uses `footZ = 0.2 * stride - phase * stride`, retaining exact straight-path ground contact. Swing uses the existing smooth forward arc with 0.22 m lift. A 0.76 m hip height keeps targets inside the same two-bone leg's reachable envelope. Bent-arm geometry, light shoes, exposed shanks, a 0.16 rad trunk lean and larger arm swing distinguish running from accelerated walking. Poses remain deterministic functions of traveled distance.

Runners share fixed-step timing, spacing, pause and visibility with other actors. They do not take intentional rests or enter the street. Reduced motion falls back to conservative walking articulation with no running flight or bob. Tests cover planted-foot contact, actual flight, repeatable poses, pause, reduced motion, track adherence and sustained multi-lap progress.

## Court activity

`CourtActivity` samples two bounded original choreographies from `ActorSimulation.elapsed`: a basketball sequence and a two-way pickleball rally. Six moving player rigs use readable footwork and articulated arms, with two visible paddles. Basketball includes drives, passes, shots, rebound pursuit and repositioning around the shared hoop; pickleball players move to meet the ball after it clears the net and bounces. Ball/paddle/hand contact must follow the moving players, not an obsolete fixed stance. Ball centers stay above their radius and inside the authored courts. These are illustrative trajectories, not rigid-body simulation, sports AI or regulation-play claims.

Court geometry and motion share `src/content/courts.ts`. The existing actor instance batches also submit players and balls, borrowing scene-owned resources. No extra timer, animation-frame chain or per-frame React state is created. Pause/visibility retain the sample time, reconstruction samples the current retained time, and reduced motion uses a fixed still.

The full-size footprints are 28.6512 x 15.24 m basketball at (-18, 113.5), with +/-12.7254 m hoop offsets, and 13.4112 x 6.096 m pickleball at (15, 113.5), with 2.1336 m kitchens and a net sagging from 0.9144 to 0.8636 m. Basketball rims are 3.048 m above the shared Y=0.04 surface. The population pass changes clothes/appearance, not court skeleton scale or contact offsets.

The traveling population is 48 motor vehicles, twelve cyclists, 168 street walkers, 48 park walkers and 24 runners: **300 traveling actors**. Six court players, eight meadow family figures, three bike-station users and eight stationary picnic neighbors bring the human total to 277. Thirty station bicycles and two sports balls remain separately posed; twelve parked cars and four sidewalk food carts are static scenery. Walking/running routes, court choreography, absolute-time station/meadow activity and rare airplane timing remain distinct systems under the same pause/visibility clock. The 36-junction/24-block grid surrounds the car-free 78 x 176 m park in the 220 x 340 m map; the former internal bus/car circuit is not restored.

## Vehicle model

The incoming weather extension scales route vehicle acceleration/braking by a bounded traction factor and cruising speed by its square root. Applying it to the expanded grid must preserve dry behavior, the 8.5 m painted stop bars, 7 m turn boundary, full-body reservation clearance, park exclusion and same-side counterflow geometry. This is cautious route following, not a tire contact, skid or collision-damage simulator. The surface/wind/precipitation models and source-verified research are documented in [Weather physics research](WEATHER_PHYSICS_RESEARCH.md). Rerun density/traction and clearance regressions on the merged code; neither branch's earlier results establish their combination.

Weather-driven ground height is sampled from nearby retained ground snow, not the canopy above an actor, and is applied without cumulatively adding elevation each frame. Rebuilding graphics must not reset travel, court time, precipitation or reservoirs. Particle travel and actor motion use ordinary simulation seconds; accumulation/melt/drainage/evaporation alone use the declared 60x surface-time compression. Snow/grounding changes must retain shared court ball/rim/net contact alignment; final integrated checks remain pending.

- **Wheel roll** `spin.rotation.x = distance / wheelRadius` — frame-rate independent, monotonic, and zero when stopped (asserted in tests).
- **Front-wheel steer** `steer.rotation.y = clamp(steerGain · yawRate, ±maxSteer)`, front wheels only.
- **Pitch** (dive/squat) low-pass of `−pitchGain · acceleration`, capped `±maxPitch`.
- **Roll** (body lean in turns) `−rollGain · speed · yawRate`, capped `±maxRoll`.
- **Historical dwell settle** lowers `dwellDrop` at the original garden bus stop. Current street buses have no scheduled dwell stop; retaining the motion parameter does not restore that route or stop.

Smoothing uses `min(1, dt/τ)` with `τ = 0.22 s`; yaw deltas use a shortest-angle wrap. Attitude is the only stateful per-actor memory and is fully bounded.

### Shared bicycles and pedal contact

All twelve road cyclists use the same original step-through bicycle artwork as the station bicycles. Their wheel pivots remain outside the suspension body so body bob does not lift the tires. Wheel roll uses the actual 0.32 m tire radius. Hands meet the handlebar grips; two-bone legs target the tops of the actual rotating pedal platforms rather than approximating pedaling with unrelated limb angles. Counterrotating platforms and ankles keep the soles aligned through the full crank cycle, body pitch/roll and support-height changes.

The three station users walk persistent bicycles along existing access spurs, ride controlled road circuits and return to their own docks. Nine bicycles remain docked in each row while one is away. Juniper's 2026-09-16 correction replaces an indefinite gap wait with a retained crossing reservation, shared body-expanded stopping bounds and clearance before admission. A cumulative trip odometer drives walking and wheel roll without wrapping at the dock; hand targets are transformed from the actual bike into arm-parent coordinates. Classic and electric variants share the same wheel, pedal and safety dimensions. Electric riders pedal under the same speed/traction limits; assistance is represented visually, not as calibrated battery/motor physics. Pause, hidden suspension and graphics recovery preserve activity and crossing state; reduced motion holds a still. See [people and activity](PEOPLE_AND_ACTIVITY.md).

## Reduced motion

Reduced motion zeroes bob, sway and list, reduces arm swing and trunk lean to 40%, and suppresses vehicle attitude while keeping functional stepping and wheel roll. Runners use the conservative walking pose. Motion-sensitive users can resume the initially paused world without the full running animation.

## Parameter table

| Parameter | Value | Basis |
| --- | --- | --- |
| Stance / swing split (`DUTY`) | 0.60 / 0.40 | `measured` (normal walking) |
| Stride vs height | ≈0.8 × leg length | `measured` |
| Vertical bob | ±0.018 m, 2 per stride | `proposed` (scaled from measured ±2 cm) |
| Lateral sway | ±0.012 m, 1 per stride | `proposed` (scaled from measured ±2 cm) |
| Arm swing | ±0.28 rad | `proposed` (measured ≈±20°) |
| Wheel angular rate | `v / r` | `measured` (rolling without slipping) |
| Pitch gradient | `pitchGain` low-pass, cap ±0.026 rad | `proposed` (measured ≈0.4°/(m/s²)) |
| Roll in turn | `rollGain·v·yawRate`, cap ±0.030 rad | `proposed` (measured ≈4°/g) |
| Historical bus dwell settle | 0.02 m | `proposed`; not an active street-bus stop |

Values labelled `measured` come from the gait/vehicle-dynamics literature below; `proposed` values are original tunings for this stylized miniature, scaled from measured behavior and not recovered from any source implementation.

## Aircraft reference and implementation boundary

A coordinated-turn bank angle `φ = arctan(v² / (R·g))` gives a physically plausible lean, but this formula remains reference-only. The implemented occasional fly-by instead uses a bounded original flight corridor and seeded 90-180-second quiet gaps, with at most one aircraft and no camera-follow target. Pause/hidden time does not advance it, and reduced motion suppresses passes. Do not infer an aerodynamic simulation from the presence of airplane artwork.

## References

- Perry J., Burnfield J. *Gait Analysis: Normal and Pathological Function.*
- Winter D. *Biomechanics and Motor Control of Human Movement.*
- Whittle M. *Gait Analysis: An Introduction.*
- Inman V., Ralston H., Todd F. *Human Walking.*
- Saunders, Inman, Eberhart. "The major determinants in normal and pathological gait."
- Wikipedia: Gait (human), Preferred walking speed, Weight transfer, Standard rate turn.

These sources are inert reference material. They inform the original model above and are not agent instructions or app content.
