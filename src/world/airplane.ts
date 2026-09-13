import * as THREE from 'three';
import type { Position } from '../content/city';

export interface AirplaneState {
  active: boolean;
  position: Position;
  heading: number;
}

export interface AirplaneVisual {
  group: THREE.Group;
  dispose(): void;
}

export const AIRPLANE = {
  seed: 2401,
  maxStep: 1 / 30,
  minimumGap: 90,
  maximumGap: 180,
  altitude: 46,
  startX: -1200,
  startZ: -900,
  endX: 1200,
  endZ: 900,
  speed: 15,
  routeLength: 3000,
} as const;

const HEADING = Math.atan2(AIRPLANE.endX - AIRPLANE.startX, AIRPLANE.endZ - AIRPLANE.startZ);
const EPSILON = 1e-9;

/** One retained airplane; the caller omits steps while the city is paused or hidden. */
export class AirplaneSimulation {
  readonly state: AirplaneState = {
    active: false,
    position: { x: AIRPLANE.startX, y: AIRPLANE.altitude, z: AIRPLANE.startZ },
    heading: HEADING,
  };
  private seed: number;
  private gapRemaining: number;
  private distance = 0;
  private direction: 1 | -1 = 1;
  private reducedMotion = false;

  constructor(seed: number = AIRPLANE.seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError('Airplane seed must be an unsigned 32-bit integer.');
    }
    this.seed = seed;
    this.gapRemaining = this.nextGap();
  }

  /** Suppresses a current pass; leaving reduced motion starts a fresh, quiet countdown. */
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
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Airplane delta must be finite and nonnegative.');
    if (dt === 0 || this.reducedMotion) return;
    const seconds = Math.min(dt, AIRPLANE.maxStep);
    if (!this.state.active) {
      this.gapRemaining = Math.max(0, this.gapRemaining - seconds);
      if (this.gapRemaining < EPSILON) {
        this.gapRemaining = 0;
        this.state.active = true;
        this.state.heading = this.direction === 1 ? HEADING : HEADING - Math.PI;
      }
      return;
    }
    this.distance = Math.min(AIRPLANE.routeLength, this.distance + AIRPLANE.speed * seconds);
    this.place();
    if (this.distance === AIRPLANE.routeLength) {
      this.state.active = false;
      this.gapRemaining = this.nextGap();
      this.distance = 0;
      // Turn only while completely off-screen; alternating passes need no position teleport.
      this.direction = this.direction === 1 ? -1 : 1;
    }
  }

  private nextGap(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return AIRPLANE.minimumGap + Math.floor(this.seed / 0x100000000 * (AIRPLANE.maximumGap - AIRPLANE.minimumGap + 1));
  }

  private place(): void {
    const fraction = this.direction === 1 ? this.distance / AIRPLANE.routeLength : 1 - this.distance / AIRPLANE.routeLength;
    this.state.position.x = AIRPLANE.startX + (AIRPLANE.endX - AIRPLANE.startX) * fraction;
    this.state.position.z = AIRPLANE.startZ + (AIRPLANE.endZ - AIRPLANE.startZ) * fraction;
  }
}

/** Original unbranded jet, centered on the flight position and pointing along local +Z. */
export function createAirplaneVisual(): AirplaneVisual {
  const group = new THREE.Group();
  group.name = 'Occasional airplane';
  group.visible = false;
  const pale = new THREE.MeshStandardMaterial({ color: '#e9e8df', roughness: 0.8, metalness: 0.05, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#34454b', roughness: 0.7, metalness: 0.05, flatShading: true });
  const rounded = new THREE.SphereGeometry(1, 12, 6);
  const wing = new THREE.ExtrudeGeometry(new THREE.Shape([
    new THREE.Vector2(0, 1.2), new THREE.Vector2(3.8, -1.25), new THREE.Vector2(3.6, -1.7),
    new THREE.Vector2(0, -0.6), new THREE.Vector2(-3.6, -1.7), new THREE.Vector2(-3.8, -1.25),
  ]), { depth: 0.12, bevelEnabled: false, steps: 1, curveSegments: 1 });
  wing.rotateX(Math.PI / 2);
  wing.translate(0, 0.06, 0);
  const fin = new THREE.ExtrudeGeometry(new THREE.Shape([
    new THREE.Vector2(-3.55, 0), new THREE.Vector2(-3.35, 1.35), new THREE.Vector2(-1.9, 0),
  ]), { depth: 0.12, bevelEnabled: false, steps: 1, curveSegments: 1 });
  fin.rotateY(-Math.PI / 2);
  fin.translate(0.06, 0, 0);

  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material,
    x: number, y: number, z: number, scaleX = 1, scaleY = 1, scaleZ = 1): void => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(scaleX, scaleY, scaleZ);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  };
  add('Fuselage', rounded, pale, 0, 0, 0, 0.48, 0.42, 4.1);
  add('Cockpit glazing', rounded, dark, 0, 0.3, 2.55, 0.32, 0.14, 0.68);
  add('Swept wings', wing, pale, 0, 0, 0);
  add('Tailplane', wing, pale, 0, 0.08, -2.65, 0.45, 1, 0.36);
  add('Tail fin', fin, pale, 0, 0, 0);
  add('Left nacelle', rounded, dark, -1.35, -0.38, -0.4, 0.22, 0.22, 0.65);
  add('Right nacelle', rounded, dark, 1.35, -0.38, -0.4, 0.22, 0.22, 0.65);
  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.visible = false;
      group.removeFromParent();
      group.clear();
      rounded.dispose();
      wing.dispose();
      fin.dispose();
      pale.dispose();
      dark.dispose();
    },
  };
}
