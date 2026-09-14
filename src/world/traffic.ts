import {
  BIKE_OFFSET, bikeLaneOffset, BIKE_SHARE_RIDER_IDS, INTERSECTION_GATE, INTERSECTIONS, SIDEWALK_OFFSET,
  STOP_LINE_OFFSET, STREET_BLOCKS, STREET_X, STREET_Z, TRAFFIC_ACTORS, VEHICLE_OFFSET,
  type TrafficSignalState, type TrafficVehicleType,
} from '../content/streets';
import {
  BIKE_SHARE_LAYOUT, BIKE_SHARE_STATIONS, type BikeSharePhase, type BikeShareStation, type BikeShareTripState,
} from '../content/bikeShare';
import { PERSON_SPACE } from '../content/people';
import type { ActorState } from './actors';
import { StreetPedestrians } from './pedestrians';

export type { TrafficSignalState } from '../content/streets';

export const TRAFFIC = {
  maxStep: 1 / 30,
  acceleration: 1.5,
  braking: 2.5,
  vehicleGap: 2,
  bicycleGap: 1.2,
  stopBuffer: 0.3,
  greenSeconds: 8,
  clearanceSeconds: 1,
  pedestrianSeconds: 3,
  /** A posted stop is only satisfied by a full halt held at the painted bar. */
  stopSeconds: 0.8,
  maxVehicleSpeed: 4.8,
  maxBicycleSpeed: 3.4,
  maxBicycleTurnRate: 1.1,
  indicatorApproach: 12,
} as const;

export const TRAFFIC_LENGTHS: Record<TrafficVehicleType, number> = {
  sedan: 2.8, taxi: 2.8, van: 3.5, truck: 4.6, bus: 4.8, bicycle: 2,
  // Emergency vehicles re-skin same-length cars: firetruck/ambulanceBox match truck (4.6),
  // ambulanceVan matches van (3.5), fireSuv matches sedan (2.8) so placement never shifts.
  ambulanceVan: 3.5, ambulanceBox: 4.6, firetruck: 4.6, fireSuv: 2.8,
};

interface Point { x: number; z: number }

interface EllipticTurn {
  incomingRadius: number;
  outgoingRadius: number;
  lead: number;
  distances: Float64Array;
}

export interface TrafficSegment {
  kind: 'link' | 'junction';
  start: number;
  length: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
  radius: number;
  turn: number;
  centerX: number;
  centerZ: number;
  /** Directed shared lane identity, or the intersection index for a turn. */
  lane: string;
  intersection: number;
  axis: 'north-south' | 'east-west';
  ellipse?: EllipticTurn;
  speedLimit?: number;
  gates?: readonly SharedBikeGate[];
}

export interface TrafficRoute {
  id: string;
  length: number;
  segments: readonly TrafficSegment[];
}

type SharedBikeGate =
  | { type: 'pedestrian'; stationId: string; crossingX: number; crossingZ: number; horizontal: boolean; length: number; spanLength?: number }
  | { type: 'merge'; stationId: string; targetLane: string; targetCoord: number }
  | { type: 'roadway'; stationId: string; crossingX: number; crossingZ: number; length: number };

interface Motion {
  actor: ActorState;
  route: TrafficRoute;
  segment: number;
  length: number;
  desiredSpeed: number;
  bicycle: boolean;
  advance: number;
  permit: number;
  releaseRemaining: number;
  requestSince: number;
  bikeShare?: SharedBikeMotion;
  /** Seconds held motionless at a posted stop bar; reset by any movement. */
  stopHold: number;
}

interface SharedBikeMotion {
  station: BikeShareStation;
  dockDistance: number;
  spurStart: number;
  spurEnd: number;
  dockRemaining: number;
  dockDuration: number;
}

interface SharedBikeRoute {
  station: BikeShareStation;
  route: TrafficRoute;
  dockDistance: number;
  spurStart: number;
  spurEnd: number;
  initialDwell: number;
}

interface Junction extends TrafficSignalState {
  owner: Motion | null;
  elapsed: number;
  stage: number;
  /** All-way stops alternate: after a walker crosses, a waiting driver goes next. */
  driverTurn: boolean;
}

const EPSILON = 1e-7;
// Stop before the painted bar without changing the tighter, road-contained turn arcs.
const STOP_APPROACH_BUFFER = STOP_LINE_OFFSET - INTERSECTION_GATE + TRAFFIC.stopBuffer;
const QUARTER_TURN = Math.PI / 2;
const ARC_SAMPLES = 256;
const ARC_STEP = QUARTER_TURN / ARC_SAMPLES;
const PHASES = ['north-south', 'clearance', 'east-west', 'clearance', 'pedestrians', 'clearance'] as const;

function wrap(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function ahead(from: number, to: number, length: number): number {
  const distance = wrap(to - from, length);
  return distance < EPSILON || length - distance < EPSILON ? 0 : distance;
}

function sequence(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function rectangleNodes(left: number, top: number, right: number, bottom: number, reverse = false): number[] {
  const nodes: number[] = [];
  const columns = STREET_X.length;
  for (let column = left; column < right; column += 1) nodes.push(top * columns + column);
  for (let row = top; row < bottom; row += 1) nodes.push(row * columns + right);
  for (let column = right; column > left; column -= 1) nodes.push(bottom * columns + column);
  for (let row = bottom; row > top; row -= 1) nodes.push(row * columns + left);
  return reverse ? nodes.reverse() : nodes;
}

const LAST_COLUMN = STREET_X.length - 1;
const LAST_ROW = STREET_Z.length - 1;
const PARK_COLUMN = Math.floor(LAST_COLUMN / 2);
const PARK_ROW = Math.floor(LAST_ROW / 2);
const CIRCUITS = [
  rectangleNodes(0, 0, LAST_COLUMN, LAST_ROW),
  rectangleNodes(1, 1, LAST_COLUMN - 1, LAST_ROW - 1, true),
  rectangleNodes(0, 0, PARK_COLUMN + 1, PARK_ROW + 1),
  rectangleNodes(PARK_COLUMN, PARK_ROW, LAST_COLUMN, LAST_ROW),
  rectangleNodes(0, PARK_ROW, LAST_COLUMN, PARK_ROW + 1, true),
  rectangleNodes(PARK_COLUMN, 0, PARK_COLUMN + 1, LAST_ROW, true),
];

function direction(from: Point, to: Point): Point {
  return { x: Math.sign(to.x - from.x), z: Math.sign(to.z - from.z) };
}

function arcSpeed(curve: EllipticTurn, angle: number): number {
  return Math.hypot(curve.incomingRadius * Math.cos(angle), curve.outgoingRadius * Math.sin(angle));
}

function arcLength(curve: EllipticTurn, from: number, to: number): number {
  return (to - from) / 6 * (arcSpeed(curve, from) + 4 * arcSpeed(curve, (from + to) / 2) + arcSpeed(curve, to));
}

function makeEllipse(incomingRadius: number, outgoingRadius: number, lead: number): EllipticTurn {
  const curve = { incomingRadius, outgoingRadius, lead, distances: new Float64Array(ARC_SAMPLES + 1) };
  for (let index = 1; index <= ARC_SAMPLES; index += 1) {
    curve.distances[index] = curve.distances[index - 1] + arcLength(curve, (index - 1) * ARC_STEP, index * ARC_STEP);
  }
  return curve;
}

function arcAngle(curve: EllipticTurn, distance: number): number {
  let low = 0;
  let high = ARC_SAMPLES;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if (curve.distances[middle] <= distance) low = middle;
    else high = middle;
  }
  const start = low * ARC_STEP;
  const end = high * ARC_STEP;
  let angle = start + ARC_STEP * (distance - curve.distances[low]) / (curve.distances[high] - curve.distances[low]);
  // Refine inside the lookup interval so unequal axes do not change ground speed.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const error = curve.distances[low] + arcLength(curve, start, angle) - distance;
    angle = Math.max(start, Math.min(end, angle - error / arcSpeed(curve, angle)));
  }
  return angle;
}

