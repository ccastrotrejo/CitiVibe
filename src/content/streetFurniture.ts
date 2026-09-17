import { LOADING_STOP } from './transitService';

export interface StreetProp {
  id: string;
  x: number;
  z: number;
  yaw: number;
}

export interface CurbVehicle extends StreetProp {
  kind: 'parked-car';
  width: number;
  length: number;
}

/** Only the non-cycling side of the two park-border streets has a spare curb lane. */
export const CURB_VEHICLES: readonly CurbVehicle[] = [-1, 1].flatMap((side) =>
  [-21, -14, -7, 7, 14, 21].map((x, index) => ({
    id: `parked-car-${side}-${index}`, kind: 'parked-car' as const,
    x, z: side * 98.85, yaw: -side * Math.PI / 2, width: 1.5, length: 3.4 + index % 2 * 0.3,
  })));

export const PARKING_BAYS = CURB_VEHICLES.map((vehicle) => ({
  ...vehicle, width: 2, length: 6.2,
}));

/** Corner pockets include a clear approach from the through-sidewalk to the serving counter. */
export const FOOD_CARTS: readonly StreetProp[] = [
  { id: 'lantern-food-cart', x: -92, z: -105, yaw: 0 },
  { id: 'willow-food-cart', x: 86, z: -105, yaw: 0 },
  { id: 'alder-food-cart', x: -86, z: 105, yaw: Math.PI },
  { id: 'harbor-food-cart', x: 86, z: 122, yaw: 0 },
];

export const FOOD_CART_SPACE = { width: 2.8, depth: 3.3, forwardOffset: 0.65, height: 2.7 } as const;

export function foodCartBounds(cart: StreetProp) {
  return propBounds({
    ...cart,
    x: cart.x + Math.sin(cart.yaw) * FOOD_CART_SPACE.forwardOffset,
    z: cart.z + Math.cos(cart.yaw) * FOOD_CART_SPACE.forwardOffset,
  }, FOOD_CART_SPACE.width, FOOD_CART_SPACE.depth);
}

export const PARKING_SIGNS: readonly StreetProp[] = [-1, 1].flatMap((side) =>
  [-17.5, 17.5].map((x) => ({
    id: `parking-sign-${side}-${x}`, x, z: side * 99.97, yaw: side < 0 ? 0 : Math.PI,
  })));

/** Only the ends of the two occupied curb runs are marked, never individual bays. */
export const CURB_RUN_ENDS = [-1, 1].flatMap((side) => [-25.3, 25.3].map((x) => ({
  id: `curb-run-end-${side}-${x}`, x, z: side * 100.09, yaw: 0,
})));

export const LOADING_CURB_MARKER = {
  id: 'juniper-service-marker', x: LOADING_STOP.x, z: 100.09, yaw: Math.PI,
} as const;

export const BENCH_SPACE = { width: 2.4, depth: 0.86, seatHeight: 0.5175 } as const;

/** Front approach plus one companion space; these are reservations, not accessibility certification. */
export function benchAccessPocket(prop: StreetProp, width: number = BENCH_SPACE.width) {
  const point = (x: number, z: number): StreetProp => ({
    ...prop, x: prop.x + Math.cos(prop.yaw) * x + Math.sin(prop.yaw) * z,
    z: prop.z - Math.sin(prop.yaw) * x + Math.cos(prop.yaw) * z,
  });
  return {
    seat: propBounds(prop, width, BENCH_SPACE.depth),
    approach: propBounds(point(0, 0.95), width, 1),
    companion: propBounds(point(width / 2 + 0.65, 0.25), 0.9, 1.4),
    facing: { x: Math.sin(prop.yaw), z: Math.cos(prop.yaw) },
  };
}

