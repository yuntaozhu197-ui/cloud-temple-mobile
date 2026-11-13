import { TEMPLE_LAYOUT } from "./templeLayout";

export type TempleLesson = {
  id: string;
  kind: "morning" | "evening";
  label: "早课念经5分钟" | "晚课念经5分钟";
  start: number;
  end: number;
  remainingSeconds: number;
};

export type TempleSchedule = {
  lesson: TempleLesson | null;
  bellSlot: { id: string; at: number } | null;
};

const BEIJING_OFFSET = 8 * 60 * 60 * 1000;
const BELL_INTERVAL_MINUTES = 5;
export const TEMPLE_LESSON_DURATION_MS = 5 * 60 * 1000;

/** Beijing time is UTC+8, independent of the visitor's device timezone. */
export function getTempleSchedule(timestamp = Date.now()): TempleSchedule {
  const local = new Date(timestamp + BEIJING_OFFSET);
  if (!Number.isFinite(timestamp) || !Number.isFinite(local.getTime())) return { lesson: null, bellSlot: null };
  const hour = local.getUTCHours();
  const minute = local.getUTCMinutes();
  const midnight = timestamp - ((hour * 60 + minute) * 60 + local.getUTCSeconds()) * 1000 - local.getUTCMilliseconds();
  const date = local.toISOString().slice(0, 10);
  const slotMinutes = Math.floor((hour * 60 + minute) / BELL_INTERVAL_MINUTES) * BELL_INTERVAL_MINUTES;
  const bellSlot = { id: `${date}-${slotMinutes}`, at: midnight + slotMinutes * 60 * 1000 };
  const kind = hour === 6 ? "morning" : hour === 21 ? "evening" : null;
  if (!kind || minute >= TEMPLE_LESSON_DURATION_MS / 60_000) return { lesson: null, bellSlot };
  const start = midnight + hour * 60 * 60 * 1000;
  const end = start + TEMPLE_LESSON_DURATION_MS;
  return {
    bellSlot,
    lesson: {
      id: `${date}-${kind}`, kind,
      label: kind === "morning" ? "早课念经5分钟" : "晚课念经5分钟",
      start, end, remainingSeconds: Math.ceil((end - timestamp) / 1000),
    },
  };
}

/** These are the walkable interiors of the three halls that carry background music. */
export function isTemplePrayerHall(position: { x: number; z: number }) {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
  return (position.x > -12.6 && position.x < 12.6 && position.z > -21.6 && position.z < -2.2) ||
    [TEMPLE_LAYOUT.guanyin, TEMPLE_LAYOUT.wenshu].some(hall => Math.abs(position.x - hall.x) < 5.2 && Math.abs(position.z - hall.z) < 4.7);
}