function laneOffset(point: Point, travel: Point): number {
  const horizontal = travel.x !== 0;
  return bikeLaneOffset(horizontal ? 'east-west' : 'north-south', horizontal ? point.z : point.x,
    horizontal ? travel.x : travel.z);
}

function makeRoute(nodes: readonly number[], offset: number, id: string, bicycle = false): TrafficRoute {
  const segments: TrafficSegment[] = [];
  let length = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    const previous = INTERSECTIONS[nodes[(index + nodes.length - 1) % nodes.length]];
    const intersection = nodes[index];
    const current = INTERSECTIONS[intersection];
    const nextIndex = nodes[(index + 1) % nodes.length];
    const next = INTERSECTIONS[nextIndex];
    const incoming = direction(previous, current);
    const outgoing = direction(current, next);
    const incomingOffset = bicycle ? laneOffset(current, incoming) : offset;
    const outgoingOffset = bicycle ? laneOffset(current, outgoing) : offset;
    const turn = incoming.x * outgoing.z - incoming.z * outgoing.x;
    // Tighter curb-side arcs leave room for the whole bicycle, not only its center.
    const turnGate = bicycle && turn === 1 && incomingOffset > 0 && outgoingOffset > 0 ? 5.6 : INTERSECTION_GATE;
    const lead = INTERSECTION_GATE - turnGate;
    const radius = turnGate - turn * incomingOffset;
    const incomingRadius = turnGate - turn * outgoingOffset;
    const ellipse = turn !== 0 && (incomingRadius !== radius || lead > 0) ? makeEllipse(incomingRadius, radius, lead) : undefined;
    const minimumRadius = Math.min(incomingRadius, radius) ** 2 / Math.max(incomingRadius, radius);
    const x = current.x - incoming.x * INTERSECTION_GATE - incoming.z * incomingOffset;
    const z = current.z - incoming.z * INTERSECTION_GATE + incoming.x * incomingOffset;
    const junctionLength = turn === 0 ? INTERSECTION_GATE * 2 :
      ellipse ? ellipse.distances[ARC_SAMPLES] + lead * 2 : QUARTER_TURN * radius;
    segments.push({
      kind: 'junction', start: length, length: junctionLength, x, z,
      dx: incoming.x, dz: incoming.z, radius, turn,
      centerX: x + outgoing.x * radius, centerZ: z + outgoing.z * radius,
      lane: '', intersection, axis: incoming.x === 0 ? 'north-south' : 'east-west',
      ellipse, speedLimit: bicycle && turn !== 0 ? minimumRadius * TRAFFIC.maxBicycleTurnRate : undefined,
    });
    length += junctionLength;
    const linkLength = Math.abs(next.x - current.x) + Math.abs(next.z - current.z) - INTERSECTION_GATE * 2;
    segments.push({
      kind: 'link', start: length, length: linkLength,
      x: current.x + outgoing.x * INTERSECTION_GATE - outgoing.z * outgoingOffset,
      z: current.z + outgoing.z * INTERSECTION_GATE + outgoing.x * outgoingOffset,
      dx: outgoing.x, dz: outgoing.z, radius: 0, turn: 0, centerX: 0, centerZ: 0,
      lane: `${nodes[index]}>${nextIndex}:${outgoingOffset}`,
      intersection: nextIndex, axis: outgoing.x === 0 ? 'north-south' : 'east-west',
    });
    length += linkLength;
  }
  return { id, length, segments };
}

/** Connected circuits share directed graph edges, including both driving directions. */
export const TRAFFIC_ROUTES: readonly TrafficRoute[] = [
  ...CIRCUITS.map((nodes, index) => makeRoute(nodes, VEHICLE_OFFSET, `motor-${index}`)),
  ...CIRCUITS.map((nodes, index) => makeRoute(nodes, BIKE_OFFSET, `cycle-${index}`, true)),
];

export const SHARED_BIKE_SPUR_SPEED = 1.15;
const SHARED_BIKE_TURN_RADIUS = 0.8;
const JUNIPER_TURN_RADIUS = 0.6;
const PEDESTRIAN_MAX_PACE = 1.56;
const SHARED_BIKE_ROUTE_INDEX = 1;
const SHARED_BIKE_RIDER_ID_SET = new Set<string>(BIKE_SHARE_RIDER_IDS);

function outgoingDirection(incoming: Point, turn: number): Point {
  return { x: -incoming.z * turn, z: incoming.x * turn };
}

function endOfTurn(start: Point, incoming: Point, turn: number, radius: number): Point {
  const outgoing = outgoingDirection(incoming, turn);
  const center = { x: start.x + outgoing.x * radius, z: start.z + outgoing.z * radius };
  const x = start.x - center.x;
  const z = start.z - center.z;
  const cos = Math.cos(turn * QUARTER_TURN);
  const sin = Math.sin(turn * QUARTER_TURN);
  return { x: center.x + x * cos - z * sin, z: center.z + x * sin + z * cos };
}

function straightSegment(from: Point, to: Point, lane: string, speedLimit = SHARED_BIKE_SPUR_SPEED,
  gates?: readonly SharedBikeGate[]): Omit<TrafficSegment, 'start'> {
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  if (length < EPSILON) throw new Error(`Zero-length shared-bike segment ${lane}.`);
  const dx = Math.abs(to.x - from.x) > Math.abs(to.z - from.z) ? Math.sign(to.x - from.x) : 0;
  const dz = dx === 0 ? Math.sign(to.z - from.z) : 0;
  if (Math.abs(to.x - from.x - dx * length) > 1e-6 || Math.abs(to.z - from.z - dz * length) > 1e-6) {
    throw new Error(`Non-cardinal shared-bike segment ${lane}.`);
  }
  return {
    kind: 'link', length, x: from.x, z: from.z, dx, dz, radius: 0, turn: 0, centerX: 0, centerZ: 0,
    lane, intersection: -1, axis: dx === 0 ? 'north-south' : 'east-west', speedLimit, gates,
  };
}