/** Civic forecourts and existing neighborhood plazas, never the empty island perimeter. */
export const STREET_MAILBOXES: readonly StreetProp[] = [
  { id: 'mailbox--1-0', x: -57.2, z: -47.8, yaw: -Math.PI / 2 },
  { id: 'mailbox--1-1', x: -57.2, z: 43.5, yaw: -Math.PI / 2 },
  { id: 'mailbox--1-2', x: 13.5, z: -140.9, yaw: 0 },
  { id: 'mailbox-1-0', x: 61, z: -42, yaw: Math.PI },
  { id: 'mailbox-1-1', x: 57.5, z: 3.1, yaw: Math.PI / 2 },
  { id: 'mailbox-1-2', x: 57.5, z: 153.1, yaw: 0 },
];

/** Seats face into the six existing plazas or toward a civic frontage's public approach. */
export const STREET_BENCHES: readonly StreetProp[] = [
  { id: 'street-bench--1-0', x: -61, z: -42, yaw: Math.PI },
  { id: 'street-bench--1-1', x: -63.9, z: 1.8, yaw: Math.PI / 2 },
  { id: 'street-bench--1-2', x: -60, z: 49, yaw: Math.PI },
  { id: 'street-bench--1-3', x: 1.5, z: -141.3, yaw: 0 },
  { id: 'street-bench-1-0', x: 63.8, z: -47.5, yaw: -Math.PI / 2 },
  { id: 'street-bench-1-1', x: 61, z: 3.8, yaw: Math.PI },
  { id: 'street-bench-1-2', x: 58.2, z: 47.8, yaw: Math.PI / 2 },
  { id: 'street-bench-1-3', x: 64.6, z: 152.7, yaw: 0 },
];

/** Short, level forecourt links meet existing sidewalk paving without narrowing its through-lanes. */
export const STREET_FURNITURE_APRONS = [
  { id: 'hospital-seat-apron', minX: 0.05, maxX: 2.95, minZ: -141.75, maxZ: -139.7 },
  { id: 'hospital-mail-apron', minX: 12.8, maxX: 14.2, minZ: -141.55, maxZ: -139.7 },
  { id: 'police-seat-apron', minX: 63.15, maxX: 66.05, minZ: 152.25, maxZ: 154.3 },
  { id: 'police-mail-apron', minX: 56.8, maxX: 58.2, minZ: 152.45, maxZ: 154.3 },
] as const;

export const EXTRA_PARK_BENCHES: readonly StreetProp[] = [
  ...[-1, 1].flatMap((side) => [58.8, 62.7, 72].map((z) => ({
    id: `mall-bench-${side}-${z}`, x: side * 4.4, z, yaw: -side * Math.PI / 2,
  }))),
  { id: 'north-bench-west', x: -5, z: -84, yaw: 0 },
  { id: 'north-bench-east', x: 5, z: -84, yaw: 0 },
  { id: 'reservoir-bench-east', x: 30.7, z: -54, yaw: -Math.PI / 2 },
  { id: 'meadow-bench-south', x: 17, z: 83.2, yaw: Math.PI },
];

/** Existing east mall seat gains a flush approach; a reading neighbor stands outside the through-flow. */
export const PARK_READING_POCKET = {
  benchId: 'mall-bench-1-58.8',
  minX: 2.4, maxX: 4.84, minZ: 57.45, maxZ: 60.15,
  x: 3.3, z: 58.8, surfaceY: -0.012,
} as const;

/** World AABB of a cardinal prop, used for clearance checks and diagnostics. */
export function propBounds(prop: StreetProp, width: number, depth: number) {
  const halfX = (Math.abs(Math.cos(prop.yaw)) * width + Math.abs(Math.sin(prop.yaw)) * depth) / 2;
  const halfZ = (Math.abs(Math.sin(prop.yaw)) * width + Math.abs(Math.cos(prop.yaw)) * depth) / 2;
  return { minX: prop.x - halfX, maxX: prop.x + halfX, minZ: prop.z - halfZ, maxZ: prop.z + halfZ };
}
