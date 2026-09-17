import type * as THREE from 'three';
import { CIVIC_UTILITIES, MAINTENANCE_STRIPS, STEAM_PILOT, STREET_DRAINS } from '../content/civicUtilities';
import { METRO_ENTRANCES, METRO_GEOMETRY, metroStationFor } from '../content/metro';
import { LOADING_CURB_MARKER, type StreetProp } from '../content/streetFurniture';
import { BUS_STOP_MARKER } from '../content/transitService';
import { buildSignLettering } from './signLettering';
import type { StreetscapeBuilder } from './streetscape';
import type { WeatherSurface } from './weatherSurface';

/** Uses the existing box batch for each stroke, then immediately releases the source lettering. */
function signText(builder: StreetscapeBuilder, prop: StreetProp, text: string, y: number, width: number, height: number) {
  const geometry = buildSignLettering(text, width, height);
  const points = geometry.getAttribute('position');
  for (let index = 0; index < points.count; index += 4) {
    const ax = (points.getX(index) + points.getX(index + 3)) / 2;
    const ay = (points.getY(index) + points.getY(index + 3)) / 2;
    const bx = (points.getX(index + 1) + points.getX(index + 2)) / 2;
    const by = (points.getY(index + 1) + points.getY(index + 2)) / 2;
    const thickness = Math.hypot(points.getX(index) - points.getX(index + 3), points.getY(index) - points.getY(index + 3));
    const x = (ax + bx) / 2;
    builder.add(builder.box, builder.palette.line,
      [prop.x + Math.cos(prop.yaw) * x, y + (ay + by) / 2, prop.z - Math.sin(prop.yaw) * x],
      [Math.hypot(bx - ax, by - ay), thickness, 0.008], [0, prop.yaw, Math.atan2(by - ay, bx - ax)]);
  }
  geometry.dispose();
}

/** Fits on the existing rail head: repeated letter markers group mouths without real route bullets. */
export function buildMetroWayfinding(builder: StreetscapeBuilder): void {
  for (const entrance of METRO_ENTRANCES) {
    const g = METRO_GEOMETRY;
    const forward = g.openingDepth / 2 + 0.1;
    const prop = {
      ...entrance,
      x: entrance.x + Math.sin(entrance.yaw) * forward,
      z: entrance.z + Math.cos(entrance.yaw) * forward,
    };
    const y = g.surfaceY + g.signHeight + 0.48;
    builder.block(builder.palette.roof, prop.x, y, prop.z, 1.54, 0.47, 0.06, prop.yaw);
    signText(builder, { ...prop, x: prop.x + Math.sin(prop.yaw) * 0.035, z: prop.z + Math.cos(prop.yaw) * 0.035 },
      `${metroStationFor(entrance.id).marker} SCENIC`, y, 1.4, 0.19);
  }
}

/** Replaces the former two solid tree-pit slabs without moving trunks or changing canopy counts. */
export function buildStreetTreeBed(builder: StreetscapeBuilder, x: number, z: number): void {
  const { block, palette: p } = builder;
  const planted = Math.abs(Math.round(x * 10 + z * 7)) % 3 === 0;
  block(p.stone, x, -0.035, z, 1.45, 0.09, 1.45);
  block(planted ? p.wood : p.roof, x, 0.016, z, 1.2, 0.012, 1.2);
  if (planted) for (const side of [-1, 1]) {
    // Reuse the tinted box batch rather than allocating a new leaf/box submission.
    block(p.facade, x + side * 0.42, 0.035, z, 0.16, 0.026, 0.9, 0, '#70866a');
  }
}

/** Two capped wall outlets and a closed-lid bin, mounted only on an owner-selected service facade. */
export function buildBuildingServiceConnection(builder: StreetscapeBuilder, prop: StreetProp): void {
  const { palette: p } = builder;
  const local = (dx: number, y: number, dz: number, w: number, h: number, d: number, material: THREE.Material) =>
    builder.block(material, prop.x + Math.cos(prop.yaw) * dx + Math.sin(prop.yaw) * dz, y,
      prop.z - Math.sin(prop.yaw) * dx + Math.cos(prop.yaw) * dz, w, h, d, prop.yaw);
  local(0, 1.13, 0.04, 0.5, 0.2, 0.08, p.stone);
  for (const side of [-1, 1]) {
    local(side * 0.16, 1.13, 0.11, 0.09, 0.1, 0.12, p.copperEdge);
    local(side * 0.16, 1.13, 0.18, 0.14, 0.14, 0.045, p.clay);
  }
  local(0, 0.31, 0.22, 0.56, 0.76, 0.4, p.roof);
  local(0, 0.71, 0.22, 0.62, 0.07, 0.44, p.teal);
  local(0, 0.766, 0.34, 0.18, 0.042, 0.035, p.roof);
}