function turnSegment(start: Point, incoming: Point, turn: number, radius: number, lane: string,
  gates?: readonly SharedBikeGate[]): Omit<TrafficSegment, 'start'> {
  const outgoing = outgoingDirection(incoming, turn);
  return {
    kind: 'link', length: QUARTER_TURN * radius, x: start.x, z: start.z,
    dx: incoming.x, dz: incoming.z, radius, turn,
    centerX: start.x + outgoing.x * radius, centerZ: start.z + outgoing.z * radius,
    lane, intersection: -1, axis: incoming.x === 0 ? 'north-south' : 'east-west',
    speedLimit: Math.min(SHARED_BIKE_SPUR_SPEED, radius * TRAFFIC.maxBicycleTurnRate), gates,
  };
}

function withStarts(segments: readonly Omit<TrafficSegment, 'start'>[]): TrafficRoute['segments'] {
  let start = 0;
  return segments.map((segment) => {
    const next = { ...segment, start };
    start += segment.length;
    return next;
  });
}

function cloneSegment(segment: TrafficSegment): Omit<TrafficSegment, 'start'> {
  const rest: Partial<TrafficSegment> = { ...segment };
  delete rest.start;
  return rest as Omit<TrafficSegment, 'start'>;
}

function splitLinkSegment(segment: TrafficSegment, start: number, length: number): Omit<TrafficSegment, 'start'> {
  return {
    ...cloneSegment(segment), length,
    x: segment.x + segment.dx * start,
    z: segment.z + segment.dz * start,
  };
}

function spliceBikeShareRoute(
  base: TrafficRoute,
  linkIndex: number,
  exitAlong: number,
  entryAlong: number,
  station: BikeShareStation,
  spur: readonly Omit<TrafficSegment, 'start'>[],
  dockSpurIndex: number,
): SharedBikeRoute {
  const link = base.segments[linkIndex];
  if (link.kind !== 'link' || exitAlong <= 0 || entryAlong >= link.length || exitAlong >= entryAlong) {
    throw new Error(`Invalid shared-bike splice for ${station.id}.`);
  }
  const pieces: Omit<TrafficSegment, 'start'>[] = [];
  for (let index = 0; index < linkIndex; index += 1) pieces.push(cloneSegment(base.segments[index]));
  pieces.push(splitLinkSegment(link, 0, exitAlong));
  const spurStartIndex = pieces.length;
  pieces.push(...spur);
  pieces.push(splitLinkSegment(link, entryAlong, link.length - entryAlong));
  for (let index = linkIndex + 1; index < base.segments.length; index += 1) pieces.push(cloneSegment(base.segments[index]));
  const segments = withStarts(pieces);
  const length = segments.reduce((sum, segment) => sum + segment.length, 0);
  const spurStart = segments[spurStartIndex].start;
  const spurEnd = segments[spurStartIndex + spur.length - 1].start + segments[spurStartIndex + spur.length - 1].length;
  const dockDistance = segments[spurStartIndex + dockSpurIndex].start + segments[spurStartIndex + dockSpurIndex].length;
  const route = { id: `bike-share-${station.id}`, length, segments };
  return {
    station, route, dockDistance, spurStart, spurEnd,
    initialDwell: 1 + (station.phase % BIKE_SHARE_LAYOUT.dockSeconds),
  };
}

function bikeShareLaneGate(stationId: string, target: TrafficSegment, targetAlong: number): SharedBikeGate {
  return {
    type: 'merge', stationId, targetLane: target.lane,
    targetCoord: (target.x + target.dx * targetAlong) * target.dx + (target.z + target.dz * targetAlong) * target.dz,
  };
}

function makeSideStationTrip(station: BikeShareStation, base: TrafficRoute, laneIndex: number): SharedBikeRoute {
  const link = base.segments[laneIndex];
  const r = SHARED_BIKE_TURN_RADIUS;
  const westSide = station.x < link.x;
  const dock = { x: station.x + station.activeSlot * BIKE_SHARE_LAYOUT.slotSpacing, z: station.z };
  const laneX = link.x;
  if (link.dx !== 0) throw new Error(`Shared-bike side station ${station.id} needs a vertical lane.`);
  const exitZ = station.z - link.dz * 2 * r;
  const entryZ = station.z + link.dz * 3 * r;
  const exitAlong = (exitZ - link.z) / link.dz;
  const entryAlong = (entryZ - link.z) / link.dz;
  const exit = { x: laneX, z: exitZ };
  const lateral = { x: westSide ? -1 : 1, z: 0 };
  const turnOut = -lateral.x / link.dz;
  const exitArcEnd = endOfTurn(exit, { x: 0, z: link.dz }, turnOut, r);
  const dockTurnStart = { x: dock.x - lateral.x * r, z: dock.z - link.dz * r };
  const dockTurn = -turnOut;
  const postDock = { x: dock.x, z: dock.z + link.dz * r };
  const departArcEnd = endOfTurn(postDock, { x: 0, z: link.dz }, -turnOut, r);
  const mergeArcStart = { x: laneX + lateral.x * r, z: entryZ - link.dz * r };
  const mergeArcEnd = endOfTurn(mergeArcStart, { x: -lateral.x, z: 0 }, turnOut, r);
  const sidewalkCrossing = 3.8;
  const sidewalkOutGates: SharedBikeGate[] = [
    bikeShareLaneGate(station.id, link, entryAlong),
    { type: 'pedestrian', stationId: station.id, crossingX: laneX + lateral.x * 2.7,
      crossingZ: departArcEnd.z, horizontal: true, length: Math.abs(mergeArcStart.x - departArcEnd.x), spanLength: sidewalkCrossing },
  ];
  const spur = [
    turnSegment(exit, { x: 0, z: link.dz }, turnOut, r, `${station.id}:exit-arc`),
    straightSegment(exitArcEnd, dockTurnStart, `${station.id}:sidewalk-in`),
    turnSegment(dockTurnStart, lateral, dockTurn, r, `${station.id}:dock-approach`),
    straightSegment(dock, postDock, `${station.id}:dock-departure`, SHARED_BIKE_SPUR_SPEED, sidewalkOutGates),
    turnSegment(postDock, { x: 0, z: link.dz }, -turnOut, r, `${station.id}:departure-arc`),
    straightSegment(departArcEnd, mergeArcStart, `${station.id}:sidewalk-out`),
    turnSegment(mergeArcStart, { x: -lateral.x, z: 0 }, turnOut, r, `${station.id}:merge-arc`),
  ];
  if (Math.hypot(mergeArcEnd.x - laneX, mergeArcEnd.z - entryZ) > 1e-6) throw new Error(`Bad shared-bike merge for ${station.id}.`);
  return spliceBikeShareRoute(base, laneIndex, exitAlong, entryAlong, station, spur, 2);
}

