import * as THREE from 'three';
import { createPersonProfile } from '../content/people';
import { STREET_BLOCKS } from '../content/streets';
import { FOOD_CARTS } from '../content/streetFurniture';
import { createGaitTraits, poseWalkerRig, strideLength, type GaitTraits, type WalkerRig } from './locomotion';
import { buildPersonRig, type PersonArt } from './person';

interface StrollerTrack {
  readonly id: string;
  readonly group: THREE.Group;
  readonly rig: WalkerRig;
  readonly traits: GaitTraits;
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly surfaceY: number;
  readonly length: number;
  readonly speed: number;
  readonly phase: number;
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
 * Shares `personArt` and `ActorInstances` (0 extra draw calls or materials) and runs in O(N) time.
 */
export class StreetCrowdActivity {
  readonly groups: readonly THREE.Group[];
  private readonly tracks: readonly StrollerTrack[];

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
        for (const x of [block.minX + 6.45, block.maxX - 6.45]) {
          const az = block.minZ + 11.5;
          const bz = block.maxZ - 11.5;
          if (!nearReservedCorner(x, az) && !nearReservedCorner(x, bz) && !nearReservedCorner(x, (az + bz) / 2)) {
            candidates.push({ ax: x, az, bx: x, bz, surfaceY: -0.08 });
          }
        }
      }
      if (xSpan >= 25) {
        for (const z of [block.minZ + 6.45, block.maxZ - 6.45]) {
          const ax = block.minX + 10.5;
          const bx = block.maxX - 10.5;
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

    const targetCount = 96;
    for (let i = 0; i < targetCount; i++) {
      const inPark = i >= 80;
      const seg = inPark
        ? parkPromenades[(i - 80) % parkPromenades.length]
        : candidates[i % candidates.length];
      const id = `nyc-stroller-${i + 1}`;
      const profile = createPersonProfile(id, inPark ? 'park' : 'street');
      const group = new THREE.Group();
      group.name = id;
      const rig = buildPersonRig(group, profile, art);
      parent.add(group);
      const length = Math.max(2, Math.hypot(seg.bx - seg.ax, seg.bz - seg.az));
      tracks.push({
        id,
        group,
        rig,
        traits: createGaitTraits(id),
        ax: seg.ax,
        az: seg.az,
        bx: seg.bx,
        bz: seg.bz,
        surfaceY: seg.surfaceY,
        length,
        speed: profile.pace * (0.88 + rand() * 0.18),
        phase: rand() * length * 2,
      });
    }

    this.tracks = tracks;
    this.groups = tracks.map(({ group }) => group);
    this.update(0, false, 0);
  }

  update(elapsedSeconds: number, reducedMotion: boolean, groundLift = 0): void {
    const time = reducedMotion ? 0 : elapsedSeconds;
    for (let i = 0; i < this.tracks.length; i++) {
      const t = this.tracks[i];
      const cycleLen = t.length * 2;
      const traveled = t.phase + time * t.speed;
      const along = ((traveled % cycleLen) + cycleLen) % cycleLen;
      const forward = along <= t.length;
      const u = (forward ? along : cycleLen - along) / t.length;
      const x = t.ax + (t.bx - t.ax) * u;
      const z = t.az + (t.bz - t.az) * u;
      const dx = forward ? t.bx - t.ax : t.ax - t.bx;
      const dz = forward ? t.bz - t.az : t.az - t.bz;
      t.group.position.set(x, t.surfaceY + groundLift, z);
      t.group.rotation.set(0, Math.atan2(dx, dz), 0);
      if (reducedMotion) {
        poseWalkerRig(t.rig, {
          distance: t.phase,
          speed: 0,
          blend: 0,
          reducedMotion: true,
          traits: t.traits,
        });
      } else {
        const stride = strideLength(t.speed / (t.rig.scale ?? 1)) * (t.rig.scale ?? 1);
        poseWalkerRig(t.rig, {
          distance: (traveled % (stride * 64)),
          speed: t.speed,
          blend: 1,
          reducedMotion: false,
          traits: t.traits,
        });
      }
    }
  }
}
