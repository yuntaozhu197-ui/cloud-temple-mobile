export type PracticeGameKind = "wood" | "beads" | "flower";
export type PracticeReceipt = { requestId: string; kind: PracticeGameKind; completedAt: number };
export type PracticeGamesSnapshot = {
  games: Record<PracticeGameKind, { score: number; tier: number }>;
  receipts: PracticeReceipt[];
  trial: { temporaryRecords: boolean };
};
type PracticeTier = { points: number; name: string; description: string };
export const PRACTICE_GAMES: readonly { id: PracticeGameKind; name: string; actionLabel: string; tiers: readonly PracticeTier[] }[] = [
  { id: "wood", name: "木鱼修行", actionLabel: "敲木鱼", tiers: [
    { points: 0, name: "素木木鱼", description: "从温润素木起步，轻敲一下，记下一点专注。" },
    { points: 10, name: "莲纹木鱼", description: "木纹间绽出莲瓣，刻线与圆润鱼身相映。" },
    { points: 20, name: "朱漆木鱼", description: "朱漆鱼身配古铜饰边，敲出一段沉静时光。" },
    { points: 50, name: "鎏金木鱼", description: "金饰云纹环绕深色木身，细节逐层展开。" },
    { points: 100, name: "琉璃莲座木鱼", description: "琉璃光泽、金饰与莲座，托起圆满的一百声。" },
  ] },
  { id: "beads", name: "佛珠寻光", actionLabel: "转佛珠", tiers: [
    { points: 0, name: "菩提佛珠", description: "握住一串菩提珠，完整转珠一次，积累一点宁静。" },
    { points: 5, name: "蜜蜡佛珠", description: "暖色珠粒透出蜜蜡般的柔光。" },
    { points: 10, name: "青玉佛珠", description: "青玉珠粒与雅致隔珠，在手中缓缓流转。" },
    { points: 20, name: "青金佛珠", description: "青金蓝珠点缀金色细节，穗结轻轻垂落。" },
    { points: 50, name: "莲心宝珠", description: "宝珠、莲心母珠与细致流苏，串起五十次专注。" },
  ] },
  { id: "flower", name: "供花培莲", actionLabel: "免费供花", tiers: [
    { points: 0, name: "一枝心花", description: "完成一次免费供花，留下一点温柔。" },
    { points: 3, name: "清荷小束", description: "几枝清荷相依，花叶舒展成一束心意。" },
    { points: 5, name: "莲瓣花篮", description: "莲瓣花篮盛放层叠花朵，配上柔和叶色。" },
    { points: 10, name: "瑞莲供瓶", description: "雅致供瓶、莲花与枝叶，构成一座小小花景。" },
    { points: 20, name: "金莲宝供", description: "层叠金莲与精致供台，让二十次善意静静盛放。" },
  ] },
];

export function getPracticeTier(kind: PracticeGameKind, score: number) {
  const game = PRACTICE_GAMES.find(item => item.id === kind)!;
  return Math.max(0, game.tiers.filter(tier => score >= tier.points).length - 1);
}
export function practiceGameMaximum(kind: PracticeGameKind) {
  const tiers = PRACTICE_GAMES.find(item => item.id === kind)!.tiers;
  return tiers[tiers.length - 1].points;
}

type PracticeArchive = { receipts: PracticeReceipt[]; pending: PracticeReceipt[] };
const memoryArchives = new Map<string, PracticeArchive>();
const archiveKey = (selfId: string) => `cloud-temple-practice-games:${selfId}`;
const validReceipt = (value: PracticeReceipt) => typeof value?.requestId === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.requestId)
  && PRACTICE_GAMES.some(game => game.id === value.kind) && Number.isSafeInteger(value.completedAt) && value.completedAt >= 0;
const unique = (receipts: readonly PracticeReceipt[]) => [...new Map(receipts.map(receipt => [receipt.requestId, receipt])).values()].sort((left, right) => left.completedAt - right.completedAt);

