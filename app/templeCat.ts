export const TEMPLE_CAT_TITLE = "寺猫偷走了住持的金铃";
export const CAT_HIDEOUTS = ["bamboo", "eaves", "stones"] as const;
export type CatHideout = typeof CAT_HIDEOUTS[number];
export type TempleCatEvent = "start" | "complete" | "share";

const DAY_MS = 86_400_000;
const BEIJING_OFFSET = 8 * 3_600_000;
const CAT_EPOCH = Date.UTC(2026, 0, 1) / DAY_MS;

export function templeCatDay(now = Date.now()) {
  return new Date(now + BEIJING_OFFSET).toISOString().slice(0, 10);
}

export function sharedTempleCatDay(search: string, now = Date.now()): string | null {
  const day = new URLSearchParams(search).get("cat");
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const midnight = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== day) return null;
  const age = Math.floor((now + BEIJING_OFFSET) / DAY_MS) - midnight / DAY_MS;
  return age >= 0 && age < 30 ? day : null;
}

export function templeCatHideout(day: string): CatHideout {
  const number = Date.parse(`${day}T00:00:00Z`) / DAY_MS;
  let seed = 0x4fb33727;
  let corner = 0;
  for (let index = CAT_EPOCH; index <= number; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    // One or two steps around the courtyard, so consecutive days differ.
    corner = (corner + 1 + (seed >>> 31)) % CAT_HIDEOUTS.length;
  }
  return CAT_HIDEOUTS[corner];
}

export function makeCatShareUrl(day: string) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("cat", day);
  return url.href;
}

export function createTempleCatReporter(playerId: string) {
  const accepted = new Set<string>();
  const pending = new Map<string, { day: string; event: TempleCatEvent }>();
  let queue = Promise.resolve();
  return (day: string, event: TempleCatEvent) => {
    const key = `${templeCatDay()}:${day}:${event}`;
    if (!accepted.has(key)) pending.set(key, { day, event });
    queue = queue.then(async () => {
      for (const [phaseKey, payload] of pending) {
        const response = await fetch("/api/cat-game", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
          headers: { "Content-Type": "application/json", "X-Temple-User": playerId },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(6000),
        });
        if (response.status >= 500 || response.status === 429) return;
        pending.delete(phaseKey);
        if (response.ok) accepted.add(phaseKey);
      }
    }).catch(() => { /* A lost connection must not interrupt the round. */ });
  };
}
