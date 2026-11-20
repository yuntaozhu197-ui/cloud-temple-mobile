import { ITEMS, ITEMS_BY_ID, MERCHANT_IDS, MERCHANTS, RARITIES, RARITY_IDS, REDEMPTIONS, RESOURCE_IDS, RESOURCES, type Item, type MerchantId, type Milestone, type Rarity, type ResourceId } from "./catalog";

export type QuoteTier = "ordinary" | "standard" | "high";
export type Quote = { id: string; cost: number; tier: QuoteTier };
export type Receipt = {
  id: string;
  merchant: MerchantId;
  quoteId: string;
  cost: number;
  itemId: string;
  rarity: Rarity;
  isNew: boolean;
  completedCollection: boolean;
  milestone: Milestone | null;
  dialogue: string | null;
};

type MerchantProgress = { exchanges: number; commonStreak: number; quote: Quote };

export type OdditiesSave = {
  version: 1;
  epoch: number;
  resources: Record<ResourceId, number>;
  inventory: Record<string, number>;
  unlocked: string[];
  merchants: Record<MerchantId, MerchantProgress>;
  glow: number;
  achievements: string[];
  pending: Receipt | null;
};

export type OdditiesAction =
  | { type: "exchange"; merchant: MerchantId; quoteId: string }
  | { type: "collect"; receiptId: string }
  | { type: "explore" }
  | { type: "recycle"; itemId: string }
  | { type: "redeem"; itemId: string }
  | { type: "reset" };

type ErrorReason = "pending" | "stale-quote" | "insufficient" | "unknown-item" | "no-extra" | "not-redeemable" | "no-pending";

export type OdditiesEvent =
  | { type: "exchanged"; receipt: Receipt }
  | { type: "collected" }
  | { type: "explored"; resource: ResourceId; amount: number; text: string }
  | { type: "recycled"; itemId: string; glow: number }
  | { type: "redeemed"; itemId: string; isNew: boolean; completedCollection: boolean }
  | { type: "reset" }
  | { type: "error"; reason: ErrorReason; missing?: number };

type Random = () => number;
type Distribution = Record<Rarity, number>;
type Result = { save: OdditiesSave; event: OdditiesEvent };
export type OdditiesTransaction = Result & { persisted: boolean };

export const TRADE_MILESTONES = [5, 15, 30] as const;

export const QUOTE_TIER_NAMES: Record<QuoteTier, string> = { ordinary: "普通", standard: "标准", high: "高价" };

const RARITY_WEIGHTS: Record<QuoteTier, Distribution> = {
  ordinary: { common: 65, rare: 25, precious: 8, legendary: 2 },
  standard: { common: 60, rare: 28, precious: 10, legendary: 2 },
  high: { common: 55, rare: 30, precious: 12, legendary: 3 },
};

const STARTING_RESOURCES = { pinecone: 5, incense: 5, shard: 5 };
const memoryOnlySaves = new Map<string, OdditiesSave>();

function quoteTier(cost: number): QuoteTier {
  if (cost <= 2) return "ordinary";
  if (cost <= 4) return "standard";
  return "high";
}

function quoteWeights(cost: number, pity: boolean): Distribution {
  const weights = RARITY_WEIGHTS[quoteTier(cost)];
  return pity ? { ...weights, common: 0 } : weights;
}

export function quoteRates(cost: number, pity = false): Distribution {
  const weights = quoteWeights(cost, pity);
  if (!pity) return { ...weights };
  const total = 100 - RARITY_WEIGHTS[quoteTier(cost)].common;
  const precious = Math.round(weights.precious / total * 10_000);
  const legendary = Math.round(weights.legendary / total * 10_000);
  // Assign the display's rounding remainder to the largest probability.
  return { common: 0, rare: (10_000 - precious - legendary) / 100, precious: precious / 100, legendary: legendary / 100 };
}

function randomUnit(random: Random) {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0;
}

function choose<T>(options: readonly T[], random: Random): T {
  return options[Math.floor(randomUnit(random) * options.length)];
}

function price(random: Random) {
  return 1 + Math.floor(randomUnit(random) * 5);
}