function makeJuniperTrip(station: BikeShareStation, base: TrafficRoute, laneIndex: number): SharedBikeRoute {
  const link = base.segments[laneIndex];
  const r = JUNIPER_TURN_RADIUS;
  const dock = { x: station.x + station.activeSlot * BIKE_SHARE_LAYOUT.slotSpacing, z: station.z };
  if (link.dx !== 1 || Math.abs(link.z - 91.55) > 1e-6) {
    throw new Error(`Juniper shared-bike access needs the eastbound protected lane, got dx=${link.dx} z=${link.z}.`);
  }
  const exitX = 25.1;
  const entryX = 26.9;
  const exitAlong = exitX - link.x;
  const entryAlong = entryX - link.x;
  const exit = { x: exitX, z: link.z };
  const exitArcEnd = endOfTurn(exit, { x: 1, z: 0 }, 1, r);
  const crossInEnd = { x: exitArcEnd.x, z: station.z - r * 2 };
  const westArcEnd = endOfTurn(crossInEnd, { x: 0, z: 1 }, 1, r);
  const dockTurnStart = { x: dock.x + r, z: station.z - r };
  const postDock = { x: dock.x, z: dock.z + r };
  const departArcEnd = endOfTurn(postDock, { x: 0, z: 1 }, -1, r);
  const northArcStart = { x: entryX - 2 * r, z: departArcEnd.z };
  const northArcEnd = endOfTurn(northArcStart, { x: 1, z: 0 }, -1, r);
  const mergeArcStart = { x: northArcEnd.x, z: link.z + r };
  const mergeArcEnd = endOfTurn(mergeArcStart, { x: 0, z: -1 }, 1, r);
  const roadGateOut: SharedBikeGate = { type: 'roadway', stationId: station.id, crossingX: northArcEnd.x,
    crossingZ: (northArcEnd.z + mergeArcStart.z) / 2, length: Math.abs(northArcEnd.z - mergeArcStart.z) + 8 };
  const pedGateOut: SharedBikeGate = { type: 'pedestrian', stationId: station.id, crossingX: northArcEnd.x,
    crossingZ: 101.7, horizontal: false, length: Math.abs(northArcEnd.z - mergeArcStart.z), spanLength: 3.8 };
  const juniperOutGates: SharedBikeGate[] = [roadGateOut, pedGateOut, bikeShareLaneGate(station.id, link, entryAlong)];
  const spur = [
    turnSegment(exit, { x: 1, z: 0 }, 1, r, `${station.id}:exit-arc`),
    straightSegment(exitArcEnd, crossInEnd, `${station.id}:roadway-in`),
    turnSegment(crossInEnd, { x: 0, z: 1 }, 1, r, `${station.id}:apron-in-arc`),
    straightSegment(westArcEnd, dockTurnStart, `${station.id}:apron-in`),
    turnSegment(dockTurnStart, { x: -1, z: 0 }, -1, r, `${station.id}:dock-approach`),
    straightSegment(dock, postDock, `${station.id}:dock-departure`, SHARED_BIKE_SPUR_SPEED, juniperOutGates),
    turnSegment(postDock, { x: 0, z: 1 }, -1, r, `${station.id}:apron-out-arc`),
    straightSegment(departArcEnd, northArcStart, `${station.id}:apron-out`),
    turnSegment(northArcStart, { x: 1, z: 0 }, -1, r, `${station.id}:roadway-out-arc`),
    straightSegment(northArcEnd, mergeArcStart, `${station.id}:roadway-out`),
    turnSegment(mergeArcStart, { x: 0, z: -1 }, 1, r, `${station.id}:merge-arc`),
  ];
  if (Math.hypot(mergeArcEnd.x - entryX, mergeArcEnd.z - link.z) > 1e-6) throw new Error('Bad Juniper shared-bike merge.');
  return spliceBikeShareRoute(base, laneIndex, exitAlong, entryAlong, station, spur, 4);
}

export const SHARED_BIKE_ROUTES: readonly SharedBikeRoute[] = Object.freeze((() => {
  const base = TRAFFIC_ROUTES[CIRCUITS.length + SHARED_BIKE_ROUTE_INDEX];
  const juniperBase = TRAFFIC_ROUTES[CIRCUITS.length + 4];
  const stations = Object.fromEntries(BIKE_SHARE_STATIONS.map((station) => [station.id, station]));
  return [
    makeSideStationTrip(stations['lantern-bike-bay'], base, 1),
    makeSideStationTrip(stations['willow-bike-bay'], base, 13),
    makeJuniperTrip(stations['juniper-bike-bay'], juniperBase, 5),
  ];
})());

const SHARED_BIKE_ROUTE_BY_ACTOR: ReadonlyMap<string, SharedBikeRoute> =
  new Map(SHARED_BIKE_ROUTES.map((trip) => [trip.station.riderId, trip]));

export function trafficRouteForActor(definitionIndex: number): TrafficRoute {
  const definition = TRAFFIC_ACTORS[definitionIndex];
  if (!definition || definition.kind === 'pedestrian') throw new RangeError('Traffic route actor index must reference a moving road actor.');
  const shared = SHARED_BIKE_ROUTE_BY_ACTOR.get(definition.id);
  if (shared) return shared.route;
  const previous = TRAFFIC_ACTORS.slice(0, definitionIndex);
  if (definition.kind === 'cyclist') {
    const bicycleIndex = previous.filter(({ kind, id }) => kind === 'cyclist' && !SHARED_BIKE_RIDER_ID_SET.has(id)).length;
    return TRAFFIC_ROUTES[CIRCUITS.length + bicycleIndex % CIRCUITS.length];
  }
  const motorIndex = previous.filter(({ kind }) => kind === 'car' || kind === 'bus').length;
  return TRAFFIC_ROUTES[motorIndex % CIRCUITS.length];
}

