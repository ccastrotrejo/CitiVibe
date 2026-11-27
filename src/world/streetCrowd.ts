import * as THREE from 'three';
import { createPersonProfile, createWeatherTraits } from '../content/people';
import { STREET_BLOCKS } from '../content/streets';
import { FOOD_CARTS } from '../content/streetFurniture';
import type { ActorState } from './actors';
import { createGaitTraits, poseWalkerRig, type GaitTraits, type WalkerRig } from './locomotion';
import type { PersonWeatherState } from './peopleWeather';
import { buildPersonRig, type PersonArt } from './person';

const TURN_RADIUS = 0.24;

interface StrollerTrack {
  readonly id: string;
  readonly group: THREE.Group;
  readonly rig: WalkerRig;
  readonly traits: GaitTraits;
  readonly prefersUmbrella: boolean;
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly dirX: number;
  readonly dirZ: number;
  readonly perpX: number;
  readonly perpZ: number;
  readonly surfaceY: number;
  readonly straightLen: number;
  readonly arcLen: number;
  readonly loopLen: number;
  readonly speed: number;
  readonly phase: number;
  readonly weather: PersonWeatherState;
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function nearReservedCorner(x: number, z: number): boolean {
  // Keep clear of Juniper Court west counterflow strip and all four food-cart corner pockets.
  if (x > -40.2 && x < -37.6 && z > 101 && z < 126) return true;
  for (const cart of FOOD_CARTS) {
    if (Math.abs(x - cart.x) < 4.5 && Math.abs(z - cart.z) < 5.5) return true;
  }
  return false;
}

/**
 * Lightweight retained-time NYC sidewalk & promenade crowd (96 articulated strollers).
 * Uses keep-right oval loops with smooth semicircular turnarounds, synchronizes weather gear,
 * shares `personArt` and `ActorInstances` (0 extra draw calls/materials), and runs in O(N) time.
 */
export class StreetCrowdActivity {
  readonly groups: readonly THREE.Group[];
  private readonly tracks: readonly StrollerTrack[];
  private disposed = false;

  constructor(parent: THREE.Scene, art: PersonArt) {
    const rand = seeded(0x6e796342);
    const tracks: StrollerTrack[] = [];
    const candidates: { ax: number; az: number; bx: number; bz: number; surfaceY: number }[] = [];

    for (const block of STREET_BLOCKS) {
      // Skip the south recreation court parcel (block-2-3 / block-1-3 area near z=113.5).
      if (block.minZ === 95 && block.maxZ === 132 && block.minX >= -46 && block.maxX <= 46) continue;
      const zSpan = block.maxZ - block.minZ;
      const xSpan = block.maxX - block.minX;
      if (zSpan >= 28) {
        for (const x of [block.minX + 6.55, block.maxX - 6.55]) {
          const az = block.minZ + 12;
          const bz = block.maxZ - 12;
          if (!nearReservedCorner(x, az) && !nearReservedCorner(x, bz) && !nearReservedCorner(x, (az + bz) / 2)) {
            candidates.push({ ax: x, az, bx: x, bz, surfaceY: -0.08 });
          }
        }
      }
      if (xSpan >= 25) {
        for (const z of [block.minZ + 6.55, block.maxZ - 6.55]) {
          const ax = block.minX + 11;
          const bx = block.maxX - 11;
          if (bx - ax >= 5 && !nearReservedCorner(ax, z) && !nearReservedCorner(bx, z)) {
            candidates.push({ ax, az: z, bx, bz: z, surfaceY: -0.08 });
          }
        }
      }
    }

    // Add wide Central Park Mall & Great Lawn promenade stroll segments.
    const parkPromenades = [
      { ax: -1.3, az: 44, bx: -1.3, bz: 77, surfaceY: 0.02 },
      { ax: 1.3, az: 45, bx: 1.3, bz: 78, surfaceY: 0.02 },
      { ax: -1.8, az: 48, bx: -1.8, bz: 74, surfaceY: 0.02 },
      { ax: 1.8, az: 47, bx: 1.8, bz: 73, surfaceY: 0.02 },
      { ax: -31.8, az: -42, bx: -31.8, bz: -16, surfaceY: 0.02 },
      { ax: 24.5, az: -16, bx: 6.5, bz: -18.5, surfaceY: 0.02 },
    ];

    const slotCounts = new Map<number, number>();
    const targetCount = 96;
    for (let i = 0; i < targetCount; i++) {
      const inPark = i >= 80;
      const slotKey = inPark ? 1000 + ((i - 80) % parkPromenades.length) : i % candidates.length;
      const ordinalOnSlot = slotCounts.get(slotKey) ?? 0;
      slotCounts.set(slotKey, ordinalOnSlot + 1);
      const seg = inPark
        ? parkPromenades[(i - 80) % parkPromenades.length]
        : candidates[i % candidates.length];
      const id = `nyc-stroller-${i + 1}`;
      const profile = createPersonProfile(id, inPark ? 'park' : 'street');
      const weatherTraits = createWeatherTraits(id);
      const group = new THREE.Group();
      group.name = id;
      const rig = buildPersonRig(group, profile, art);
      parent.add(group);
      const straightLen = Math.max(2, Math.hypot(seg.bx - seg.ax, seg.bz - seg.az));
      const dirX = (seg.bx - seg.ax) / straightLen;
      const dirZ = (seg.bz - seg.az) / straightLen;
      // Right-hand lateral offset so outbound and inbound legs separate onto distinct keep-right lanes.
      const perpX = -dirZ;
      const perpZ = dirX;
      const arcLen = Math.PI * TURN_RADIUS;
      const loopLen = 2 * straightLen + 2 * arcLen;
      tracks.push({
        id,
        group,
        rig,
        traits: createGaitTraits(id),
        prefersUmbrella: weatherTraits.rainProtection === 'umbrella',
        ax: seg.ax,
        az: seg.az,
        bx: seg.bx,
        bz: seg.bz,
        dirX,
        dirZ,
        perpX,
        perpZ,
        surfaceY: seg.surfaceY,
        straightLen,
        arcLen,
        loopLen,
        // Co-segment strollers share a base pace and evenly spaced loop phases so they never overtake/collide.
        speed: 1.08 + (slotKey % 5) * 0.04,
        phase: ((ordinalOnSlot * 0.47 + rand() * 0.14) % 1) * loopLen,
        weather: { equipment: 'dry', umbrellaOpen: 0, pace: 1, cautious: false },
      });
    }

    this.tracks = tracks;
    this.groups = tracks.map(({ group }) => group);
    this.update(0, false, 0);
  }