function makeQuote(merchant: MerchantId, epoch: number, exchanges: number, cost: number): Quote {
  return { id: `${epoch}:${merchant}:${exchanges}`, cost, tier: quoteTier(cost) };
}

export function createOdditiesSave(random: Random = Math.random, epoch = 0): OdditiesSave {
  const progress = (merchant: MerchantId) => ({ exchanges: 0, commonStreak: 0, quote: makeQuote(merchant, epoch, 0, price(random)) });
  return {
    version: 1, epoch, resources: { ...STARTING_RESOURCES }, inventory: {}, unlocked: [],
    merchants: { squirrel: progress("squirrel"), koi: progress("koi"), tit: progress("tit") },
    glow: 0, achievements: [], pending: null,
  };
}

function playerDefaults(playerId: string) {
  // Initial quotes are stable even before the player's first saved interaction.
  let seed = 2166136261;
  for (const character of playerId) seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619);
  return createOdditiesSave(() => {
    seed = Math.imul(seed, 1664525) + 1013904223;
    return (seed >>> 0) / 4294967296;
  });
}

export function merchantDialogue(merchant: MerchantId, exchanges: number, random: Random = Math.random, previous?: string) {
  const profile = MERCHANTS[merchant];
  const unlocked = TRADE_MILESTONES.filter(milestone => milestone <= exchanges).map(milestone => profile.milestoneLines[milestone]);
  return choose([...profile.dialogues, ...unlocked].filter(line => line !== previous), random);
}

function decodeRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function count(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function unlockedCollection(merchant: MerchantId, unlocked: readonly string[]) {
  return ITEMS.every(item => item.merchant !== merchant || unlocked.includes(item.id));
}

function receiptDialogue(merchant: MerchantId, rarity: Rarity, milestone: Milestone | null) {
  const profile = MERCHANTS[merchant];
  const lines = [];
  if (rarity === "legendary") lines.push(profile.legendaryLine);
  if (milestone !== null) lines.push(profile.milestoneLines[milestone]);
  return lines.join(" ") || null;
}

function restoreReceipt(value: unknown, save: OdditiesSave): Receipt | null {
  const saved = decodeRecord(value);
  const item = typeof saved.itemId === "string" ? ITEMS_BY_ID[saved.itemId] : undefined;
  if (!item || saved.merchant !== item.merchant || !save.inventory[item.id]) return null;
  const { merchant, rarity, id: itemId } = item;
  const { exchanges } = save.merchants[merchant];
  const cost = count(saved.cost);
  if (exchanges < 1 || cost < 1 || cost > 5) return null;
  const quoteId = makeQuote(merchant, save.epoch, exchanges - 1, cost).id;
  if (saved.quoteId !== quoteId || saved.id !== `receipt:${quoteId}`) return null;
  const milestone = TRADE_MILESTONES.find(value => value === exchanges) ?? null;
  return {
    id: saved.id, merchant, quoteId, cost, itemId, rarity,
    isNew: saved.isNew === true,
    completedCollection: saved.completedCollection === true && unlockedCollection(merchant, save.unlocked),
    milestone, dialogue: receiptDialogue(merchant, rarity, milestone),
  };
}

export function normalizeOdditiesSave(value: unknown, defaults = createOdditiesSave()): OdditiesSave {
  const saved = decodeRecord(value);
  if (saved.version !== 1) return defaults;

  const rawResources = decodeRecord(saved.resources);
  const resources = { ...defaults.resources };
  for (const resource of RESOURCE_IDS) resources[resource] = count(rawResources[resource], resources[resource]);

  const rawInventory = decodeRecord(saved.inventory);
  const rawUnlocked = new Set(Array.isArray(saved.unlocked) ? saved.unlocked : []);
  const inventory: Record<string, number> = {};
  const unlocked: string[] = [];
  for (const item of ITEMS) {
    const quantity = count(rawInventory[item.id]);
    if (quantity > 0) inventory[item.id] = quantity;
    if (quantity > 0 || rawUnlocked.has(item.id)) unlocked.push(item.id);
  }

  const epoch = count(saved.epoch);
  const rawMerchants = decodeRecord(saved.merchants);
  const merchants = { ...defaults.merchants };
  const achievements: string[] = [];
  for (const merchant of MERCHANT_IDS) {
    const progress = decodeRecord(rawMerchants[merchant]);
    const exchanges = count(progress.exchanges);
    const cost = count(decodeRecord(progress.quote).cost);
    merchants[merchant] = {
      exchanges,
      commonStreak: Math.min(3, exchanges, count(progress.commonStreak)),
      quote: makeQuote(merchant, epoch, exchanges, cost >= 1 && cost <= 5 ? cost : defaults.merchants[merchant].quote.cost),
    };
    if (unlockedCollection(merchant, unlocked)) achievements.push(`merchant:${merchant}`);
    for (const milestone of TRADE_MILESTONES) {
      if (exchanges >= milestone) achievements.push(`trade:${merchant}:${milestone}`);
    }
  }
  if (unlocked.length === ITEMS.length) achievements.push("all:collection");

  const normalized: OdditiesSave = { version: 1, epoch, resources, inventory, unlocked, merchants, glow: count(saved.glow), achievements, pending: null };
  normalized.pending = restoreReceipt(saved.pending, normalized);
  return normalized;
}

export function drawOddityRarity(cost: number, commonStreak: number, random: Random = Math.random): Rarity {
  const weights = quoteWeights(cost, commonStreak >= 3);
  const total = RARITY_IDS.reduce((sum, rarity) => sum + weights[rarity], 0);
  let roll = randomUnit(random) * total;
  for (const rarity of RARITY_IDS) {
    if (roll < weights[rarity]) return rarity;
    roll -= weights[rarity];
  }
  return "legendary";
}

function addItem(save: OdditiesSave, item: Item) {
  const isNew = !save.unlocked.includes(item.id);
  const unlocked = isNew ? [...save.unlocked, item.id] : save.unlocked;
  const achievement = `merchant:${item.merchant}`;
  const completedCollection = isNew && !save.achievements.includes(achievement) && unlockedCollection(item.merchant, unlocked);
  const achievements = [...save.achievements];
  if (completedCollection) achievements.push(achievement);
  if (isNew && unlocked.length === ITEMS.length) achievements.push("all:collection");
  const inventory = { ...save.inventory, [item.id]: (save.inventory[item.id] ?? 0) + 1 };
  return { save: { ...save, inventory, unlocked, achievements }, isNew, completedCollection };
}

function error(save: OdditiesSave, reason: ErrorReason, missing?: number): Result {
  return { save, event: { type: "error", reason, missing } };
}

function exchange(save: OdditiesSave, merchant: MerchantId, quoteId: string, random: Random): Result {
  const progress = save.merchants[merchant];
  if (progress.quote.id !== quoteId) return error(save, "stale-quote");

  const { resource } = MERCHANTS[merchant];
  const cost = progress.quote.cost;
  if (save.resources[resource] < cost) return error(save, "insufficient", cost - save.resources[resource]);
  const rarity = drawOddityRarity(cost, progress.commonStreak, random);
  const item = choose(ITEMS.filter(candidate => candidate.merchant === merchant && candidate.rarity === rarity), random);
  const awarded = addItem(save, item);
  const exchanges = progress.exchanges + 1;
  const milestone = TRADE_MILESTONES.find(value => value === exchanges) ?? null;
  if (milestone !== null) awarded.save.achievements.push(`trade:${merchant}:${milestone}`);

  const receipt: Receipt = {
    id: `receipt:${quoteId}`, merchant, quoteId, cost, itemId: item.id, rarity,
    isNew: awarded.isNew, completedCollection: awarded.completedCollection,
    milestone, dialogue: receiptDialogue(merchant, rarity, milestone),
  };
  return {
    save: {
      ...awarded.save,
      resources: { ...save.resources, [resource]: save.resources[resource] - cost },
      merchants: {
        ...save.merchants,
        [merchant]: {
          exchanges,
          commonStreak: rarity === "common" ? progress.commonStreak + 1 : 0,
          quote: makeQuote(merchant, save.epoch, exchanges, price(random)),
        },
      },
      pending: receipt,
    },
    event: { type: "exchanged", receipt },
  };
}

const DISCOVERIES = {
  pinecone: { place: "古树下", verb: "捡到" },
  incense: { place: "香炉旁", verb: "收集到" },
  shard: { place: "石阶边", verb: "发现" },
};

function explore(save: OdditiesSave, random: Random): Result {
  const resource = choose(RESOURCE_IDS, random);
  const amount = 1 + Math.floor(randomUnit(random) * 3);
  const { place, verb } = DISCOVERIES[resource];
  const { name, unit } = RESOURCES[resource];
  return {
    save: { ...save, resources: { ...save.resources, [resource]: save.resources[resource] + amount } },
    event: { type: "explored", resource, amount, text: `你在${place}${verb}了${amount}${unit}${name}！` },
  };
}

function recycle(save: OdditiesSave, itemId: string): Result {
  const item = ITEMS_BY_ID[itemId];
  if (!item) return error(save, "unknown-item");
  const quantity = save.inventory[itemId] ?? 0;
  if (quantity < 2) return error(save, "no-extra");
  const glow = RARITIES[item.rarity].recycleValue;
  return {
    save: { ...save, inventory: { ...save.inventory, [itemId]: quantity - 1 }, glow: save.glow + glow },
    event: { type: "recycled", itemId, glow },
  };
}

function redeem(save: OdditiesSave, itemId: string): Result {
  const item = ITEMS_BY_ID[itemId];
  const listing = REDEMPTIONS.find(entry => entry.itemId === itemId);
  if (!item || !listing) return error(save, "not-redeemable");
  if (save.glow < listing.price) return error(save, "insufficient", listing.price - save.glow);
  const awarded = addItem(save, item);
  return {
    save: { ...awarded.save, glow: save.glow - listing.price },
    event: { type: "redeemed", itemId, isNew: awarded.isNew, completedCollection: awarded.completedCollection },
  };
}

export function applyOdditiesAction(save: OdditiesSave, action: OdditiesAction, random: Random = Math.random): Result {
  if (action.type === "reset") return { save: createOdditiesSave(random, save.epoch + 1), event: { type: "reset" } };
  if (action.type === "collect") {
    if (save.pending?.id !== action.receiptId) return error(save, "no-pending");
    return { save: { ...save, pending: null }, event: { type: "collected" } };
  }
  if (save.pending) return error(save, "pending");

  switch (action.type) {
    case "exchange": return exchange(save, action.merchant, action.quoteId, random);
    case "explore": return explore(save, random);
    case "recycle": return recycle(save, action.itemId);
    case "redeem": return redeem(save, action.itemId);
  }
}

export function odditiesStorageKey(playerId: string) {
  return `cloud-temple-oddities:v1:${playerId}`;
}

export function readOdditiesSave(playerId: string): OdditiesSave {
  const key = odditiesStorageKey(playerId);
  const memory = memoryOnlySaves.get(key);
  if (memory) return memory;
  const defaults = playerDefaults(playerId);
  try {
    const stored = globalThis.localStorage.getItem(key);
    return stored === null ? defaults : normalizeOdditiesSave(JSON.parse(stored), defaults);
  } catch {
    return defaults;
  }
}

export async function transactOddities(playerId: string, action: OdditiesAction, random: Random = Math.random): Promise<OdditiesTransaction> {
  const key = odditiesStorageKey(playerId);
  function transaction(): OdditiesTransaction {
    const before = readOdditiesSave(playerId);
    const result = applyOdditiesAction(before, action, random);
    if (before !== result.save) {
      try {
        // The cost, awarded inventory, pity, next quote, and receipt commit together.
        globalThis.localStorage.setItem(key, JSON.stringify(result.save));
        memoryOnlySaves.delete(key);
      } catch {
        memoryOnlySaves.set(key, result.save);
      }
    }
    return { ...result, persisted: !memoryOnlySaves.has(key) };
  }

  const locks = globalThis.navigator?.locks;
  // The callback has no awaits. Web Locks also keep racing tabs from reading the same quote.
  return locks ? locks.request(key, transaction) : transaction();
}
