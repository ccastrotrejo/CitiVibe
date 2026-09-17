export interface TrafficServiceDefinition {
  id: string;
  actorId: string;
  kind: 'bus-stop' | 'loading';
  lane: string;
  x: number;
  z: number;
  dwellSeconds: number;
  maneuverLength: number;
  lateralOffset: number;
}

export interface TrafficServiceState {
  id: string;
  actorId: string;
  phase: 'circulating' | 'approaching' | 'dwelling' | 'departing';
  remaining: number;
  completedCycles: number;
}

/**
 * DOT bus-stop/curb-management guidance informs these original compressed locations.
 * The bus holds its lane: crossing the protected track is not a boarding arrangement.
 * The van's dedicated non-cycling curb pocket is kept clear of all twelve parked cars.
 */
export const BUS_STOP: TrafficServiceDefinition = {
  id: 'rainlight-bus-stop', actorId: 'city-vehicle-6', kind: 'bus-stop',
  lane: '14>20:1.6', x: -47.6, z: -35, dwellSeconds: 5,
  maneuverLength: 10, lateralOffset: 0,
};

export const LOADING_STOP: TrafficServiceDefinition = {
  id: 'juniper-loading', actorId: 'city-vehicle-47', kind: 'loading',
  lane: '20>21:1.6', x: 30, z: 98.5, dwellSeconds: 16,
  maneuverLength: 5, lateralOffset: 1.9,
};

export const BUS_STOP_MARKER = { x: -51.22, z: -33.4 } as const;
export const TRAFFIC_SERVICES: readonly TrafficServiceDefinition[] = [BUS_STOP, LOADING_STOP];
