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
    x, z: side * 98.85, yaw: -side * Math.PI / 2, width: 1.65, length: 2.8,
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

export const STREET_MAILBOXES: readonly StreetProp[] = [-1, 1].flatMap((side) =>
  [-72, -18, 44].map((z, index) => ({
    id: `mailbox-${side}-${index}`, x: side * 109.55, z, yaw: -side * Math.PI / 2,
  })));

export const STREET_BENCHES: readonly StreetProp[] = [-1, 1].flatMap((side) =>
  [-80, -42, 16, 72].map((z, index) => ({
    id: `street-bench-${side}-${index}`, x: side * 109.55, z, yaw: -side * Math.PI / 2,
  })));

export const EXTRA_PARK_BENCHES: readonly StreetProp[] = [
  ...[-1, 1].flatMap((side) => [58.8, 62.7, 72].map((z) => ({
    id: `mall-bench-${side}-${z}`, x: side * 4.4, z, yaw: -side * Math.PI / 2,
  }))),
  { id: 'north-bench-west', x: -5, z: -84, yaw: 0 },
  { id: 'north-bench-east', x: 5, z: -84, yaw: 0 },
  { id: 'reservoir-bench-east', x: 30.7, z: -54, yaw: -Math.PI / 2 },
  { id: 'meadow-bench-south', x: 17, z: 83.2, yaw: Math.PI },
];

/** World AABB of a cardinal prop, used for clearance checks and diagnostics. */
export function propBounds(prop: StreetProp, width: number, depth: number) {
  const halfX = (Math.abs(Math.cos(prop.yaw)) * width + Math.abs(Math.sin(prop.yaw)) * depth) / 2;
  const halfZ = (Math.abs(Math.sin(prop.yaw)) * width + Math.abs(Math.cos(prop.yaw)) * depth) / 2;
  return { minX: prop.x - halfX, maxX: prop.x + halfX, minZ: prop.z - halfZ, maxZ: prop.z + halfZ };
}
