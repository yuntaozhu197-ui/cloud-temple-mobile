export type AbbotAction = "accept" | "prayer" | "flower" | "complete";
export type AbbotArchive = { acceptedAt: number | null; prayerAt: number | null; flowerAt: number | null; rewardedAt: number | null };
export type AbbotSnapshot = {
  now: number;
  encounter: {
    id: string;
    active: boolean;
    location: { name: string; x: number; z: number };
    appearsAt: number;
    leavesAt: number;
    nextAppearsAt: number;
  };
  progress: { accepted: boolean; prayer: boolean; flower: boolean; rewarded: boolean };
  archive: AbbotArchive;
  trial: { temporaryRecords: boolean };
};

const archiveKey = (selfId: string) => `cloud-temple-abbot-archive:${selfId}`;
const fields = ["acceptedAt", "prayerAt", "flowerAt", "rewardedAt"] as const;

function readArchive(selfId: string): AbbotArchive | null {
  try {
    const saved = JSON.parse(localStorage.getItem(archiveKey(selfId)) || "null");
    if (!saved || fields.some(field => saved[field] !== null && (!Number.isSafeInteger(saved[field]) || saved[field] < 0))) return null;
    return Object.fromEntries(fields.map(field => [field, saved[field]])) as AbbotArchive;
  } catch { return null; }
}

function rememberSnapshot(selfId: string, snapshot: AbbotSnapshot): AbbotSnapshot {
  const saved = readArchive(selfId);
  const archive = Object.fromEntries(fields.map(field => {
    const times = [saved?.[field], snapshot.archive[field]].filter((value): value is number => typeof value === "number");
    return [field, times.length ? Math.min(...times) : null];
  })) as AbbotArchive;
  // Overlapping polls and action replies can arrive out of order. Retain every
  // confirmed step so a delayed response cannot remove a saved reward.
  try { localStorage.setItem(archiveKey(selfId), JSON.stringify(archive)); } catch { /* The server still retains this account's quest progress. */ }
  return { ...snapshot, archive, progress: {
    accepted: archive.acceptedAt !== null, prayer: archive.prayerAt !== null,
    flower: archive.flowerAt !== null, rewarded: archive.rewardedAt !== null,
  } };
}

async function requestAbbot(selfId: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<AbbotSnapshot> {
  const response = await fetch("/api/abbot", {
    method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal,
    headers: { "X-Temple-User": selfId, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "住持奇遇暂时没有连接成功，请稍后重试。") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data;
}

/** Restore only missing account-specific progress after a free service rebuild. */
export async function getAbbotSnapshot(selfId: string, signal?: AbortSignal): Promise<AbbotSnapshot> {
  const saved = readArchive(selfId);
  let snapshot = await requestAbbot(selfId, undefined, signal);
  if (saved && fields.some(field => saved[field] !== null && snapshot.archive[field] === null)) {
    snapshot = await requestAbbot(selfId, { action: "restore", archive: saved }, signal);
  }
  return rememberSnapshot(selfId, snapshot);
}

export async function actAbbot(selfId: string, action: AbbotAction, encounterId?: string, signal?: AbortSignal): Promise<AbbotSnapshot> {
  const snapshot = await requestAbbot(selfId, { action, ...(encounterId ? { encounterId } : {}) }, signal);
  return rememberSnapshot(selfId, snapshot);
}
