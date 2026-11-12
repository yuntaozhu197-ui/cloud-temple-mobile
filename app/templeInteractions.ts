/** Walking destinations and animation contact phases share one timing definition. */
export const TEMPLE_INTERACTIONS = {
  flower: { x: -2.8, z: -16.15, heading: Math.PI, pose: "offerFlower", duration: 6, impacts: [.78] },
  ritual: { x: 42, z: -12, heading: Math.PI, pose: "ritual", duration: 8, impacts: [.25] },
  drum: { x: 20, z: -30.48, heading: Math.PI, pose: "drum", duration: 3.6, impacts: [.18, .36, .54, .72] },
  towerBell: { x: 44, z: -29.8, heading: Math.PI, pose: "towerBell", duration: 4, impacts: [.44] },
  bell: { x: 18, z: 1.5, heading: Math.PI, pose: "bell", duration: 3, impacts: [.4] },
  lamp: { x: 8.8, z: -15.5, heading: Math.PI, pose: "lotusLamp", duration: 5, impacts: [.72] },
  pagoda: { x: -43, z: 21, heading: Math.PI, pose: "pagoda", duration: 5, impacts: [.3] },
  mural: { x: -10.4, z: -10, heading: -Math.PI / 2, pose: "mural", duration: 5, impacts: [.3] },
  sutra: { x: -30, z: -13.5, heading: Math.PI, pose: "sutra", duration: 8, impacts: [.3] },
  breathe: { x: 30, z: -16, heading: 0, pose: "breathe", duration: 8, impacts: [.3] },
} as const;

export type TempleInteractionKind = keyof typeof TEMPLE_INTERACTIONS;

export function isTempleInteraction(kind: string): kind is TempleInteractionKind {
  return Object.hasOwn(TEMPLE_INTERACTIONS, kind);
}
