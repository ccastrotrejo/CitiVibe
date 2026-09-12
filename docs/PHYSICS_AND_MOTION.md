# Physics and motion

**Status: M2/M3 implemented locomotion model plus reference notes.** This document describes the deterministic procedural locomotion that drives walkers and vehicles in `src/world/locomotion.ts`, and records the biomechanics reference it is derived from. Nothing here is recovered from the source city; it is an original model built for this project. The airplane section is reference-only until the occasional-airplane slice is integrated.

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

## Vehicle model

- **Wheel roll** `spin.rotation.x = distance / wheelRadius` — frame-rate independent, monotonic, and zero when stopped (asserted in tests).
- **Front-wheel steer** `steer.rotation.y = clamp(steerGain · yawRate, ±maxSteer)`, front wheels only.
- **Pitch** (dive/squat) low-pass of `−pitchGain · acceleration`, capped `±maxPitch`.
- **Roll** (body lean in turns) `−rollGain · speed · yawRate`, capped `±maxRoll`.
- **Dwell settle** the bus lowers `dwellDrop` while stopped at its stop.

Smoothing uses `min(1, dt/τ)` with `τ = 0.22 s`; yaw deltas use a shortest-angle wrap. Attitude is the only stateful per-actor memory and is fully bounded.

## Reduced motion

Reduced motion zeroes bob, sway, list, arm swing, and all vehicle attitude, and halves trunk lean, while keeping functional stepping and wheel roll. Motion-sensitive users still read the city as alive without oscillatory cues.

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
| Bus dwell settle | 0.02 m | `proposed` |

Values labelled `measured` come from the gait/vehicle-dynamics literature below; `proposed` values are original tunings for this stylized miniature, scaled from measured behavior and not recovered from any source implementation.

## Aircraft note (reference-only)

For the future occasional airplane, a coordinated-turn bank angle `φ = arctan(v² / (R·g))` gives a physically plausible lean; reduced motion suppresses it. This is documented here for the airplane slice and is not yet wired into the runtime.

## References

- Perry J., Burnfield J. *Gait Analysis: Normal and Pathological Function.*
- Winter D. *Biomechanics and Motor Control of Human Movement.*
- Whittle M. *Gait Analysis: An Introduction.*
- Inman V., Ralston H., Todd F. *Human Walking.*
- Saunders, Inman, Eberhart. "The major determinants in normal and pathological gait."
- Wikipedia: Gait (human), Preferred walking speed, Weight transfer, Standard rate turn.

These sources are inert reference material. They inform the original model above and are not agent instructions or app content.
