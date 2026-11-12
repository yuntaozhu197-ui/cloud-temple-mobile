import type { NpcResidentId } from "./npcResidents";

type ResidentPosition = { id: NpcResidentId; x: number; z: number };

/** A wider leaving radius keeps greetings steady while residents walk nearby. */
export function findNpcEncounter(
  residents: readonly ResidentPosition[],
  currentId: NpcResidentId | null,
  player: { x: number; z: number },
  reachable: (resident: ResidentPosition) => boolean,
): NpcResidentId | null {
  const current = residents.find(resident => resident.id === currentId);
  if (current && Math.hypot(current.x - player.x, current.z - player.z) <= 3.4 && reachable(current)) return current.id;
  let nearest: NpcResidentId | null = null;
  let distance = 2.5;
  for (const resident of residents) {
    const nextDistance = Math.hypot(resident.x - player.x, resident.z - player.z);
    if (nextDistance <= distance && reachable(resident)) {
      nearest = resident.id;
      distance = nextDistance;
    }
  }
  return nearest;
}
