export type LampDay = { day: string; makeup: boolean; litAt: number };
export type LampSnapshot = {
  today: string;
  timeZone: string;
  wish: { text: string; updatedAt: number | null };
  litToday: boolean;
  total: number;
  days: LampDay[];
  archiveDays?: LampDay[];
  offline?: boolean;
  trial: { temporaryRecords: boolean };
};

type Archive = { wish: LampSnapshot["wish"]; days: LampDay[] };
const key = (selfId: string) => `cloud-temple-lamp-archive:${selfId}`;
let requestOrder = 0;
const latestWishWrite = new Map<string, number>();

function validStoredDay(day: LampDay) {
  if (typeof day?.day !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(day.day) || typeof day.makeup !== "boolean" || !Number.isFinite(day.litAt) || day.litAt < 0) return false;
  const date = new Date(`${day.day}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day.day;
}

function readArchive(selfId: string): Archive | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key(selfId)) || "null");
    if (!saved || typeof saved.wish?.text !== "string" || !Array.isArray(saved.days)) return null;
    const days = new Map<string, LampDay>();
    for (const day of saved.days) if (validStoredDay(day)) days.set(day.day, day);
    return {
      wish: { text: Array.from(saved.wish.text.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "")).slice(0, 1000).join(""), updatedAt: Number.isFinite(saved.wish.updatedAt) && saved.wish.updatedAt >= 0 ? saved.wish.updatedAt : null },
      days: [...days.values()],
    };
  } catch { return null; }
}

function saveArchive(selfId: string, snapshot: LampSnapshot, preserveWish = false) {
  const previous = readArchive(selfId);
  const days = new Map((previous?.days ?? []).map(day => [day.day, day]));
  for (const day of snapshot.archiveDays ?? snapshot.days) days.set(day.day, day);
  const wish = previous && (preserveWish || snapshot.wish.updatedAt === null || (previous.wish.updatedAt ?? -1) > snapshot.wish.updatedAt) ? previous.wish : snapshot.wish;
  try { localStorage.setItem(key(selfId), JSON.stringify({ wish, days: [...days.values()] })); } catch { /* Server records remain usable when device storage is full. */ }
}

function withArchive(selfId: string, snapshot: LampSnapshot): LampSnapshot {
  const archive = readArchive(selfId);
  if (!archive) return snapshot;
  const days = archive.days.filter(day => day.day <= snapshot.today).sort((a, b) => b.day.localeCompare(a.day));
  const recentStart = new Date(`${snapshot.today}T00:00:00Z`);
  recentStart.setUTCDate(recentStart.getUTCDate() - 29);
  const firstDay = recentStart.toISOString().slice(0, 10);
  return {
    ...snapshot, wish: archive.wish, archiveDays: days,
    days: days.filter(day => day.day >= firstDay),
    total: Math.max(snapshot.total, days.length),
    litToday: snapshot.litToday || days.some(day => day.day === snapshot.today),
  };
}

async function fetchLamp(selfId: string, signal: AbortSignal, body?: Record<string, unknown>): Promise<LampSnapshot> {
  const response = await fetch("/api/lamps", {
    method: body ? "POST" : "GET",
    credentials: "same-origin", cache: "no-store", signal,
    headers: { "X-Temple-User": selfId, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || "长明灯暂时没有连接成功，请重试。") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return result;
}

/** Restore this browser's own dated records after a trial service rebuild. */
export async function lampRequest(selfId: string, signal: AbortSignal, body?: Record<string, unknown>): Promise<LampSnapshot> {
  const order = ++requestOrder;
  const saved = readArchive(selfId);
  try {
    let result = await fetchLamp(selfId, signal, body);
    if (body?.action === "wish") latestWishWrite.set(selfId, Math.max(order, latestWishWrite.get(selfId) ?? 0));
    saveArchive(selfId, result, order < (latestWishWrite.get(selfId) ?? 0));
    if (!body && saved) {
      const cloudDays = new Set((result.archiveDays ?? result.days).map(day => day.day));
      const missing = saved.days.filter(day => day.day <= result.today && !cloudDays.has(day.day));
      const restoreWish = result.wish.updatedAt === null && saved.wish.updatedAt !== null;
      if (missing.length || restoreWish) {
        for (let offset = 0; offset < Math.max(1, missing.length); offset += 100) {
          result = await fetchLamp(selfId, signal, {
            action: "restore", days: missing.slice(offset, offset + 100),
            ...(offset === 0 && restoreWish ? { wish: saved.wish.text } : {}),
          });
          saveArchive(selfId, result, order < (latestWishWrite.get(selfId) ?? 0));
        }
      }
    }
    return withArchive(selfId, result);
  } catch (failure) {
    const backup = readArchive(selfId) ?? saved;
    if (body || !backup || signal.aborted || (failure as { status?: number }).status) throw failure;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const days = backup.days.filter(day => day.day <= today).sort((a, b) => b.day.localeCompare(a.day));
    return { today, timeZone: "Asia/Shanghai", wish: backup.wish, litToday: days.some(day => day.day === today), total: days.length, days: days.slice(0, 30), archiveDays: days, offline: true, trial: { temporaryRecords: true } };
  }
}
