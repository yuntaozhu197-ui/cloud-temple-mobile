export const TEMPLE_CAT_TITLE = "寺猫偷走了住持的金铃";
export const CAT_HIDEOUTS = ["bamboo", "eaves", "stones", "pond", "library", "martial"] as const;
export type CatHideout = typeof CAT_HIDEOUTS[number];
export type TempleCatEvent = "start" | "complete" | "share";

export const CAT_SEARCH_RADIUS = 2.2;

export const TEMPLE_CAT_PLACES = {
  bamboo: { x: -8.5, z: 0.9, label: "竹林小径", clue: "风一停，细长的叶子还在摇。", direction: "从庭院往西，找竹林朝庭院的一侧。" },
  eaves: { x: 18, z: 2.5, label: "钟亭檐下", clue: "明明没人敲钟，屋檐下却响了一声铃。", direction: "往庭院东面走，看看钟亭临花园的一侧。" },
  stones: { x: -43, z: 21, label: "塔林石径", clue: "石塔一座挨一座，地上落了几片松针。", direction: "去寺院西南的少林塔林，沿石径走到塔前空地。" },
  pond: { x: -31.4, z: 12.8, label: "放生池西岸", clue: "一串脚印沾了水，旁边的鱼群刚刚散开。", direction: "去放生池，沿岸走到远离庭院的西侧。" },
  library: { x: 12.5, z: -29.3, label: "藏经阁东侧小径", clue: "经书的纸香从大殿后方飘来。", direction: "绕到大雄宝殿后面，找藏经阁东侧的小径。" },
  martial: { x: 33, z: 15, label: "习武广场东角", clue: "没人练拳的时候，这里能听见木桩沙沙响。", direction: "去习武广场，走到东侧靠外的空地。" },
} satisfies Record<CatHideout, { x: number; z: number; label: string; clue: string; direction: string }>;

const CAT_TRAIL: Record<CatHideout, CatHideout> = {
  bamboo: "pond",
  eaves: "bamboo",
  stones: "pond",
  pond: "bamboo",
  library: "eaves",
  martial: "eaves",
};

export function templeCatRoute(day: string) {
  const cat = templeCatHideout(day);
  return { tracks: CAT_TRAIL[cat], cat };
}

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
    // Advance to a different district each day.
    corner = (corner + 1 + (seed >>> 24) % (CAT_HIDEOUTS.length - 1)) % CAT_HIDEOUTS.length;
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
