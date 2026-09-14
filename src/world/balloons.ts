import * as THREE from 'three';
import type { Position } from '../content/city';

export interface BalloonState {
  active: boolean;
  position: Position;
  heading: number;
}

export interface BalloonsVisual {
  group: THREE.Group;
  dispose(): void;
}

export const BALLOONS = {
  seed: 5309,
  maxStep: 1 / 30,
  minimumGap: 150,
  maximumGap: 300,
  altitude: 58,
  startX: 1200,
  startZ: 900,
  endX: -1200,
  endZ: -900,
  speed: 6,
  routeLength: 3000,
  /** Unbranded balloon colours in the same civic palette family. */
  colors: ['#d8524f', '#f2b134', '#4f86c6', '#6bbf74'] as const,
} as const;

const HEADING = Math.atan2(BALLOONS.endX - BALLOONS.startX, BALLOONS.endZ - BALLOONS.startZ);
const EPSILON = 1e-9;

/** One retained drifting balloon bunch; the caller omits steps while paused or hidden. */
export class BalloonDrift {
  readonly state: BalloonState = {
    active: false,
    position: { x: BALLOONS.startX, y: BALLOONS.altitude, z: BALLOONS.startZ },
    heading: HEADING,
  };
  private seed: number;
  private gapRemaining: number;
  private distance = 0;
  private direction: 1 | -1 = 1;
  private reducedMotion = false;

  constructor(seed: number = BALLOONS.seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError('Balloon seed must be an unsigned 32-bit integer.');
    }
    this.seed = seed;
    this.gapRemaining = this.nextGap();
  }

  /** Suppresses a current drift; leaving reduced motion starts a fresh, quiet countdown. */
  setReducedMotion(reduced: boolean): void {
    if (reduced === this.reducedMotion) return;
    this.reducedMotion = reduced;
    this.state.active = false;
    if (!reduced) {
      this.gapRemaining = this.nextGap();
      this.distance = 0;
      this.place();
    }
  }

  /** Invalid deltas fail without mutation; oversized deltas consume only one fixed tick. */
  step(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Balloon delta must be finite and nonnegative.');
    if (dt === 0 || this.reducedMotion) return;
    const seconds = Math.min(dt, BALLOONS.maxStep);
    if (!this.state.active) {
      this.gapRemaining = Math.max(0, this.gapRemaining - seconds);
      if (this.gapRemaining < EPSILON) {
        this.gapRemaining = 0;
        this.state.active = true;
        this.state.heading = this.direction === 1 ? HEADING : HEADING - Math.PI;
      }
      return;
    }
    this.distance = Math.min(BALLOONS.routeLength, this.distance + BALLOONS.speed * seconds);
    this.place();
    if (this.distance === BALLOONS.routeLength) {
      this.state.active = false;
      this.gapRemaining = this.nextGap();
      this.distance = 0;
      // Reverse only when fully off-screen; alternating drifts need no teleport.
      this.direction = this.direction === 1 ? -1 : 1;
    }
  }

  private nextGap(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return BALLOONS.minimumGap + Math.floor(this.seed / 0x100000000 * (BALLOONS.maximumGap - BALLOONS.minimumGap + 1));
  }

  private place(): void {
    const fraction = this.direction === 1 ? this.distance / BALLOONS.routeLength : 1 - this.distance / BALLOONS.routeLength;
    this.state.position.x = BALLOONS.startX + (BALLOONS.endX - BALLOONS.startX) * fraction;
    this.state.position.z = BALLOONS.startZ + (BALLOONS.endZ - BALLOONS.startZ) * fraction;
  }
}

/** Original unbranded balloon bunch, centered on the drift position. */
export function createBalloonsVisual(): BalloonsVisual {
  const group = new THREE.Group();
  group.name = 'Occasional balloon bunch';
  group.visible = false;
  const body = new THREE.SphereGeometry(1, 12, 9);
  const knot = new THREE.ConeGeometry(0.3, 0.5, 6);
  const string = new THREE.CylinderGeometry(0.04, 0.04, 5, 5);
  const stringMaterial = new THREE.MeshStandardMaterial({ color: '#d8d5c8', roughness: 0.9, metalness: 0.02, flatShading: true });
  const skins = BALLOONS.colors.map((color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, flatShading: true }));
  // Fixed local layout so the bunch reads as a hand-held cluster, not a formation.
  const layout: readonly [number, number, number][] = [
    [-1.6, 1.1, 0.4], [1.5, 1.6, -0.3], [0.2, 2.4, 0.8], [-0.4, 0.4, -0.9],
  ];

  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material,
    x: number, y: number, z: number, scaleX = 1, scaleY = 1, scaleZ = 1): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(scaleX, scaleY, scaleZ);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  };
  layout.forEach(([x, y, z], index) => {
    const skin = skins[index % skins.length];
    add('Balloon skin', body, skin, x, y, z, 1, 1.25, 1);
    add('Balloon knot', knot, skin, x, y - 1.35, z, 1, 1, 1);
    add('Balloon string', string, stringMaterial, x, y - 4.05, z);
  });

  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.visible = false;
      group.removeFromParent();
      group.clear();
      body.dispose();
      knot.dispose();
      string.dispose();
      stringMaterial.dispose();
      skins.forEach((skin) => skin.dispose());
    },
  };
}