  update(
    elapsedSeconds: number,
    reducedMotion: boolean,
    groundLift = 0,
    actors: readonly ActorState[] = [],
  ): void {
    if (this.disposed) return;
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new RangeError('Street crowd elapsed time must be finite and nonnegative.');
    }
    if (!Number.isFinite(groundLift) || groundLift < 0 || groundLift > 0.45) {
      throw new RangeError('Street crowd ground lift must be between 0 and 0.45 metres.');
    }

    // Mirror active neighborhood weather policy from simulated street pedestrians.
    let wetSample: PersonWeatherState | undefined;
    for (let i = 0; i < actors.length; i++) {
      const candidate = actors[i].weather;
      if (candidate && candidate.equipment !== 'dry') {
        wetSample = candidate;
        break;
      }
    }

    const time = reducedMotion ? 0 : elapsedSeconds;
    for (let i = 0; i < this.tracks.length; i++) {
      const t = this.tracks[i];
      if (wetSample) {
        if (wetSample.equipment === 'winter') {
          t.weather.equipment = 'winter';
          t.weather.umbrellaOpen = 0;
        } else {
          t.weather.equipment = t.prefersUmbrella ? 'umbrella' : 'raincoat';
          t.weather.umbrellaOpen = t.prefersUmbrella ? Math.max(0.85, wetSample.umbrellaOpen) : 0;
        }
        t.weather.cautious = wetSample.cautious;
        t.weather.pace = wetSample.pace;
      } else {
        t.weather.equipment = 'dry';
        t.weather.umbrellaOpen = 0;
        t.weather.cautious = false;
        t.weather.pace = 1;
      }

      const effectiveSpeed = t.speed * t.weather.pace;
      const traveled = t.phase + time * effectiveSpeed;
      const s = ((traveled % t.loopLen) + t.loopLen) % t.loopLen;

      let x: number;
      let z: number;
      let headingX: number;
      let headingZ: number;
      if (s < t.straightLen) {
        // Outbound straight (+perpX, +perpZ keep-right offset)
        x = t.ax + t.dirX * s + t.perpX * TURN_RADIUS;
        z = t.az + t.dirZ * s + t.perpZ * TURN_RADIUS;
        headingX = t.dirX;
        headingZ = t.dirZ;
      } else if (s < t.straightLen + t.arcLen) {
        // Smooth semicircular turnaround at B
        const theta = ((s - t.straightLen) / t.arcLen) * Math.PI;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        x = t.bx + (t.perpX * cosT + t.dirX * sinT) * TURN_RADIUS;
        z = t.bz + (t.perpZ * cosT + t.dirZ * sinT) * TURN_RADIUS;
        headingX = -t.perpX * sinT + t.dirX * cosT;
        headingZ = -t.perpZ * sinT + t.dirZ * cosT;
      } else if (s < 2 * t.straightLen + t.arcLen) {
        // Inbound straight (-perpX, -perpZ keep-right offset)
        const back = s - (t.straightLen + t.arcLen);
        x = t.bx - t.dirX * back - t.perpX * TURN_RADIUS;
        z = t.bz - t.dirZ * back - t.perpZ * TURN_RADIUS;
        headingX = -t.dirX;
        headingZ = -t.dirZ;
      } else {
        // Smooth semicircular turnaround at A
        const theta = ((s - (2 * t.straightLen + t.arcLen)) / t.arcLen) * Math.PI;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        x = t.ax + (-t.perpX * cosT - t.dirX * sinT) * TURN_RADIUS;
        z = t.az + (-t.perpZ * cosT - t.dirZ * sinT) * TURN_RADIUS;
        headingX = t.perpX * sinT - t.dirX * cosT;
        headingZ = t.perpZ * sinT - t.dirZ * cosT;
      }

      t.group.position.set(x, t.surfaceY + groundLift, z);
      t.group.rotation.set(0, Math.atan2(headingX, headingZ), 0);
      poseWalkerRig(t.rig, {
        distance: traveled,
        speed: reducedMotion ? 0 : effectiveSpeed,
        blend: reducedMotion ? 0 : 1,
        reducedMotion,
        weather: t.weather,
        traits: t.traits,
      });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (let i = 0; i < this.groups.length; i++) {
      this.groups[i].removeFromParent();
      this.groups[i].clear();
    }
  }
}
