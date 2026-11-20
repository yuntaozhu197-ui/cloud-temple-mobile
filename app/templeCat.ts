export const TEMPLE_CAT_TITLE = "寺猫偷走了住持的金铃";
export const CAT_HIDEOUTS = ["bamboo", "eaves", "stones", "pond", "library", "martial"] as const;
export type CatHideout = typeof CAT_HIDEOUTS[number];
export type TempleCatEvent = "start" | "complete" | "share";

export const CAT_SEARCH_RADIUS = 2.2;

type CatPoint = { x: number; z: number };
type CatPlace = CatPoint & {
  label: string;
  landmark: string;
  clue: string;
  direction: string;
  detail: string;
  guide: CatPoint;
};

export const TEMPLE_CAT_PLACES = {
  bamboo: {
    x: -8.5, z: 0.9, guide: { x: -4, z: 1.2 }, label: "竹林小径", landmark: "竹林",
    clue: "风一停，细长的叶子还在摇。",
    direction: "在地图导航选「竹林」，到庭院西侧的竹林边去。",
    detail: "留在竹竿外面，顺着靠庭院的竹林边缘走，留意石路旁的地面。",
  },
  eaves: {
    x: 18, z: 2.5, guide: { x: 18, z: 7.2 }, label: "钟亭檐下", landmark: "钟亭",
    clue: "明明没人敲钟，屋檐下却响了一声铃。",
    direction: "在地图导航选「钟亭」，去庭院东侧那座有四根柱子的小亭。",
    detail: "从花园朝小亭走，查看靠花园这一侧的台阶前。",
  },
  stones: {
    x: -43, z: 21, guide: { x: -41.2, z: 17.1 }, label: "塔林石径", landmark: "少林塔林",
    clue: "石塔一座挨一座，地上落了几片松针。",
    direction: "在地图导航选「少林塔林」，去寺院西南边的石塔群。",
    detail: "沿石径往南，从短石碑靠庭院的一侧绕过去，看看石碑后面的空地。",
  },
  pond: {
    x: -31.4, z: 12.8, guide: { x: -35.7, z: 13 }, label: "放生池西岸", landmark: "放生池",
    clue: "一串脚印沾了水，旁边的鱼群刚刚散开。",
    direction: "在地图导航选「放生池」，从池边的入口沿岸往塔林方向绕。",
    detail: "在靠塔林的一侧朝圆池走，查看西南转角的石沿外侧。",
  },
  library: {
    x: 12.5, z: -29.3, guide: { x: 17.3, z: -30.7 }, label: "藏经阁东侧小径", landmark: "藏经阁",
    clue: "经书的纸香从大殿后方飘来。",
    direction: "在地图导航选「藏经阁」，到大雄宝殿背后，再绕到藏经阁右边。",
    detail: "走在藏经阁东墙外的窄路上，朝正门台阶那一端靠近。",
  },
  martial: {
    x: 33, z: 15, guide: { x: 28.3, z: 15 }, label: "习武广场东角", landmark: "习武广场",
    clue: "没人练拳的时候，这里能听见木桩沙沙响。",
    direction: "在地图导航选「习武广场」，找有木人桩和红边的场地。",
    detail: "从广场中间往东走，查看木人桩南边、红色边线以内的空地。",
  },
} satisfies Record<CatHideout, CatPlace>;

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