/** An original bus pictogram marks an in-lane dwell, not a boarding path across the protected track. */
export function buildBusStopMarker(builder: StreetscapeBuilder): void {
  const { x, z } = BUS_STOP_MARKER;
  const { palette: p } = builder;
  builder.add(builder.cylinder, p.stone, [x, 1.27, z], [0.045, 2.7, 0.045]);
  const piece = (material: THREE.Material, dx: number, y: number, forward: number, w: number, h: number, d: number) =>
    builder.block(material, x + forward, y, z - dx, w, h, d, Math.PI / 2);
  piece(p.cream, 0, 2.4, 0, 0.64, 0.72, 0.055);
  for (const face of [-1, 1]) {
    piece(p.teal, 0, 2.43, face * 0.038, 0.39, 0.4, 0.014);
    piece(p.cream, 0, 2.5, face * 0.048, 0.29, 0.16, 0.009);
    piece(p.teal, 0, 2.5, face * 0.054, 0.018, 0.16, 0.006);
    for (const side of [-1, 1]) {
      piece(p.cream, side * 0.13, 2.3, face * 0.048, 0.04, 0.04, 0.009);
      piece(p.teal, side * 0.13, 2.205, face * 0.038, 0.065, 0.06, 0.014);
    }
  }
}

/** A restrained van pictogram identifies the authored service curb, without real parking permissions. */
export function buildLoadingCurbMarker(builder: StreetscapeBuilder): void {
  const { x, z } = LOADING_CURB_MARKER;
  const { palette: p } = builder;
  builder.add(builder.cylinder, p.stone, [x, 1.22, z], [0.04, 2.6, 0.04]);
  builder.block(p.cream, x, 2.3, z, 0.62, 0.52, 0.055);
  for (const face of [-1, 1]) {
    builder.block(p.teal, x - face * 0.08, 2.33, z + face * 0.038, 0.28, 0.2, 0.014);
    builder.block(p.teal, x + face * 0.15, 2.3, z + face * 0.038, 0.14, 0.14, 0.014);
    builder.block(p.cream, x + face * 0.15, 2.325, z + face * 0.048, 0.075, 0.06, 0.009);
    for (const side of [-1, 1]) {
      builder.block(p.teal, x + side * 0.135, 2.2, z + face * 0.038, 0.07, 0.055, 0.014);
    }
  }
}

