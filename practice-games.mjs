const thresholds = {
  wood: [0, 10, 20, 50, 100],
  beads: [0, 5, 10, 20, 50],
  flower: [0, 3, 5, 10, 20],
};
const kinds = Object.keys(thresholds);
const validId = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const invalid = (message, status = 400) => ({ error: "invalid_practice_game_action", status, message });
const validReceipt = (receipt, timestamp) => receipt && validId(receipt.requestId) && kinds.includes(receipt.kind)
  && Number.isSafeInteger(receipt.completedAt) && receipt.completedAt >= 0 && receipt.completedAt <= timestamp;

export function createPracticeGames(database, { trialMode = false } = {}) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS temple_practice_receipts (
      request_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES community_users(id),
      kind TEXT NOT NULL CHECK (kind IN ('wood', 'beads', 'flower')),
      completed_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS temple_practice_user ON temple_practice_receipts(user_id, kind, completed_at);
  `);
  const query = {
    receipt: database.prepare("SELECT user_id AS userId, kind, completed_at AS completedAt FROM temple_practice_receipts WHERE request_id = ?"),
    count: database.prepare("SELECT COUNT(*) AS total FROM temple_practice_receipts WHERE user_id = ? AND kind = ?"),
    receipts: database.prepare("SELECT request_id AS requestId, kind, completed_at AS completedAt FROM temple_practice_receipts WHERE user_id = ? ORDER BY completed_at, rowid"),
    add: database.prepare("INSERT INTO temple_practice_receipts (request_id, user_id, kind, completed_at) VALUES (?, ?, ?, ?)"),
  };

  function snapshot(identity) {
    const games = Object.fromEntries(kinds.map(kind => {
      const score = Math.min(query.count.get(identity.id, kind).total, thresholds[kind].at(-1));
      return [kind, { score, tier: thresholds[kind].findLastIndex(points => score >= points) }];
    }));
    return { games, receipts: query.receipts.all(identity.id), trial: { temporaryRecords: trialMode } };
  }

  function addReceipt(identity, receipt) {
    const existing = query.receipt.get(receipt.requestId);
    if (existing) return existing.userId === identity.id && existing.kind === receipt.kind && existing.completedAt === receipt.completedAt
      ? null : invalid("这条修行记录已有其他用途，请重新完成一次动作。", 409);
    if (query.count.get(identity.id, receipt.kind).total >= thresholds[receipt.kind].at(-1)) return null;
    query.add.run(receipt.requestId, identity.id, receipt.kind, receipt.completedAt);
    return null;
  }

  function act(identity, body, timestamp = Date.now()) {
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.hasOwn(body, "score") || Object.hasOwn(body, "tier")) return invalid("完成一次动作，会自动累计一点修行进度。");
    const receipts = body.action === "record" ? [body.receipt] : body.receipts;
    if (!["record", "recordMany", "restore"].includes(body.action) || !Array.isArray(receipts) || receipts.length > 40 || receipts.some(receipt => !validReceipt(receipt, timestamp))) {
      return invalid("修行记录格式无效，请重新打开小游戏。");
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const receipt of [...receipts].sort((left, right) => left.completedAt - right.completedAt)) {
        const failure = addReceipt(identity, receipt);
        if (failure) { database.exec("ROLLBACK"); return failure; }
      }
      database.exec("COMMIT");
      return null;
    } catch (failure) {
      database.exec("ROLLBACK");
      throw failure;
    }
  }

  return { snapshot, act };
}
