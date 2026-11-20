import { getAbbotAccessory, getAccessoryForTitle, normalizeAbbotOutfit, type AbbotAccessoryId, type AbbotAccessorySlot, type AbbotOutfit } from "../abbot-accessories.mjs";

export type AbbotObjectiveKind = "prayer" | "flower" | "beads" | "wood" | "incense" | "fish" | "bell" | "sutra" | "martial" | "skyLantern";
export type AbbotAction = "accept" | "complete" | AbbotObjectiveKind;
export type AbbotAppearance = { accessoryId: AbbotAccessoryId | null; updatedAt: number; equippedBySlot?: AbbotOutfit; revision?: number };
export type AbbotWardrobe = { unlocked: AbbotAccessoryId[]; equipped: AbbotAccessoryId | null; equippedBySlot: AbbotOutfit; configured: boolean; updatedAt: number; revision: number };
export type AbbotJourney = {
  questId: string;
  acceptedAt: number;
  objectives: Record<string, number | null>;
  rewardedAt: number | null;
  rewardTitle: string;
};
export type AbbotArchive = {
  acceptedAt: number | null;
  prayerAt: number | null;
  flowerAt: number | null;
  rewardedAt: number | null;
  version?: 2;
  journeys?: AbbotJourney[];
  appearance?: AbbotAppearance;
};
export type AbbotQuest = {
  id: string;
  title: string;
  intro: string;
  teaching: string;
  completion: string;
  objectives: { id: string; kind: AbbotObjectiveKind; label: string; description: string }[];
  reward: { title: string; lanternName: string };
  ceremony: 0 | 1 | 2 | 3;
};
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
  quest: AbbotQuest;
  progress: { accepted: boolean; prayer: boolean; flower: boolean; rewarded: boolean; objectives: Record<string, boolean> };
  rewards: { hasLantern: boolean; titles: string[]; activeTitle: string };
  wardrobe: AbbotWardrobe;
  archive: AbbotArchive;
  trial: { temporaryRecords: boolean };
};

const archiveKey = (selfId: string) => `cloud-temple-abbot-archive:${selfId}`;
const fields = ["acceptedAt", "prayerAt", "flowerAt", "rewardedAt"] as const;
const memoryArchives = new Map<string, AbbotArchive>();
const snapshots = new Map<string, AbbotSnapshot>();
const requestOrders = new WeakMap<AbbotSnapshot, number>();
let nextRequestOrder = 0;
const validTime = (value: unknown): value is number | null => value === null || (Number.isSafeInteger(value) && (value as number) >= 0);
const earliest = (...values: (number | null | undefined)[]) => { const times = values.filter((value): value is number => typeof value === "number"); return times.length ? Math.min(...times) : null; };
const emptyLegacy = () => ({ acceptedAt: null, prayerAt: null, flowerAt: null, rewardedAt: null });

function singleAccessoryOutfit(accessoryId: AbbotAccessoryId | null): AbbotOutfit {
  const accessory = getAbbotAccessory(accessoryId);
  return accessory ? { [accessory.slot]: accessory.id } : {};
}

function normalizeAppearance(value: AbbotAppearance | undefined): AbbotAppearance | undefined {
  if (!value || !Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0) return undefined;
  const { updatedAt, revision = 0, equippedBySlot } = value;
  if (!Number.isSafeInteger(revision) || revision < 0) return undefined;
  if (equippedBySlot === undefined) {
    if (value.accessoryId !== null && !getAbbotAccessory(value.accessoryId)) return undefined;
    return { accessoryId: value.accessoryId, updatedAt, revision, equippedBySlot: singleAccessoryOutfit(value.accessoryId) };
  }
  if (!equippedBySlot || typeof equippedBySlot !== "object" || Array.isArray(equippedBySlot)) return undefined;
  const outfit = normalizeAbbotOutfit(equippedBySlot);
  if (Object.keys(outfit).length !== Object.keys(equippedBySlot).length) return undefined;
  const equipped = Object.values(outfit);
  const accessoryId = value.accessoryId !== null && equipped.includes(value.accessoryId) ? value.accessoryId : equipped[0] ?? null;
  return { accessoryId, updatedAt, revision, equippedBySlot: outfit };
}

function compareAppearance(left: AbbotAppearance, right: { updatedAt: number; revision?: number }) {
  return left.updatedAt - right.updatedAt || (left.revision ?? 0) - (right.revision ?? 0);
}

