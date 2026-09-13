export const BASKETBALL_COURT = {
  x: -61, z: 119, width: 12, depth: 8, surfaceY: 0.04,
  hoopOffset: 4.9, hoopHeight: 2.5, ballRadius: 0.12,
} as const;

export const PICKLEBALL_COURT = {
  x: -61, z: 108.5, width: 13.4, depth: 6.1, surfaceY: 0.04,
  kitchenDepth: 2.13, netHeight: 0.91, ballRadius: 0.07,
} as const;

export const COURT_PLAYERS = [
  { id: 'court-shooter', sport: 'basketball', x: 1.3, z: 0, heading: Math.PI / 2 },
  { id: 'court-rebounder', sport: 'basketball', x: 3, z: 1.6, heading: Math.PI / 2 },
  { id: 'court-defender', sport: 'basketball', x: -0.3, z: -1.5, heading: Math.PI / 2 },
  { id: 'court-passer', sport: 'basketball', x: -3, z: 0, heading: Math.PI / 2 },
  { id: 'pickleball-west', sport: 'pickleball', x: -4.65, z: 0, heading: Math.PI / 2 },
  { id: 'pickleball-east', sport: 'pickleball', x: 4.65, z: 0, heading: -Math.PI / 2 },
] as const;
