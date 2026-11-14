const CYCLE_MS = 12 * 60_000;
const VISIBLE_MS = 8 * 60_000;

export const ABBOT_LOCATIONS = [
  { name: "庭院老松旁", x: -11, z: 17 },
  { name: "大殿西廊", x: -15, z: -9 },
  { name: "藏经阁前", x: 14, z: -24 },
  { name: "放生池东岸", x: -19, z: 19 },
  { name: "习武广场边", x: 27, z: 18 },
];

/** Every visitor sees one location for the same server-time encounter. */
export function getAbbotEncounter(timestamp = Date.now()) {
  const cycle = Math.floor(timestamp / CYCLE_MS);
  const appearsAt = cycle * CYCLE_MS;
  let hash = Math.imul(cycle ^ 0x6d2b79f5, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  const location = ABBOT_LOCATIONS[(hash >>> 0) % ABBOT_LOCATIONS.length];
  return {
    id: `abbot-${cycle}`, active: timestamp >= appearsAt && timestamp < appearsAt + VISIBLE_MS,
    location, appearsAt, leavesAt: appearsAt + VISIBLE_MS, nextAppearsAt: appearsAt + CYCLE_MS,
  };
}

const emptyArchive = () => ({ acceptedAt: null, prayerAt: null, flowerAt: null, rewardedAt: null });
const invalid = (message, status = 400) => ({ error: "invalid_abbot_action", status, message });
const validTime = (value, timestamp) => value === null || (Number.isSafeInteger(value) && value >= 0 && value <= timestamp);

function validArchive(archive, timestamp) {
  if (!archive || typeof archive !== "object" || Array.isArray(archive)) return false;
  const values = [archive.acceptedAt, archive.prayerAt, archive.flowerAt, archive.rewardedAt];
  if (!values.every(value => validTime(value, timestamp))) return false;
  if (archive.acceptedAt === null) return values.every(value => value === null);
  if (archive.prayerAt !== null && archive.prayerAt < archive.acceptedAt) return false;
  if (archive.flowerAt !== null && archive.flowerAt < archive.acceptedAt) return false;
  return archive.rewardedAt === null || (archive.prayerAt !== null && archive.flowerAt !== null && archive.rewardedAt >= Math.max(archive.prayerAt, archive.flowerAt));
}

export function createAbbotQuest(database, { trialMode = false } = {}) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS temple_abbot_quests (
      user_id TEXT PRIMARY KEY REFERENCES community_users(id),
      accepted_at INTEGER,
      prayer_at INTEGER,
      flower_at INTEGER,
      rewarded_at INTEGER
    );
  `);
  const query = {
    get: database.prepare("SELECT accepted_at AS acceptedAt, prayer_at AS prayerAt, flower_at AS flowerAt, rewarded_at AS rewardedAt FROM temple_abbot_quests WHERE user_id = ?"),
    save: database.prepare(`INSERT INTO temple_abbot_quests (user_id, accepted_at, prayer_at, flower_at, rewarded_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET accepted_at = excluded.accepted_at,
        prayer_at = excluded.prayer_at, flower_at = excluded.flower_at, rewarded_at = excluded.rewarded_at`),
  };

  function archiveFor(identity) {
    return query.get.get(identity.id) ?? emptyArchive();
  }

  function save(identity, archive) {
    query.save.run(identity.id, archive.acceptedAt, archive.prayerAt, archive.flowerAt, archive.rewardedAt);
  }

  function snapshot(identity, timestamp = Date.now()) {
    const archive = archiveFor(identity);
    return {
      now: timestamp, encounter: getAbbotEncounter(timestamp),
      progress: {
        accepted: archive.acceptedAt !== null, prayer: archive.prayerAt !== null,
        flower: archive.flowerAt !== null, rewarded: archive.rewardedAt !== null,
      },
      archive,
      trial: { temporaryRecords: trialMode },
    };
  }

  function act(identity, body, timestamp = Date.now()) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("请重新与住持交谈。");
    if (body.action === "restore") {
      if (!validArchive(body.archive, timestamp)) return invalid("住持奇遇存档格式无效，请重新进入寺庙。");
      const saved = archiveFor(identity);
      // Retain the earliest confirmation for every step. Completed steps remain
      // monotonic and event timestamps preserve their prerequisite ordering.
      const restored = Object.fromEntries(Object.keys(saved).map(key => {
        const times = [saved[key], body.archive[key]].filter(value => value !== null);
        return [key, times.length ? Math.min(...times) : null];
      }));
      save(identity, restored);
      return null;
    }
    if (!["accept", "prayer", "flower", "complete"].includes(body.action)) return invalid("请选择交谈、合掌、供花或领取住持赠礼。");
    const archive = archiveFor(identity);
    if (archive.rewardedAt !== null) return null;
    if (body.action === "accept" || body.action === "complete") {
      const encounter = getAbbotEncounter(timestamp);
      if (!encounter.active || body.encounterId !== encounter.id) return invalid("住持已经移步云游，请等下一次现身后再来交谈。", 409);
    }
    if (body.action === "accept") {
      archive.acceptedAt ??= timestamp;
      save(identity, archive);
      return null;
    }
    if (archive.acceptedAt === null) return invalid("先找到住持，听他讲完这段因缘，再开始问心小愿。", 409);
    if (body.action === "prayer") archive.prayerAt ??= timestamp;
    if (body.action === "flower") archive.flowerAt ??= timestamp;
    if (body.action === "complete") {
      if (archive.prayerAt === null || archive.flowerAt === null) return invalid("完成一次合掌与一次免费供花，再回来与住持交谈。", 409);
      archive.rewardedAt = timestamp;
    }
    save(identity, archive);
    return null;
  }

  return { snapshot, act };
}