export function readPracticeArchive(selfId: string): PracticeArchive {
  const memory = memoryArchives.get(selfId) ?? { receipts: [], pending: [] };
  let saved: PracticeArchive = { receipts: [], pending: [] };
  try {
    const value = JSON.parse(localStorage.getItem(archiveKey(selfId)) || "null");
    const records = (value: unknown): PracticeReceipt[] => Array.isArray(value) ? unique(value.filter(validReceipt)) : [];
    saved = { receipts: records(value?.receipts), pending: records(value?.pending) };
  } catch { /* In-memory receipts still support this visit when browser storage is unavailable. */ }
  const receipts = unique([...memory.receipts, ...saved.receipts]);
  const confirmed = new Set(receipts.map(receipt => receipt.requestId));
  const pending = unique([...memory.pending, ...saved.pending]).filter(receipt => !confirmed.has(receipt.requestId)
    && receipts.filter(item => item.kind === receipt.kind).length < practiceGameMaximum(receipt.kind));
  return { receipts, pending };
}
function writeArchive(selfId: string, archive: PracticeArchive) {
  memoryArchives.set(selfId, archive);
  try { localStorage.setItem(archiveKey(selfId), JSON.stringify(archive)); } catch { /* Confirmed records remain available from this account's server. */ }
}

export function snapshotFromPracticeReceipts(receipts: readonly PracticeReceipt[], temporaryRecords = true): PracticeGamesSnapshot {
  const records = unique(receipts);
  const games = Object.fromEntries(PRACTICE_GAMES.map(game => {
    const score = Math.min(records.filter(receipt => receipt.kind === game.id).length, practiceGameMaximum(game.id));
    return [game.id, { score, tier: getPracticeTier(game.id, score) }];
  })) as PracticeGamesSnapshot["games"];
  return { games, receipts: records, trial: { temporaryRecords } };
}

export function rememberPracticeReceipt(selfId: string, receipt: PracticeReceipt) {
  if (!validReceipt(receipt)) return;
  const archive = readPracticeArchive(selfId);
  if (archive.receipts.some(record => record.requestId === receipt.requestId) || archive.pending.some(record => record.requestId === receipt.requestId)) return;
  archive.pending.push(receipt);
  writeArchive(selfId, archive);
}

function saveSnapshot(selfId: string, snapshot: PracticeGamesSnapshot) {
  const archive = readPracticeArchive(selfId);
  const confirmed = new Set(snapshot.receipts.map(receipt => receipt.requestId));
  writeArchive(selfId, {
    receipts: unique([...archive.receipts, ...snapshot.receipts]),
    pending: archive.pending.filter(receipt => !confirmed.has(receipt.requestId) && snapshot.games[receipt.kind].score < practiceGameMaximum(receipt.kind)),
  });
}

async function request(selfId: string, signal: AbortSignal, body?: Record<string, unknown>): Promise<PracticeGamesSnapshot> {
  const response = await fetch("/api/practice-games", {
    method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal,
    headers: { "X-Temple-User": selfId, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    const failure = new Error(data.message || "修行进度暂时没有保存成功，请稍后重试。") as Error & { status?: number };
    failure.status = response.status;
    throw failure;
  }
  return data;
}

/** Restore confirmed receipts before flushing new actions, preserving trial saves. */
export async function practiceGamesRequest(selfId: string, signal: AbortSignal, receipts: readonly PracticeReceipt[] = []): Promise<PracticeGamesSnapshot> {
  const saved = readPracticeArchive(selfId);
  let snapshot = await request(selfId, signal);
  const cloudIds = new Set(snapshot.receipts.map(receipt => receipt.requestId));
  const missing = saved.receipts.filter(receipt => !cloudIds.has(receipt.requestId));
  for (let offset = 0; offset < missing.length; offset += 40) snapshot = await request(selfId, signal, { action: "restore", receipts: missing.slice(offset, offset + 40) });
  for (let offset = 0; offset < receipts.length; offset += 40) snapshot = await request(selfId, signal, { action: "recordMany", receipts: receipts.slice(offset, offset + 40) });
  saveSnapshot(selfId, snapshot);
  return snapshot;
}
