export type PondSpecies = "fish" | "koi" | "goldfish" | "turtle" | "frog" | "butterfly";

export const POND_SPECIES: readonly { id: PondSpecies; name: string; points: number }[] = [
  { id: "fish", name: "小鱼", points: 0 },
  { id: "koi", name: "锦鲤", points: 10 },
  { id: "goldfish", name: "金鱼", points: 20 },
  { id: "turtle", name: "小乌龟", points: 30 },
  { id: "frog", name: "青蛙", points: 40 },
  { id: "butterfly", name: "彩蝶", points: 50 },
];

export function isPondSpecies(value: unknown): value is PondSpecies {
  return POND_SPECIES.some(species => species.id === value);
}

export function getPondSpecies(id: PondSpecies | string) {
  return POND_SPECIES.find(species => species.id === id);
}

export type PondRelease = { requestId: string; species: PondSpecies; releasedAt: number };
export type PondSnapshot = {
  score: number;
  counts: Record<PondSpecies, number>;
  unlocked: PondSpecies[];
  releases: PondRelease[];
  offline?: boolean;
  trial: { temporaryRecords: boolean };
};
type PondArchive = { releases: PondRelease[]; pending: PondRelease[] };
const archiveKey = (selfId: string) => `cloud-temple-pond-archive:${selfId}`;
const validId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validRelease = (value: PondRelease) => validId(value?.requestId) && isPondSpecies(value.species) && Number.isSafeInteger(value.releasedAt) && value.releasedAt >= 0;

function readArchive(selfId: string): PondArchive {
  try {
    const saved = JSON.parse(localStorage.getItem(archiveKey(selfId)) || "null");
    const records = (value: unknown): PondRelease[] => Array.isArray(value)
      ? [...new Map(value.filter(validRelease).map((record: PondRelease) => [record.requestId, record])).values()]
      : [];
    return { releases: records(saved?.releases), pending: records(saved?.pending) };
  } catch { return { releases: [], pending: [] }; }
}

function writeArchive(selfId: string, archive: PondArchive) {
  try { localStorage.setItem(archiveKey(selfId), JSON.stringify(archive)); } catch { /* Cloud records remain available when this browser cannot save a backup. */ }
}

export function pendingPondReleases(selfId: string) {
  return readArchive(selfId).pending;
}

/** Call after the animal leaves the monk's hands, before sending its idempotent receipt. */
export function rememberPondRelease(selfId: string, release: PondRelease) {
  const archive = readArchive(selfId);
  if (!validRelease(release) || archive.releases.some(record => record.requestId === release.requestId) || archive.pending.some(record => record.requestId === release.requestId)) return;
  archive.pending.push(release);
  writeArchive(selfId, archive);
}

function saveSnapshot(selfId: string, snapshot: PondSnapshot) {
  const archive = readArchive(selfId);
  const releases = new Map(archive.releases.map(record => [record.requestId, record]));
  for (const release of snapshot.releases) releases.set(release.requestId, release);
  writeArchive(selfId, {
    releases: [...releases.values()].sort((a, b) => a.releasedAt - b.releasedAt),
    pending: archive.pending.filter(record => !releases.has(record.requestId)),
  });
}

async function fetchPond(selfId: string, signal: AbortSignal, body?: Record<string, unknown>): Promise<PondSnapshot> {
  const response = await fetch("/api/pond", {
    method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal,
    headers: { "X-Temple-User": selfId, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    const failure = new Error(data.message || "放生记录暂时没有连接成功，请重试。") as Error & { status?: number };
    failure.status = response.status;
    throw failure;
  }
  return data;
}

/** Replay this account's confirmed local receipts after the free trial service rebuilds. */
export async function pondRequest(selfId: string, signal: AbortSignal, release?: Pick<PondRelease, "requestId" | "species">): Promise<PondSnapshot> {
  const saved = readArchive(selfId);
  try {
    let snapshot = await fetchPond(selfId, signal);
    const cloudIds = new Set(snapshot.releases.map(record => record.requestId));
    const missing = saved.releases.filter(record => !cloudIds.has(record.requestId));
    for (let offset = 0; offset < missing.length; offset += 100) {
      snapshot = await fetchPond(selfId, signal, { action: "restore", releases: missing.slice(offset, offset + 100) });
    }
    if (release) snapshot = await fetchPond(selfId, signal, { action: "release", ...release });
    saveSnapshot(selfId, snapshot);
    return snapshot;
  } catch (failure) {
    if (release || signal.aborted || (failure as { status?: number }).status || saved.releases.length === 0) throw failure;
    const counts = Object.fromEntries(POND_SPECIES.map(species => [species.id, 0])) as Record<PondSpecies, number>;
    for (const record of saved.releases) counts[record.species]++;
    return {
      score: saved.releases.length, counts,
      unlocked: POND_SPECIES.filter(species => saved.releases.length >= species.points).map(species => species.id),
      releases: saved.releases, offline: true, trial: { temporaryRecords: true },
    };
  }
}