function makeFootpath(
  block: typeof STREET_BLOCKS[number], offset = SIDEWALK_OFFSET, reverse = false, cornerInset = SIDEWALK_OFFSET + 1,
): TrafficRoute {
  const left = block.minX + offset;
  const right = block.maxX - offset;
  const top = block.minZ + offset;
  const bottom = block.maxZ - offset;
  const radius = cornerInset - offset;
  const vertices = [{ x: left, z: top }, { x: right, z: top }, { x: right, z: bottom }, { x: left, z: bottom }];
  if (reverse) vertices.reverse();
  const segments: TrafficSegment[] = [];
  let length = 0;
  for (let index = 0; index < 4; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % 4];
    const incoming = direction(vertices[(index + 3) % 4], current);
    const outgoing = direction(current, next);
    const x = current.x - incoming.x * radius;
    const z = current.z - incoming.z * radius;
    const arcLength = QUARTER_TURN * radius;
    segments.push({
      kind: 'junction', start: length, length: arcLength, x, z,
      dx: incoming.x, dz: incoming.z, radius, turn: reverse ? -1 : 1,
      centerX: x + outgoing.x * radius, centerZ: z + outgoing.z * radius,
      lane: block.id, intersection: -1, axis: 'east-west',
    });
    length += arcLength;
    const linkLength = Math.abs(next.x - current.x) + Math.abs(next.z - current.z) - 2 * radius;
    segments.push({
      kind: 'link', start: length, length: linkLength,
      x: current.x + outgoing.x * radius, z: current.z + outgoing.z * radius,
      dx: outgoing.x, dz: outgoing.z, radius: 0, turn: 0, centerX: 0, centerZ: 0,
      lane: block.id, intersection: -1, axis: 'east-west',
    });
    length += linkLength;
  }
  return { id: block.id, length, segments };
}

export const SIDEWALK_ROUTES: readonly TrafficRoute[] = STREET_BLOCKS.map((block) => makeFootpath(block));
export const SIDEWALK_WALKING_OFFSETS = [SIDEWALK_OFFSET, SIDEWALK_OFFSET + 1] as const;
export const SIDEWALK_WALKING_CORNER_INSET = SIDEWALK_OFFSET + 1.7;
export const SIDEWALK_WALKING_CLEARANCE = 7.7;
/** Concentric opposite flows retain a one-metre lateral gap, including rounded corners. */
export const SIDEWALK_WALKING_ROUTES: readonly (readonly [TrafficRoute, TrafficRoute])[] = STREET_BLOCKS.map((block) => [
  makeFootpath(block, SIDEWALK_WALKING_OFFSETS[0], false, SIDEWALK_WALKING_CORNER_INSET),
  makeFootpath(block, SIDEWALK_WALKING_OFFSETS[1], true, SIDEWALK_WALKING_CORNER_INSET),
]);

/** Samples into a retained actor; distance and heading are continuous at every join. */
export function sampleTrafficRoute(route: TrafficRoute, distance: number, target: Pick<ActorState, 'position' | 'heading'>): void {
  const along = wrap(distance, route.length);
  let index = 0;
  while (index < route.segments.length - 1 && along >= route.segments[index + 1].start) index += 1;
  place(route.segments[index], along - route.segments[index].start, target);
}

function place(segment: TrafficSegment, distance: number, target: Pick<ActorState, 'position' | 'heading'>): void {
  if (segment.turn === 0) {
    target.position.x = segment.x + segment.dx * distance;
    target.position.z = segment.z + segment.dz * distance;
    target.heading = Math.atan2(segment.dx, segment.dz);
  } else if (segment.ellipse) {
    const curve = segment.ellipse;
    const along = distance - curve.lead;
    const curveLength = curve.distances[ARC_SAMPLES];
    const angle = along <= 0 ? 0 : along >= curveLength ? QUARTER_TURN : arcAngle(curve, along);
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const outX = -segment.dz * segment.turn;
    const outZ = segment.dx * segment.turn;
    const incomingTravel = Math.min(distance, curve.lead) + curve.incomingRadius * sin;
    const outgoingTravel = curve.outgoingRadius * (1 - cos) + Math.max(0, along - curveLength);
    target.position.x = segment.x + segment.dx * incomingTravel + outX * outgoingTravel;
    target.position.z = segment.z + segment.dz * incomingTravel + outZ * outgoingTravel;
    target.heading = Math.atan2(segment.dx * curve.incomingRadius * cos + outX * curve.outgoingRadius * sin,
      segment.dz * curve.incomingRadius * cos + outZ * curve.outgoingRadius * sin);
  } else {
    const angle = segment.turn * distance / segment.radius;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = segment.x - segment.centerX;
    const z = segment.z - segment.centerZ;
    target.position.x = segment.centerX + x * cos - z * sin;
    target.position.z = segment.centerZ + x * sin + z * cos;
    target.heading = Math.atan2(segment.dx * cos - segment.dz * sin, segment.dx * sin + segment.dz * cos);
  }
  target.position.y = 0;
}

function createActor(id: string, kind: ActorState['kind'], route: TrafficRoute, distance: number): ActorState {
  const actor: ActorState = {
    id, kind, position: { x: 0, y: 0, z: 0 }, heading: 0,
    state: 'moving', distance, speed: 0, routeLength: route.length,
    ...(kind === 'car' || kind === 'bus' ? { lighting: { turn: null, braking: true } } : {}),
  };
  sampleTrafficRoute(route, distance, actor);
  return actor;
}

/** Fixed-clock traffic. Reservations cover turns, cyclists, and the downstream exit. */
export class CityTraffic {
  readonly actors: readonly ActorState[];
  readonly signals: readonly TrafficSignalState[];
  elapsed = 0;
  private readonly junctions: Junction[];
  private readonly motions: Motion[];
  readonly pedestrians: StreetPedestrians;

