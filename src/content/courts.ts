/** Full 94 x 50 ft court; NBA Rule 1 dimensions, rendered with original unbranded geometry. */
export const BASKETBALL_COURT = {
  x: -18, z: 113.5, width: 28.6512, depth: 15.24, surfaceY: 0.04,
  runoff: 2, runoffWidth: 32.6512, runoffDepth: 19.24,
  hoopOffset: 12.7254, hoopHeight: 3.048, rimRadius: 0.2286,
  backboardOffset: 13.1064, backboardWidth: 1.8288, backboardHeight: 1.0668,
  backboardBottom: 2.7432, supportOffset: 16.6756,
  lineWidth: 0.0508, keyWidth: 4.8768, freeThrowOffset: 8.5344,
  centerCircleRadius: 1.8288, threePointRadius: 7.239, cornerLineOffset: 6.7056,
  restrictedRadius: 1.2192, ballRadius: 0.12,
} as const;

/** 44 x 20 ft play lines inside a 60 x 30 ft minimum playing surface; USA Pickleball dimensions. */
export const PICKLEBALL_COURT = {
  x: 15, z: 113.5, width: 13.4112, depth: 6.096, surfaceY: 0.04,
  runoffWidth: 18.288, runoffDepth: 9.144,
  kitchenDepth: 2.1336, netHeight: 0.9144, netCenterHeight: 0.8636,
  netSpan: 6.7056, netPostRadius: 0.03175, netPostOffset: 3.38455,
  lineWidth: 0.0508, ballRadius: 0.037,
} as const;

/** Net-top height above the playing surface, with a shallow symmetric sag and level side extensions. */
export function netHeightAt(zOffset: number): number {
  const fraction = Math.min(1, Math.abs(zOffset) / (PICKLEBALL_COURT.depth / 2));
  return PICKLEBALL_COURT.netCenterHeight +
    (PICKLEBALL_COURT.netHeight - PICKLEBALL_COURT.netCenterHeight) * fraction * fraction;
}

/** Existing south-of-park parcel; neither the street grid nor the park moves. */
export const RECREATION_AREA = {
  minX: -39, maxX: 39, minZ: 102, maxZ: 125,
  passageMinX: -0.9, passageMaxX: 1.1,
} as const;

export const COURT_PLAYERS = [
  { id: 'court-shooter', sport: 'basketball', x: BASKETBALL_COURT.width / 14, z: 0, heading: Math.PI / 2 },
  { id: 'court-rebounder', sport: 'basketball', x: BASKETBALL_COURT.width / 4, z: BASKETBALL_COURT.depth * 0.24, heading: -Math.PI / 2 },
  { id: 'court-defender', sport: 'basketball', x: -BASKETBALL_COURT.width / 28, z: -BASKETBALL_COURT.depth * 0.24, heading: -Math.PI / 2 },
  { id: 'court-passer', sport: 'basketball', x: -3, z: 0, heading: Math.PI / 2 },
  { id: 'pickleball-west', sport: 'pickleball', x: -PICKLEBALL_COURT.width * 0.32, z: -PICKLEBALL_COURT.depth * 0.115, heading: Math.PI / 2 },
  { id: 'pickleball-east', sport: 'pickleball', x: PICKLEBALL_COURT.width * 0.32, z: PICKLEBALL_COURT.depth * 0.115, heading: -Math.PI / 2 },
] as const;