/** No resources owned here: original utilities join existing geometry/material combinations. */
export function buildCivicUtilities(builder: StreetscapeBuilder): void {
  const { block, add, cylinder, palette: p } = builder;
  for (const prop of CIVIC_UTILITIES) {
    const { x, z, surfaceY: ground } = prop;
    const padBottom = prop.kind === 'hydrant' ? -0.015 : ground - 0.06;
    block(p.paving, x, (ground + padBottom) / 2, z, prop.width + 0.06, ground - padBottom, prop.depth + 0.06);
    if (prop.kind === 'service-cover') {
      block(p.roof, x, ground - 0.002, z, prop.width, 0.006, prop.depth);
      for (const side of [-1, 1]) block(p.stone, x, ground + 0.0015, z + side * 0.24, 0.17, 0.001, 0.028);
    } else if (prop.kind === 'hydrant') {
      add(cylinder, p.roof, [x, ground + 0.045, z], [0.27, 0.09, 0.27]);
      add(cylinder, p.copperEdge, [x, ground + 0.4, z], [0.17, 0.67, 0.17]);
      add(cylinder, p.stone, [x, ground + 0.78, z], [0.22, 0.13, 0.22]);
      block(p.roof, x, ground + 0.88, z, 0.07, 0.07, 0.07);
      add(cylinder, p.copperEdge, [x, ground + 0.55, z], [0.11, 0.61, 0.11], [Math.PI / 2, 0, 0]);
      for (const side of [-1, 1]) block(p.stone, x, ground + 0.55, z + side * 0.29, 0.19, 0.19, 0.055);
    } else if (prop.kind === 'litter-basket') {
      add(cylinder, p.roof, [x, ground + 0.32, z], [0.235, 0.58, 0.235]);
      for (const y of [0.04, 0.66]) add(cylinder, p.copperEdge, [x, ground + y, z], [0.3, 0.055, 0.3]);
      for (let slat = 0; slat < 8; slat++) {
        const angle = slat * Math.PI / 4;
        block(p.teal, x + Math.cos(angle) * 0.275, ground + 0.34, z + Math.sin(angle) * 0.275,
          0.055, 0.59, 0.055);
      }
    }
  }
  for (const drain of STREET_DRAINS) {
    const { x, z, width, depth } = drain;
    block(p.roof, x, drain.recessY - 0.015, z, width, 0.03, depth);
    for (const side of [-1, 1]) {
      block(p.roof, x + side * (width / 2 - 0.025), drain.grateTopY - 0.009, z, 0.05, 0.018, depth);
      block(p.roof, x, drain.grateTopY - 0.009, z + side * (depth / 2 - 0.025), width, 0.018, 0.05);
    }
    for (let bar = 0; bar < 9; bar++) {
      block(p.roof, x - 0.48 + bar * 0.12, drain.grateTopY - 0.009, z, 0.04, 0.018, depth - 0.06);
    }
    block(p.rubber, x, 0.02, drain.curbZ - 0.055, width, 0.08, 0.04);
  }
  const stack = STEAM_PILOT;
  block(p.paving, stack.x, stack.surfaceY - 0.03, stack.z, stack.width + 0.04, 0.06, stack.depth + 0.04);
  block(p.roof, stack.x, stack.surfaceY + 0.06, stack.z, stack.width, 0.12, stack.depth);
  for (let band = 0; band < 5; band++) {
    add(cylinder, band % 2 ? p.cream : p.clay,
      [stack.x, stack.surfaceY + 0.12 + (band + 0.5) * (stack.height - 0.12) / 5, stack.z],
      [stack.stackRadius, (stack.height - 0.12) / 5, stack.stackRadius]);
  }
  add(cylinder, p.roof, [stack.x, stack.outletY + 0.001, stack.z], [stack.stackRadius * 0.84, 0.008, stack.stackRadius * 0.84]);
  buildMetroWayfinding(builder);
  buildBusStopMarker(builder);
  buildLoadingCurbMarker(builder);
}

/** Local maintenance plus conservative sub-cell stack capture; never lower an existing upper envelope. */
export function applyCivicMaintenanceCapture(surface: WeatherSurface): void {
  const resolution = Math.round(Math.sqrt(surface.retention.length));
  const extent = resolution * surface.cellSize / 2;
  const cell = (value: number) => Math.max(0, Math.min(resolution - 1, Math.floor((value + extent) / surface.cellSize)));
  for (const strip of MAINTENANCE_STRIPS) {
    for (let row = cell(strip.minZ); row <= cell(strip.maxZ); row++) {
      for (let column = cell(strip.minX); column <= cell(strip.maxX); column++) {
        const index = row * resolution + column;
        const x = (column + 0.5) * surface.cellSize - extent;
        const z = (row + 0.5) * surface.cellSize - extent;
        if (x < strip.minX || x > strip.maxX || z < strip.minZ || z > strip.maxZ ||
          Math.abs(surface.heights[index] - strip.surfaceY) > 0.045) continue;
        surface.retention[index] = Math.min(surface.retention[index], strip.snowRetention);
      }
    }
    // A 0.48 m tube can miss every center of the 0.5 m capture grid. Cover its touched cells,
    // rather than letting precipitation fall through it; this retains the grid's coarse envelope.
    const stack = STEAM_PILOT;
    for (let row = cell(stack.z - stack.stackRadius); row <= cell(stack.z + stack.stackRadius); row++) {
      for (let column = cell(stack.x - stack.stackRadius); column <= cell(stack.x + stack.stackRadius); column++) {
        const index = row * resolution + column;
        if (surface.heights[index] >= stack.topY) continue;
        surface.heights[index] = stack.topY;
        surface.retention[index] = 1;
      }
    }
  }
}
