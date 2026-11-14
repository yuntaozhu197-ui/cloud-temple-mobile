const species = [
  { id: "fish", points: 0 },
  { id: "koi", points: 5 },
  { id: "goldfish", points: 10 },
  { id: "turtle", points: 15 },
  { id: "frog", points: 20 },
  { id: "butterfly", points: 25 },
];
const validId = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const invalid = (message, status = 400) => ({ error: "invalid_pond_action", status, message });

export function createPondGame(database, { trialMode = false } = {}) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS temple_pond_releases (
      request_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES community_users(id),
      species TEXT NOT NULL CHECK (species IN ('fish', 'koi', 'goldfish', 'turtle', 'frog', 'butterfly')),
      released_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS temple_pond_user ON temple_pond_releases(user_id, released_at);
  `);
  const query = {
    release: database.prepare("SELECT user_id AS userId, species FROM temple_pond_releases WHERE request_id = ?"),
    count: database.prepare("SELECT COUNT(*) AS total FROM temple_pond_releases WHERE user_id = ?"),
    counts: database.prepare("SELECT species, COUNT(*) AS total FROM temple_pond_releases WHERE user_id = ? GROUP BY species"),
    releases: database.prepare("SELECT request_id AS requestId, species, released_at AS releasedAt FROM temple_pond_releases WHERE user_id = ? ORDER BY released_at, rowid"),
    add: database.prepare("INSERT INTO temple_pond_releases (request_id, user_id, species, released_at) VALUES (?, ?, ?, ?)"),
  };

  function snapshot(identity) {
    const score = query.count.get(identity.id).total;
    const counts = Object.fromEntries(species.map(item => [item.id, 0]));
    for (const item of query.counts.all(identity.id)) counts[item.species] = item.total;
    return {
      score, counts,
      unlocked: species.filter(item => score >= item.points).map(item => item.id),
      releases: query.releases.all(identity.id),
      trial: { temporaryRecords: trialMode },
    };
  }

  function addRelease(identity, record, timestamp) {
    const existing = query.release.get(record.requestId);
    if (existing) return existing.userId === identity.id && existing.species === record.species
      ? null : invalid("这次放生记录已有其他用途，请重新操作。", 409);
    const animal = species.find(item => item.id === record.species);
    const score = query.count.get(identity.id).total;
    if (score < animal.points) return invalid(`达到${animal.points}分后才能解锁这种生物。`, 409);
    query.add.run(record.requestId, identity.id, record.species, timestamp);
    return null;
  }

  function transaction(work) {
    database.exec("BEGIN IMMEDIATE");
    try {
      const failure = work();
      database.exec(failure ? "ROLLBACK" : "COMMIT");
      return failure;
    } catch (failure) {
      database.exec("ROLLBACK");
      throw failure;
    }
  }

  function act(identity, body, timestamp = Date.now()) {
    if (!body || typeof body !== "object" || Object.hasOwn(body, "score")) return invalid("每次放生会自动累计一分。");
    if (body.action === "release") {
      if (!validId(body.requestId) || !species.some(item => item.id === body.species)) return invalid("请选择已解锁的生物，再放生一次。");
      return transaction(() => addRelease(identity, body, timestamp));
    }
    if (body.action === "restore") {
      if (!Array.isArray(body.releases) || body.releases.length > 100 || body.releases.some(record => !validId(record?.requestId) || !species.some(item => item.id === record.species) || !Number.isSafeInteger(record.releasedAt) || record.releasedAt < 0 || record.releasedAt > timestamp)) {
        return invalid("放生存档格式无效，请重新打开积分记录。");
      }
      return transaction(() => {
        for (const record of [...body.releases].sort((a, b) => a.releasedAt - b.releasedAt)) {
          const failure = addRelease(identity, record, record.releasedAt);
          if (failure) return failure;
        }
        return null;
      });
    }
    return invalid("请选择放生或恢复本机记录。");
  }

  return { snapshot, act };
}
