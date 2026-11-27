import type * as THREE from 'three';
import { CIVIC_UTILITIES, MAINTENANCE_STRIPS, STEAM_STACKS, STREET_DRAINS } from '../content/civicUtilities';
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

/** Beveled granite curb edging with a recessed bed and raised mulched soil ring around street trees. */
export function buildStreetTreeBed(builder: StreetscapeBuilder, x: number, z: number): void {
  const { add, block, cylinder, palette: p } = builder;
  const rbox = builder.roundedBox ?? builder.box;
  const planted = Math.abs(Math.round(x * 10 + z * 7)) % 3 === 0;
  // Beveled outer granite/stone curb collar and stepped inner coping lip.
  add(rbox, p.stone, [x, -0.028, z], [1.48, 0.076, 1.48]);
  add(rbox, p.paving, [x, 0.014, z], [1.38, 0.008, 1.38]);
  // Recessed pit bed plus concentric mulched soil berm ring around the trunk.
  block(planted ? p.wood : p.roof, x, 0.023, z, 1.18, 0.008, 1.18);
  add(cylinder, p.wood, [x, 0.032, z], [0.5, 0.008, 0.5]);
  add(cylinder, p.roof, [x, 0.039, z], [0.26, 0.006, 0.26]);
  if (planted) for (const side of [-1, 1]) {
    // Reuse the tinted box batch for low street-bed groundcover while keeping max.y < 0.05.
    block(p.facade, x + side * 0.43, 0.037, z, 0.16, 0.022, 0.88, 0, '#70866a');
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
  const rbox = builder.roundedBox ?? builder.box;
  const cone = builder.cone ?? cylinder;
  const alloy = builder.alloy ?? p.stone;
  for (const prop of CIVIC_UTILITIES) {
    const { x, z, surfaceY: ground } = prop;
    const padBottom = prop.kind === 'hydrant' ? -0.015 : ground - 0.06;
    const padTop = prop.kind === 'service-cover' ? ground - 0.0045 : ground;
    block(p.paving, x, (padTop + padBottom) / 2, z, prop.width + 0.06, padTop - padBottom, prop.depth + 0.06);
    if (prop.kind === 'service-cover') {
      const rOuter = Math.min(prop.width, prop.depth) * 0.44;
      add(rbox, p.roof, [x, ground - 0.0032, z], [prop.width, 0.0016, prop.depth]);
      add(cylinder, alloy, [x, ground - 0.0016, z], [rOuter, 0.0012, rOuter]);
      add(cylinder, p.rubber, [x, ground - 0.0001, z], [rOuter * 0.84, 0.0012, rOuter * 0.84]);
      add(cylinder, p.roof, [x, ground + 0.0012, z], [rOuter * 0.56, 0.001, rOuter * 0.56]);
      add(cylinder, alloy, [x, ground + 0.0023, z], [rOuter * 0.24, 0.0008, rOuter * 0.24]);
    } else if (prop.kind === 'hydrant') {
      const nearestRoadZ = Math.abs(z) < 47.5 ? 0 : Math.sign(z) * 95;
      const streetDir = nearestRoadZ > z ? 1 : -1;
      // Flanged cast-iron shoe ring & stepped bell collar.
      add(cylinder, p.roof, [x, ground + 0.032, z], [0.265, 0.064, 0.265]);
      add(cylinder, p.copperEdge, [x, ground + 0.088, z], [0.215, 0.048, 0.215]);
      // Multi-tier cast-iron standpipe barrel with mid-barrel flange joint.
      add(cylinder, p.roof, [x, ground + 0.255, z], [0.165, 0.285, 0.165]);
      add(cylinder, p.copperEdge, [x, ground + 0.415, z], [0.205, 0.038, 0.205]);
      add(cylinder, p.roof, [x, ground + 0.565, z], [0.185, 0.26, 0.185]);
      // Domed alloy bonnet & top pentagon operating nut.
      add(rbox, alloy, [x, ground + 0.738, z], [0.28, 0.074, 0.28]);
      add(cone, alloy, [x, ground + 0.824, z], [0.195, 0.1, 0.195]);
      add(rbox, alloy, [x, ground + 0.902, z], [0.072, 0.052, 0.072], [0, 0.63, 0]);
      // Two side 2.5" hose nozzle caps + front 4.5" street-facing steamer nozzle.
      add(cylinder, p.roof, [x, ground + 0.565, z], [0.08, 0.48, 0.08], [0, 0, Math.PI / 2]);
      for (const side of [-1, 1]) {
        add(cylinder, alloy, [x + side * 0.262, ground + 0.565, z], [0.095, 0.05, 0.095], [0, 0, Math.PI / 2]);
      }
      add(cylinder, p.copperEdge, [x, ground + 0.545, z + streetDir * 0.205], [0.122, 0.064, 0.122], [Math.PI / 2, 0, 0]);
      add(cylinder, alloy, [x, ground + 0.545, z + streetDir * 0.252], [0.14, 0.04, 0.14], [Math.PI / 2, 0, 0]);
      add(rbox, alloy, [x, ground + 0.545, z + streetDir * 0.282], [0.062, 0.062, 0.024]);
    } else if (prop.kind === 'litter-basket') {
      // Cylindrical NYC wire-mesh / ribbed waste basket with recessed dark liner & alloy rim collar.
      add(cylinder, p.roof, [x, ground + 0.032, z], [0.255, 0.064, 0.255]);
      add(cylinder, alloy, [x, ground + 0.076, z], [0.27, 0.024, 0.27]);
      add(cylinder, p.rubber, [x, ground + 0.38, z], [0.232, 0.6, 0.232]);
      add(cylinder, p.teal, [x, ground + 0.43, z], [0.278, 0.095, 0.278]);
      add(cylinder, p.roof, [x, ground + 0.7, z], [0.294, 0.042, 0.294]);
      add(cylinder, alloy, [x, ground + 0.732, z], [0.304, 0.022, 0.304]);
      for (let rib = 0; rib < 8; rib++) {
        const angle = rib * Math.PI / 4;
        add(builder.box, alloy,
          [x + Math.cos(angle) * 0.274, ground + 0.39, z + Math.sin(angle) * 0.274],
          [0.02, 0.62, 0.024],
          [-Math.sin(angle) * 0.035, -angle, Math.cos(angle) * 0.035]);
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
    block(p.rubber, x, 0.02, drain.curbZ + drain.curbSide * 0.055, width, 0.08, 0.04);
  }
  for (const stack of STEAM_STACKS) {
    block(p.paving, stack.x, stack.surfaceY - 0.03, stack.z, stack.width + 0.04, 0.06, stack.depth + 0.04);
    block(p.roof, stack.x, stack.surfaceY + 0.06, stack.z, stack.width, 0.12, stack.depth);
    for (let band = 0; band < 5; band++) {
      add(cylinder, band % 2 ? p.cream : p.clay,
        [stack.x, stack.surfaceY + 0.12 + (band + 0.5) * (stack.height - 0.12) / 5, stack.z],
        [stack.stackRadius, (stack.height - 0.12) / 5, stack.stackRadius]);
    }
    add(cylinder, p.roof, [stack.x, stack.outletY + 0.001, stack.z], [stack.stackRadius * 0.84, 0.008, stack.stackRadius * 0.84]);
  }
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
  }
  // A 0.48 m tube can miss every center of the 0.5 m capture grid. Cover its touched cells,
  // rather than letting precipitation fall through it; this retains the grid's coarse envelope.
  for (const stack of STEAM_STACKS) {
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