function archiveJourneys(archive: AbbotArchive | null): AbbotJourney[] {
  if (!archive) return [];
  if (archive.version === 2 && Array.isArray(archive.journeys)) return archive.journeys.filter(journey =>
    (journey?.questId === "legacy" || /^abbot-\d{1,12}$/.test(journey?.questId))
    && Number.isSafeInteger(journey.acceptedAt) && journey.acceptedAt >= 0 && validTime(journey.rewardedAt)
    && journey.objectives && typeof journey.objectives === "object" && !Array.isArray(journey.objectives)
    && Object.values(journey.objectives).every(validTime) && typeof journey.rewardTitle === "string");
  if (fields.some(field => !validTime(archive[field])) || archive.acceptedAt === null) return [];
  return [{ questId: "legacy", acceptedAt: archive.acceptedAt, objectives: { "legacy-prayer": archive.prayerAt, "legacy-flower": archive.flowerAt }, rewardedAt: archive.rewardedAt, rewardTitle: "照心行者" }];
}
function mergeArchives(...archives: (AbbotArchive | null | undefined)[]): AbbotArchive {
  const merged = new Map<string, AbbotJourney>();
  let appearance: AbbotAppearance | undefined;
  for (const archive of archives) {
    const next = normalizeAppearance(archive?.appearance);
    if (next && (!appearance || compareAppearance(next, appearance) >= 0)) appearance = next;
  }
  for (const archive of archives) for (const journey of archiveJourneys(archive ?? null)) {
    const previous = merged.get(journey.questId);
    merged.set(journey.questId, {
      questId: journey.questId,
      acceptedAt: earliest(previous?.acceptedAt, journey.acceptedAt)!,
      objectives: Object.fromEntries([...new Set([...Object.keys(previous?.objectives ?? {}), ...Object.keys(journey.objectives)])].map(id => [id, earliest(previous?.objectives[id], journey.objectives[id])])),
      rewardedAt: earliest(previous?.rewardedAt, journey.rewardedAt),
      rewardTitle: journey.rewardTitle || previous?.rewardTitle || "照心行者",
    });
  }
  const journeys = [...merged.values()].sort((left, right) => left.acceptedAt - right.acceptedAt);
  const legacy = merged.get("legacy");
  const certificates = [...new Map(journeys.filter(journey => journey.rewardedAt !== null).map(journey => [journey.rewardTitle, journey])).values()];
  const retained = [...new Map([...journeys.slice(-32), ...certificates, ...journeys.filter(journey => journey.rewardedAt === null), ...(legacy ? [legacy] : [])].map(journey => [journey.questId, journey])).values()];
  return { ...(legacy ? { acceptedAt: legacy.acceptedAt, prayerAt: legacy.objectives["legacy-prayer"], flowerAt: legacy.objectives["legacy-flower"], rewardedAt: legacy.rewardedAt } : emptyLegacy()), version: 2, journeys: retained, ...(appearance ? { appearance } : {}) };
}
function readArchive(selfId: string): AbbotArchive {
  let disk: AbbotArchive | null = null;
  try { disk = JSON.parse(localStorage.getItem(archiveKey(selfId)) || "null"); } catch { /* This visit can still use its in-memory backup. */ }
  return mergeArchives(memoryArchives.get(selfId), disk);
}
function rememberSnapshot(selfId: string, incoming: AbbotSnapshot): AbbotSnapshot {
  const previous = snapshots.get(selfId);
  const olderReply = previous && (previous.now > incoming.now || (previous.now === incoming.now && (requestOrders.get(previous) ?? 0) > (requestOrders.get(incoming) ?? 0)));
  const snapshot = olderReply ? previous! : incoming;
  const archive = mergeArchives(readArchive(selfId), incoming.archive, snapshot.archive);
  memoryArchives.set(selfId, archive);
  try { localStorage.setItem(archiveKey(selfId), JSON.stringify(archive)); } catch { /* Confirmed server progress remains available for this account. */ }
  const journey = archive.journeys?.find(item => item.questId === snapshot.quest.id);
  const objectiveProgress = Object.fromEntries(snapshot.quest.objectives.map(item => [item.id, journey?.objectives[item.id] !== null && journey?.objectives[item.id] !== undefined]));
  const completed = archive.journeys?.filter(item => item.rewardedAt !== null).sort((left, right) => left.rewardedAt! - right.rewardedAt!) ?? [];
  const titles = [...new Set([...snapshot.rewards.titles, ...completed.map(item => item.rewardTitle)])];
  const unlocked = titles.flatMap(title => { const accessory = getAccessoryForTitle(title); return accessory ? [accessory.id] : []; });
  const appearance = archive.appearance;
  const latestAccessory = getAccessoryForTitle(completed[completed.length - 1]?.rewardTitle ?? snapshot.rewards.activeTitle)?.id ?? null;
  const outfit = appearance?.equippedBySlot ?? singleAccessoryOutfit(latestAccessory);
  const equippedBySlot: AbbotOutfit = Object.fromEntries(Object.entries(outfit).filter(([, id]) => unlocked.includes(id)));
  const equippedIds = Object.values(equippedBySlot);
  const preferred = appearance?.accessoryId;
  const equipped = preferred && equippedIds.includes(preferred) ? preferred : equippedIds[0] ?? null;
  const result: AbbotSnapshot = { ...snapshot, archive,
    progress: { accepted: Boolean(journey), prayer: snapshot.quest.objectives.some(item => item.kind === "prayer" && objectiveProgress[item.id]), flower: snapshot.quest.objectives.some(item => item.kind === "flower" && objectiveProgress[item.id]), rewarded: journey?.rewardedAt !== null && journey?.rewardedAt !== undefined, objectives: objectiveProgress },
    rewards: { hasLantern: snapshot.rewards.hasLantern || completed.length > 0, titles, activeTitle: completed[completed.length - 1]?.rewardTitle ?? snapshot.rewards.activeTitle },
    wardrobe: { unlocked, equipped, equippedBySlot, configured: Boolean(appearance), updatedAt: appearance?.updatedAt ?? 0, revision: appearance?.revision ?? 0 },
  };
  requestOrders.set(result, requestOrders.get(snapshot) ?? 0);
  snapshots.set(selfId, result);
  return result;
}
async function requestAbbot(selfId: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<AbbotSnapshot> {
  const order = ++nextRequestOrder;
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
  requestOrders.set(data, order);
  return data;
}
function needsRestore(saved: AbbotJourney, cloud: AbbotJourney | undefined) {
  return !cloud || saved.acceptedAt < cloud.acceptedAt || (saved.rewardedAt !== null && (cloud.rewardedAt === null || saved.rewardedAt < cloud.rewardedAt))
    || Object.keys(saved.objectives).some(id => saved.objectives[id] !== null && (cloud.objectives[id] === null || cloud.objectives[id] === undefined || saved.objectives[id]! < cloud.objectives[id]!));
}

/** Restore this account's legacy and new journey certificates in bounded batches. */
export async function getAbbotSnapshot(selfId: string, signal?: AbortSignal): Promise<AbbotSnapshot> {
  const saved = readArchive(selfId);
  let snapshot = await requestAbbot(selfId, undefined, signal);
  const cloud = new Map((snapshot.archive.journeys ?? []).map(journey => [journey.questId, journey]));
  const missing = (saved.journeys ?? []).filter(journey => needsRestore(journey, cloud.get(journey.questId)));
  for (let offset = 0; offset < missing.length; offset += 20) snapshot = await requestAbbot(selfId, { action: "restore", archive: { version: 2, journeys: missing.slice(offset, offset + 20) } }, signal);
  if (saved.appearance && (!snapshot.wardrobe?.configured || compareAppearance(saved.appearance, snapshot.wardrobe) > 0)) {
    snapshot = await requestAbbot(selfId, { action: "restore", archive: { version: 2, journeys: [], appearance: saved.appearance } }, signal);
  }
  return rememberSnapshot(selfId, snapshot);
}
export async function actAbbot(selfId: string, action: AbbotAction, encounterId?: string, signal?: AbortSignal, requestedQuestId?: string): Promise<AbbotSnapshot> {
  const questId = requestedQuestId ?? snapshots.get(selfId)?.quest.id;
  const snapshot = await requestAbbot(selfId, { action, ...(encounterId ? { encounterId } : {}), ...(questId ? { questId } : {}) }, signal);
  return rememberSnapshot(selfId, snapshot);
}

export async function equipAbbotAccessory(selfId: string, accessoryId: AbbotAccessoryId | null, signal?: AbortSignal, slot?: AbbotAccessorySlot): Promise<AbbotSnapshot> {
  const snapshot = await requestAbbot(selfId, { action: "equipAccessory", accessoryId, ...(slot === undefined ? {} : { slot }) }, signal);
  return rememberSnapshot(selfId, snapshot);
}