  constructor(seed = 2401) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Traffic seed must be an unsigned 32-bit integer.');
    const random = sequence(seed);
    this.junctions = INTERSECTIONS.map(({ id, control }, index) => {
      const offset = random() * 3;
      const stop = control === 'all-way-stop';
      return {
        id, control, phase: stop ? 'stop' : index % 2 === 0 ? 'north-south' : 'east-west',
        walk: false, owner: null, elapsed: stop ? 0 : offset,
        stage: index % 2 === 0 ? 0 : 2, driverTurn: false,
      };
    });
    this.signals = Object.freeze(this.junctions);
    let motorIndex = 0;
    let bicycleIndex = 0;
    const placements = TRAFFIC_ACTORS.filter(({ kind }) => kind !== 'pedestrian').map((definition) => {
      const bikeShare = SHARED_BIKE_ROUTE_BY_ACTOR.get(definition.id);
      const bicycle = definition.kind === 'cyclist';
      const route = bikeShare?.route ??
        TRAFFIC_ROUTES[bicycle ? CIRCUITS.length + bicycleIndex++ % CIRCUITS.length : motorIndex++ % CIRCUITS.length];
      const length = TRAFFIC_LENGTHS[definition.vehicleType!];
      return {
        definition, bicycle, route, length, segment: -1, bikeShare,
        startLink: Math.floor(random() * route.segments.length / 2),
        offset: 1.5 + random(),
        desiredSpeed: bicycle ? 2.8 + random() * 0.6 : 3.8 + random(),
      };
    });
    const occupiedLanes = new Map<string, number>();
    // Augment the greedy allocation only when a shared route runs out of free lanes.
    const place = (index: number, visited: Set<string>): boolean => {
      const placement = placements[index];
      const linkCount = placement.route.segments.length / 2;
      for (const relocate of [false, true]) {
        for (let attempt = 0; attempt < linkCount; attempt++) {
          const candidate = ((placement.startLink + attempt) % linkCount) * 2 + 1;
          const lane = placement.route.segments[candidate].lane;
          const owner = occupiedLanes.get(lane);
          if (visited.has(lane) || (owner !== undefined) !== relocate) continue;
          visited.add(lane);
          if (owner !== undefined && !place(owner, visited)) continue;
          placement.segment = candidate;
          occupiedLanes.set(lane, index);
          return true;
        }
      }
      return false;
    };
    placements.forEach(({ definition }, index) => {
      if (placements[index].bikeShare) {
        const route = placements[index].route;
        const distance = placements[index].bikeShare.dockDistance;
        let segment = 0;
        while (segment < route.segments.length - 1 && distance >= route.segments[segment + 1].start) segment += 1;
        placements[index].segment = segment;
        return;
      }
      if (!place(index, new Set())) throw new Error(`No safe initial lane for ${definition.id}.`);
    });
    this.motions = placements.map(({ definition, bicycle, route, length, segment, offset, desiredSpeed, bikeShare }) => {
      const link = route.segments[segment];
      const distance = bikeShare?.dockDistance ?? link.start + Math.min(link.length / 2, length / 2 + offset);
      const actor = createActor(definition.id, definition.kind, route, distance);
      const motion: Motion = {
        actor,
        route, segment, length, bicycle,
        desiredSpeed,
        advance: 0, permit: -1, releaseRemaining: 0, requestSince: -1, stopHold: 0,
      };
      if (bikeShare) {
        motion.bikeShare = {
          station: bikeShare.station, dockDistance: bikeShare.dockDistance,
          spurStart: bikeShare.spurStart, spurEnd: bikeShare.spurEnd,
          dockRemaining: bikeShare.initialDwell, dockDuration: BIKE_SHARE_LAYOUT.dockSeconds,
        };
        actor.state = 'dwelling';
        actor.sharedBike = this.sharedBikeState(motion);
      }
      return motion;
    });
    this.pedestrians = new StreetPedestrians(SIDEWALK_WALKING_ROUTES, seed);
    this.actors = Object.freeze([...this.motions.map(({ actor }) => actor), ...this.pedestrians.actors]);
    this.motions.forEach((motion) => this.updateIndicator(motion));
  }

  /** Grip affects road motion only; time is never slowed or caught up. */
  step(dt: number, traction = 1): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Traffic delta must be finite and nonnegative.');
    if (!Number.isFinite(traction) || traction < 0.3 || traction > 1) throw new RangeError('Traffic traction must be between 0.3 and 1.');
    if (dt === 0) return;
    const seconds = Math.min(dt, TRAFFIC.maxStep);
    const speedFactor = Math.sqrt(traction);
    const acceleration = TRAFFIC.acceleration * traction;
    const braking = TRAFFIC.braking * traction;
    // Wet-road stopping space anticipates worsening grip; dry spacing stays unchanged.
    const reserveBraking = traction === 1 ? braking : TRAFFIC.braking * 0.3;
    this.elapsed += seconds;
    this.advanceSignals(seconds);
    this.reserveIntersections(seconds, reserveBraking, speedFactor);
    this.planMovement(seconds, acceleration, braking, reserveBraking, speedFactor);
    for (const motion of this.motions) {
      this.move(motion);
      if (motion.bikeShare) {
        const dockError = Math.min(
          ahead(motion.actor.distance, motion.bikeShare.dockDistance, motion.route.length),
          ahead(motion.bikeShare.dockDistance, motion.actor.distance, motion.route.length),
        );
        if (dockError < EPSILON && motion.advance > EPSILON &&
          motion.bikeShare.dockRemaining === 0 && motion.actor.state !== 'dwelling') {
          motion.bikeShare.dockRemaining = motion.bikeShare.dockDuration;
          motion.actor.speed = 0;
          motion.actor.state = 'dwelling';
        }
        motion.actor.sharedBike = this.sharedBikeState(motion);
      }
      this.updateIndicator(motion);
      if (motion.permit >= 0) {
        motion.releaseRemaining -= motion.advance;
        if (motion.releaseRemaining <= EPSILON) {
          this.junctions[motion.permit].owner = null;
          motion.permit = -1;
          motion.releaseRemaining = 0;
        }
      }
    }
    this.publishWalkSignals();
    this.pedestrians.step(seconds, this.signals);
  }

  /** Published after movement so walkers only ever see this tick's occupancy. */
  private publishWalkSignals(): void {
    for (let index = 0; index < this.junctions.length; index += 1) {
      const junction = this.junctions[index];
      if (junction.control === 'signal') {
        junction.walk = junction.phase === 'pedestrians';
        continue;
      }
      // Unsignalized: drivers hold at the bar for anyone in the crosswalk, and take the next turn.
      const occupied = this.pedestrians.isCrossingOccupied(index);
      if (occupied) junction.driverTurn = true;
      junction.walk = !occupied && junction.owner === null && !junction.driverTurn;
    }
  }

  private advanceSignals(dt: number): void {
    for (const [index, junction] of this.junctions.entries()) {
      if (junction.control !== 'signal') continue;
      junction.elapsed += dt;
      const green = junction.stage === 0 || junction.stage === 2;
      const duration = green ? TRAFFIC.greenSeconds : junction.stage === 4 ? TRAFFIC.pedestrianSeconds : TRAFFIC.clearanceSeconds;
      if (junction.elapsed + EPSILON < duration || (!green && junction.owner !== null)) continue;
      if (junction.phase === 'clearance' && this.pedestrians.isCrossingOccupied(index)) continue;
      junction.stage = (junction.stage + 1) % PHASES.length;
      junction.phase = PHASES[junction.stage];
      junction.elapsed = 0;
    }
  }

  private reserveIntersections(dt: number, reserveBraking: number, speedFactor: number): void {
    for (const motion of this.motions) {
      if (motion.permit >= 0) continue;
      const segment = motion.route.segments[motion.segment];
      if (segment.kind !== 'link') continue;
      const remaining = segment.start + segment.length - motion.actor.distance - motion.length / 2 - STOP_APPROACH_BUFFER;
      if (segment.intersection >= 0 && this.junctions[segment.intersection].control === 'all-way-stop') {
        // No rolling starts: the queue is joined only after halting at the bar.
        if (remaining > EPSILON || motion.actor.speed > EPSILON) {
          motion.stopHold = 0;
          continue;
        }
        motion.stopHold += dt;
        if (motion.stopHold + EPSILON >= TRAFFIC.stopSeconds && motion.requestSince < 0) motion.requestSince = this.elapsed;
        continue;
      }
      const requestDistance = motion.actor.speed ** 2 / (2 * reserveBraking) + motion.actor.speed * dt + 0.5;
      if (remaining <= requestDistance && motion.requestSince < 0) motion.requestSince = this.elapsed;
    }
    for (let index = 0; index < this.junctions.length; index += 1) {
      const junction = this.junctions[index];
      if (junction.owner) continue;
      const posted = junction.control === 'all-way-stop';
      if (posted ? this.pedestrians.isCrossingOccupied(index) :
        junction.phase === 'clearance' || junction.phase === 'pedestrians') continue;
      let chosen: Motion | null = null;
      for (const motion of this.motions) {
        if (motion.permit >= 0 || motion.requestSince < 0) continue;
        const segment = motion.route.segments[motion.segment];
        if (segment.intersection !== index || (!posted && segment.axis !== junction.phase)) continue;
        if (!this.exitAvailable(motion, reserveBraking, speedFactor)) continue;
        // Arrival order settles an all-way stop; a green phase still serves its own axis first.
        if (!chosen || motion.requestSince < chosen.requestSince) chosen = motion;
      }
      // The turn owed to drivers after a crossing expires once one is served, or none can be.
      if (posted) junction.driverTurn = false;
      if (!chosen) continue;
      const turn = chosen.route.segments[(chosen.segment + 1) % chosen.route.segments.length];
      junction.owner = chosen;
      chosen.permit = index;
      chosen.requestSince = -1;
      chosen.stopHold = 0;
      chosen.releaseRemaining = ahead(chosen.actor.distance, turn.start, chosen.route.length) +
        turn.length + chosen.length / 2 + TRAFFIC.stopBuffer;
    }
  }

  private exitAvailable(motion: Motion, reserveBraking: number, speedFactor: number): boolean {
    const route = motion.route;
    const incoming = route.segments[motion.segment];
    const outgoing = route.segments[(motion.segment + 2) % route.segments.length];
    // Reserve a body, a gap, and stopping room so the junction never becomes a queue.
    const exitSpeed = Math.max(motion.actor.speed, motion.desiredSpeed * speedFactor);
    const needed = motion.length / 2 + TRAFFIC.stopBuffer +
      exitSpeed ** 2 / (2 * reserveBraking) + exitSpeed * TRAFFIC.maxStep;
    for (const other of this.motions) {
      if (other === motion) continue;
      const segment = other.route.segments[other.segment];
      if (segment.kind !== 'link') continue;
      if (segment.lane === incoming.lane &&
        this.laneCoordinate(other.actor, segment) > this.laneCoordinate(motion.actor, incoming)) return false;
      if (segment.lane !== outgoing.lane) continue;
      const clearance = this.laneCoordinate(other.actor, segment) - this.laneCoordinateAt(outgoing, 0) -
        other.length / 2 - motion.length / 2 - this.gap(motion);
      if (clearance < needed) return false;
    }
    return true;
  }

  private gap(motion: Motion): number {
    return motion.bicycle ? TRAFFIC.bicycleGap : TRAFFIC.vehicleGap;
  }

  private laneCoordinate(actor: ActorState, segment: TrafficSegment): number {
    return actor.position.x * segment.dx + actor.position.z * segment.dz;
  }

  private laneCoordinateAt(segment: TrafficSegment, along: number): number {
    return (segment.x + segment.dx * along) * segment.dx + (segment.z + segment.dz * along) * segment.dz;
  }

  private pedestrianGateOpen(gate: Extract<SharedBikeGate, { type: 'pedestrian' }>): boolean {
    const crossingTime = gate.length / SHARED_BIKE_SPUR_SPEED;
    // Walkers have fixed paces and never accelerate; if the nearest walker is farther along its
    // lane than maxPace * crossingTime plus both bodies' safety headway, it cannot reach the
    // bicycle crossing before the rider has fully cleared the walking lanes.
    const clearance = PEDESTRIAN_MAX_PACE * crossingTime + PERSON_SPACE.headway * 2 +
      TRAFFIC_LENGTHS.bicycle + 12;
    const halfSpan = (gate.spanLength ?? gate.length) / 2 + PERSON_SPACE.width / 2;
    return this.pedestrians.actors.every((actor) => gate.horizontal
      ? Math.abs(actor.position.x - gate.crossingX) > halfSpan || Math.abs(actor.position.z - gate.crossingZ) >= clearance
      : Math.abs(actor.position.z - gate.crossingZ) > halfSpan || Math.abs(actor.position.x - gate.crossingX) >= clearance);
  }

  private mergeGateOpen(
    motion: Motion, gate: Extract<SharedBikeGate, { type: 'merge' }>, dt: number, reserveBraking: number, speedFactor: number,
  ): boolean {
    const ownStop = (motion.desiredSpeed * speedFactor) ** 2 / (2 * reserveBraking) + motion.desiredSpeed * speedFactor * dt;
    for (const other of this.motions) {
      if (other === motion) continue;
      const segment = other.route.segments[other.segment];
      if (segment.kind !== 'link' || segment.lane !== gate.targetLane) continue;
      const delta = this.laneCoordinate(other.actor, segment) - gate.targetCoord;
      const bodyClearance = Math.abs(delta) - other.length / 2 - motion.length / 2;
      if (delta >= 0 && bodyClearance < this.gap(motion) + ownStop + motion.length) return false;
      const otherStop = other.actor.speed ** 2 / (2 * reserveBraking) + other.actor.speed * dt;
      if (delta < 0 && bodyClearance < this.gap(other) + otherStop + other.actor.speed * 3 + motion.length) return false;
    }
    return true;
  }

  private roadwayGateOpen(gate: Extract<SharedBikeGate, { type: 'roadway' }>, reserveBraking: number, speedFactor: number): boolean {
    const crossingTime = gate.length / SHARED_BIKE_SPUR_SPEED;
    for (const other of this.motions) {
      if (other.bicycle) continue;
      const segment = other.route.segments[other.segment];
      if (segment.kind !== 'link' || segment.dx === 0 || Math.abs(other.actor.position.z - 95) > 4) continue;
      const approach = Math.abs(other.actor.position.x - gate.crossingX);
      const speed = Math.max(other.actor.speed, other.desiredSpeed * speedFactor);
      const needed = other.length / 2 + TRAFFIC_LENGTHS.bicycle / 2 + TRAFFIC.vehicleGap +
        speed * crossingTime + speed ** 2 / (2 * reserveBraking);
      if (approach < needed) return false;
    }
    return true;
  }

  private gatesOpen(motion: Motion, gates: readonly SharedBikeGate[], dt: number, reserveBraking: number, speedFactor: number): boolean {
    return gates.every((gate) => {
      if (gate.type === 'pedestrian') return this.pedestrianGateOpen(gate);
      if (gate.type === 'merge') return this.mergeGateOpen(motion, gate, dt, reserveBraking, speedFactor);
      return this.roadwayGateOpen(gate, reserveBraking, speedFactor);
    });
  }

  private gateAlong(segment: TrafficSegment, gate: SharedBikeGate): number {
    if (segment.kind !== 'link') return 0;
    if (gate.type === 'merge') return segment.length;
    const center = (gate.crossingX - segment.x) * segment.dx + (gate.crossingZ - segment.z) * segment.dz;
    const halfSpan = (gate.type === 'pedestrian' ? gate.spanLength ?? gate.length : gate.length) / 2;
    return Math.max(0, Math.min(segment.length, center - halfSpan));
  }

  private planMovement(dt: number, acceleration: number, braking: number, reserveBraking: number, speedFactor: number): void {
    for (const motion of this.motions) {
      const actor = motion.actor;
      const sharedBike = motion.bikeShare;
      if (sharedBike && sharedBike.dockRemaining > 0) {
        sharedBike.dockRemaining = Math.max(0, sharedBike.dockRemaining - dt);
        actor.speed = 0;
        motion.advance = 0;
        actor.state = 'dwelling';
        actor.sharedBike = this.sharedBikeState(motion);
        continue;
      }
      const segment = motion.route.segments[motion.segment];
      let available = motion.route.length;
      if (segment.kind === 'link') {
        const along = actor.distance - segment.start;
        const laneCoord = this.laneCoordinate(actor, segment);
        if (segment.intersection >= 0 && motion.permit !== segment.intersection) {
          available = Math.max(0, segment.length - along - motion.length / 2 - STOP_APPROACH_BUFFER);
        }
        for (const leader of this.motions) {
          if (leader === motion) continue;
          const leaderSegment = leader.route.segments[leader.segment];
          if (leaderSegment.kind !== 'link' || leaderSegment.lane !== segment.lane) continue;
          const difference = this.laneCoordinate(leader.actor, leaderSegment) - laneCoord;
          if (difference > 0) available = Math.min(available, Math.max(0, difference -
            (motion.length + leader.length) / 2 - this.gap(motion)));
        }
      }
      if (segment.gates?.length) {
        const along = actor.distance - segment.start;
        for (const gate of segment.gates) {
          const gateAlong = this.gateAlong(segment, gate);
          if (along <= gateAlong + EPSILON &&
            !this.gatesOpen(motion, [gate], dt, reserveBraking, speedFactor)) {
            available = Math.min(available, Math.max(0, gateAlong - along - motion.length / 2 - 0.2));
          }
        }
      }
      const nextSegment = motion.route.segments[(motion.segment + 1) % motion.route.segments.length];
      if (!segment.gates?.length && nextSegment.gates?.length) {
        const toGate = ahead(actor.distance, nextSegment.start, motion.route.length);
        if (toGate > EPSILON && toGate <= available &&
          !this.gatesOpen(motion, nextSegment.gates, dt, reserveBraking, speedFactor)) available = Math.min(available, toGate);
      }
      if (sharedBike) {
        const toDock = ahead(actor.distance, sharedBike.dockDistance, motion.route.length);
        if (toDock > EPSILON && toDock <= available) available = toDock;
      }
      const brakeTick = braking * dt;
      const reserveTick = reserveBraking * dt;
      const safeSpeed = Math.sqrt(reserveTick ** 2 + 2 * reserveBraking * available) - reserveTick;
      let desired = Math.min(motion.desiredSpeed * speedFactor, safeSpeed);
      if (motion.bicycle) {
        if (segment.speedLimit !== undefined) desired = Math.min(desired, segment.speedLimit);
        if (segment.kind === 'link') {
          const turn = motion.route.segments[(motion.segment + 1) % motion.route.segments.length];
          if (turn.speedLimit !== undefined) {
            const remaining = segment.start + segment.length - actor.distance;
            const turnApproach = Math.sqrt(reserveTick ** 2 + turn.speedLimit ** 2 + 2 * reserveBraking * remaining) - reserveTick;
            desired = Math.min(desired, turnApproach);
          }
        }
      }
      const previousSpeed = actor.speed;
      actor.speed = Math.max(0, Math.min(actor.speed + acceleration * dt, Math.max(actor.speed - brakeTick, desired)));
      motion.advance = Math.min(available, actor.speed * dt);
      if (available < EPSILON) {
        motion.advance = available;
        actor.speed = 0;
      }
      actor.state = motion.advance > EPSILON ? 'moving' : 'waiting';
      if (actor.lighting) actor.lighting.braking = previousSpeed - actor.speed > 0.2 * dt || actor.state === 'waiting';
      if (sharedBike) actor.sharedBike = this.sharedBikeState(motion);
    }
  }

  private updateIndicator(motion: Motion): void {
    if (!motion.actor.lighting) return;
    const segments = motion.route.segments;
    const current = segments[motion.segment];
    const junction = current.kind === 'junction' ? current : segments[(motion.segment + 1) % segments.length];
    const approaching = current.kind === 'junction' ||
      current.start + current.length - motion.actor.distance <= TRAFFIC.indicatorApproach;
    // Vehicles face +Z: a positive route cross product turns toward local -X (driver's right).
    motion.actor.lighting.turn = !approaching || junction.turn === 0 ? null : junction.turn > 0 ? 'right' : 'left';
  }

  private sharedBikeState(motion: Motion): BikeShareTripState {
    const trip = motion.bikeShare!;
    const actor = motion.actor;
    const dockError = Math.min(ahead(actor.distance, trip.dockDistance, motion.route.length),
      ahead(trip.dockDistance, actor.distance, motion.route.length));
    const docked = actor.state === 'dwelling' && dockError < EPSILON;
    let phase: BikeSharePhase = 'riding';
    if (docked) phase = trip.dockRemaining < 2 ? 'docked' : 'locking';
    else if (actor.distance >= trip.spurStart && actor.distance <= trip.spurEnd) {
      phase = actor.distance < trip.dockDistance ? 'pushing-in' : 'pushing-out';
    }
    return {
      stationId: trip.station.id,
      phase,
      x: actor.position.x,
      z: actor.position.z,
      heading: actor.heading,
      speed: actor.speed,
      distanceFromDock: ahead(trip.dockDistance, actor.distance, motion.route.length),
      docked,
      lockConfirmed: docked && trip.dockRemaining < trip.dockDuration - 2,
    };
  }

  private move(motion: Motion): void {
    const actor = motion.actor;
    actor.distance = wrap(actor.distance + motion.advance, motion.route.length);
    const segments = motion.route.segments;
    let index = motion.segment;
    if (actor.distance < segments[index].start) index = 0;
    while (index < segments.length - 1 && actor.distance >= segments[index + 1].start) index += 1;
    motion.segment = index;
    place(segments[index], actor.distance - segments[index].start, actor);
  }

}
