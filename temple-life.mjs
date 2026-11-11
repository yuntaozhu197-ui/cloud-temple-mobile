import { randomUUID } from "node:crypto";

const validId = value => typeof value === "string" && /^[a-f0-9-]{16,64}$/i.test(value);
const length = value => Array.from(value).length;
const invalid = (message, status = 400) => ({ message, status, error: "invalid_life_action" });
const text = (value, maximum, allowEmpty = false) => typeof value === "string" &&
  (allowEmpty || value.trim().length > 0) && length(value) <= maximum;

export function createTempleLife(database, { trialMode }) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS temple_diaries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES community_users(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS diary_owner ON temple_diaries(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS diary_public ON temple_diaries(visibility, updated_at);
    CREATE TABLE IF NOT EXISTS temple_life_offerings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES community_users(id),
      kind TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      intention TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS life_offering_user ON temple_life_offerings(user_id, kind, created_at);
    CREATE TABLE IF NOT EXISTS temple_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES community_users(id),
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS feedback_owner ON temple_feedback(user_id, created_at);
  `);
  const query = {
    user: database.prepare("SELECT id, name FROM community_users WHERE id = ?"),
    rename: database.prepare("UPDATE community_users SET name = ? WHERE id = ?"),
    diary: database.prepare("SELECT user_id AS userId FROM temple_diaries WHERE id = ?"),
    mine: database.prepare(`SELECT id, title, body, visibility, updated_at AS updatedAt
      FROM temple_diaries WHERE user_id = ? ORDER BY updated_at DESC, id LIMIT 100`),
    publicEntries: database.prepare(`SELECT d.id, d.title, d.body, d.user_id AS authorId,
      u.name AS authorName, d.updated_at AS updatedAt FROM temple_diaries d
      JOIN community_users u ON u.id = d.user_id WHERE d.visibility = 'public'
      ORDER BY d.updated_at DESC, d.id LIMIT 30`),
    countMine: database.prepare("SELECT COUNT(*) AS count FROM temple_diaries WHERE user_id = ?"),
    saveDiary: database.prepare(`INSERT INTO temple_diaries (id, user_id, title, body, visibility, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, body = excluded.body, visibility = excluded.visibility, updated_at = excluded.updated_at
      WHERE temple_diaries.user_id = excluded.user_id`),
    deleteDiary: database.prepare("DELETE FROM temple_diaries WHERE id = ? AND user_id = ?"),
    offering: database.prepare("SELECT user_id AS userId, kind FROM temple_life_offerings WHERE id = ?"),
    lastOffering: database.prepare("SELECT created_at AS createdAt FROM temple_life_offerings WHERE user_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1"),
    addOffering: database.prepare("INSERT INTO temple_life_offerings (id, user_id, kind, amount, intention, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
    totals: database.prepare(`SELECT
      COALESCE(SUM(kind = 'flower'), 0) AS flowers,
      COALESCE(SUM(CASE WHEN kind = 'sponsor' THEN amount ELSE 0 END), 0) AS totalSponsor,
      COALESCE(SUM(kind = 'ritual'), 0) AS rituals,
      COALESCE(SUM(kind = 'flower' AND user_id = ?), 0) AS mineFlowers,
      COALESCE(SUM(CASE WHEN kind = 'sponsor' AND user_id = ? THEN amount ELSE 0 END), 0) AS mineSponsor,
      COALESCE(SUM(kind = 'ritual' AND user_id = ?), 0) AS mineRituals FROM temple_life_offerings`),
    feedback: database.prepare("SELECT user_id AS userId FROM temple_feedback WHERE id = ?"),
    feedbackCount: database.prepare("SELECT COUNT(*) AS count FROM temple_feedback WHERE user_id = ?"),
    lastFeedback: database.prepare("SELECT created_at AS createdAt FROM temple_feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"),
    addFeedback: database.prepare("INSERT INTO temple_feedback (id, user_id, message, created_at) VALUES (?, ?, ?, ?)"),
  };

  function snapshot(identity) {
    return {
      self: query.user.get(identity.id),
      mine: query.mine.all(identity.id),
      publicEntries: query.publicEntries.all(),
      offerings: query.totals.get(identity.id, identity.id, identity.id),
      feedbackCount: query.feedbackCount.get(identity.id).count,
      trial: { temporaryRecords: trialMode },
    };
  }

  function act(identity, body, timestamp) {
    if (body.action === "profile") {
      const name = typeof body.name === "string" ? body.name.normalize("NFC").trim() : "";
      if (!name || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(body.name)) {
        return invalid("请填写昵称，避免换行和控制字符。");
      }
      query.rename.run(name, identity.id);
      identity.name = name;
      return null;
    }
    if (body.action === "saveDiary") {
      if (!text(body.title, 60) || !text(body.body, 2000) || !["private", "public"].includes(body.visibility)) {
        return invalid("标题需1至60字，日记需1至2000字，并选择公开或私密。");
      }
      const id = body.id ?? randomUUID();
      if (!validId(id)) return invalid("日记编号无效，请重新打开编辑。");
      const existing = query.diary.get(id);
      if (existing && existing.userId !== identity.id) return invalid("只能编辑自己的日记。", 403);
      if (!existing && query.countMine.get(identity.id).count >= 100) return invalid("已保存100篇日记，请先导出并整理旧日记。", 409);
      query.saveDiary.run(id, identity.id, body.title.trim(), body.body.trim(), body.visibility, timestamp);
      return null;
    }
    if (body.action === "deleteDiary") {
      if (!validId(body.id)) return invalid("请先选择一篇日记。");
      const existing = query.diary.get(body.id);
      if (existing && existing.userId !== identity.id) return invalid("只能删除自己的日记。", 403);
      query.deleteDiary.run(body.id, identity.id);
      return null;
    }
    if (body.action === "feedback") {
      if (!text(body.message, 1000) || !validId(body.requestId)) return invalid("建议请填写1至1000字。");
      const existing = query.feedback.get(body.requestId);
      if (existing) return existing.userId === identity.id ? null : invalid("请重新提交建议。", 409);
      const previous = query.lastFeedback.get(identity.id);
      if (previous && timestamp - previous.createdAt < 10_000) return invalid("建议已收到，稍等片刻再补充吧。", 429);
      query.addFeedback.run(body.requestId, identity.id, body.message.trim(), timestamp);
      return null;
    }
    if (!["flower", "sponsor", "ritual"].includes(body.action)) return invalid("请选择一种心居操作。");
    if (body.action === "sponsor" && ![10, 50, 100].includes(body.amount)) return invalid("请选择10、50或100随喜值。");
    if (body.action === "ritual" && (!["平安祈愿", "追思祝福", "感恩回向"].includes(body.kind) || !text(body.intention, 120, true))) {
      return invalid("请选择祈愿类型，心愿可留空或填写120字以内。");
    }
    const id = body.requestId ?? (body.action === "flower" ? randomUUID() : undefined);
    if (!validId(id)) return invalid("请重新打开这次随喜体验。");
    const existing = query.offering.get(id);
    if (existing) return existing.userId === identity.id && existing.kind === body.action ? null : invalid("这次记录已有其他用途，请重新操作。", 409);
    const previous = query.lastOffering.get(identity.id, body.action);
    const cooldown = body.action === "ritual" ? 30_000 : 5_000;
    if (previous && timestamp - previous.createdAt < cooldown) return invalid("心意已经送达，静心片刻再来吧。", 429);
    const intention = body.action === "ritual" ? JSON.stringify({ kind: body.kind, text: body.intention.trim() }) : "";
    query.addOffering.run(id, identity.id, body.action, body.action === "sponsor" ? body.amount : 0, intention, timestamp);
    return null;
  }

  return { snapshot, act };
}
