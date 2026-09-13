export const BASKETBALL_COURT = {
  x: -61, z: 119, width: 14, depth: 7.5, surfaceY: 0.04,
  hoopOffset: 5.8, hoopHeight: 2.5, ballRadius: 0.12,
} as const;

export const PICKLEBALL_COURT = {
  x: -61, z: 108.5, width: 6.7, depth: 3.05, surfaceY: 0.04,
  kitchenDepth: 1.065, netHeight: 0.91, ballRadius: 0.07,
} as const;

export const COURT_PLAYERS = [
  { id: 'court-shooter', sport: 'basketball', x: BASKETBALL_COURT.width / 14, z: 0, heading: Math.PI / 2 },
  { id: 'court-rebounder', sport: 'basketball', x: BASKETBALL_COURT.width / 4, z: BASKETBALL_COURT.depth * 0.24, heading: -Math.PI / 2 },
  { id: 'court-defender', sport: 'basketball', x: -BASKETBALL_COURT.width / 28, z: -BASKETBALL_COURT.depth * 0.24, heading: -Math.PI / 2 },
  { id: 'court-passer', sport: 'basketball', x: -3, z: 0, heading: Math.PI / 2 },
  { id: 'pickleball-west', sport: 'pickleball', x: -PICKLEBALL_COURT.width * 0.32, z: -PICKLEBALL_COURT.depth * 0.115, heading: Math.PI / 2 },
  { id: 'pickleball-east', sport: 'pickleball', x: PICKLEBALL_COURT.width * 0.32, z: PICKLEBALL_COURT.depth * 0.115, heading: -Math.PI / 2 },
] as const;
