import { INTERSECTIONS, SIGNAL_POLE_OFFSET, STOP_LINE_OFFSET, STREET_X, STREET_Z } from './streets';

export const STREET_SIGN_VERSION = 'street-signs-001';

const AVENUE_NAMES = ['Lantern', 'Alder', 'Rainlight', 'Terrace', 'Foundry', 'Willow'] as const;
const CROSS_STREET_NAMES = ['Reed', 'Grove', 'Orchard', 'Juniper', 'Cinder', 'Harbor'] as const;

/** Original names label existing roads; they do not alter the traffic graph. */
export const NAMED_AVENUES = STREET_X.map((x, index) => ({
  id: `${AVENUE_NAMES[index].toLowerCase()}-avenue`, name: `${AVENUE_NAMES[index]} Av`, x,
}));
export const NAMED_CROSS_STREETS = STREET_Z.map((z, index) => ({
  id: `${CROSS_STREET_NAMES[index].toLowerCase()}-street`, name: `${CROSS_STREET_NAMES[index]} St`, z,
}));

/** First pass: park corners and eight approaches cover all twelve names within the scene budget. */
export const STREET_SIGN_POSTS = INTERSECTIONS
  .filter(({ x, z }) => {
    const parkAvenue = x === STREET_X[2] || x === STREET_X[3];
    const parkCrossStreet = z === STREET_Z[2] || z === STREET_Z[3];
    if (parkAvenue && parkCrossStreet) return true;
    if (!parkAvenue && parkCrossStreet) return z === (x < 0 ? STREET_Z[2] : STREET_Z[3]);
    return parkAvenue && !parkCrossStreet && x === (z < 0 ? STREET_X[3] : STREET_X[2]);
  })
  .map((intersection) => {
    const avenue = NAMED_AVENUES.find(({ x }) => x === intersection.x);
    const crossStreet = NAMED_CROSS_STREETS.find(({ z }) => z === intersection.z);
    if (!avenue || !crossStreet) throw new Error(`Missing street names for ${intersection.id}.`);
    // Use an existing signal pole, choosing its opposite approach at the south map edge.
    const side = intersection.z === STREET_Z[STREET_Z.length - 1] ? -1 : 1;
    return {
      id: `${intersection.id}-street-signs`,
      intersectionId: intersection.id,
      x: intersection.x + side * SIGNAL_POLE_OFFSET,
      z: intersection.z + side * (STOP_LINE_OFFSET + 0.5),
      side,
      avenue,
      crossStreet,
    };
  });
