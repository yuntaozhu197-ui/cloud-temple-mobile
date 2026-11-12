export function createTempleLanterns(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS temple_sky_wishes (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES community_users(id),
    wish TEXT NOT NULL, created_at INTEGER NOT NULL
  ); CREATE INDEX IF NOT EXISTS sky_wish_owner ON temple_sky_wishes(user_id, created_at);`);
  const find = database.prepare("SELECT user_id AS userId FROM temple_sky_wishes WHERE id = ?");
  const latest = database.prepare("SELECT created_at AS createdAt FROM temple_sky_wishes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1");
  const insert = database.prepare("INSERT INTO temple_sky_wishes(id,user_id,wish,created_at) VALUES(?,?,?,?)");
  const mine = database.prepare("SELECT id,wish,created_at AS createdAt FROM temple_sky_wishes WHERE user_id = ? ORDER BY created_at DESC LIMIT 30");
  return {
    snapshot(identity) { return { wishes: mine.all(identity.id) }; },
    act(identity, body, timestamp) {
      const invalid = (message, status = 400) => ({ error: "invalid_lantern", message, status });
      if (body.action !== "release" || typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.requestId)) return invalid("请重新打开孔明灯许愿台。");
      if (typeof body.wish !== "string" || !body.wish.trim() || Array.from(body.wish).length > 300 || /\p{Cc}/u.test(body.wish.replace(/[\n\t]/g, ""))) return invalid("请写下300字以内的心愿。");
      const existing = find.get(body.requestId);
      if (existing) return existing.userId === identity.id ? null : invalid("请重新放飞这盏灯。", 409);
      const previous = latest.get(identity.id);
      if (previous && timestamp - previous.createdAt < 4000) return invalid("上一盏灯正缓缓升起，稍等片刻再放飞。", 429);
      insert.run(body.requestId, identity.id, body.wish.trim(), timestamp);
      return null;
    },
  };
}
