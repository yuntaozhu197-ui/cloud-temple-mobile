const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
});

function templeDay(timestamp) {
  const parts = Object.fromEntries(dayFormatter.formatToParts(timestamp).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validDay(value) {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const invalid = message => ({ error: "invalid_lamp_action", status: 400, message });

export function createTempleLamps(database, { trialMode = false } = {}) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS temple_lamp_wishes (
      user_id TEXT PRIMARY KEY REFERENCES community_users(id),
      wish TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS temple_lamp_days (
      user_id TEXT NOT NULL REFERENCES community_users(id),
      lamp_day TEXT NOT NULL,
      makeup INTEGER NOT NULL CHECK (makeup IN (0, 1)),
      lit_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, lamp_day)
    );
  `);
  const query = {
    wish: database.prepare("SELECT wish AS text, updated_at AS updatedAt FROM temple_lamp_wishes WHERE user_id = ?"),
    saveWish: database.prepare(`INSERT INTO temple_lamp_wishes (user_id, wish, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET wish = excluded.wish, updated_at = excluded.updated_at`),
    days: database.prepare(`SELECT lamp_day AS day, makeup, lit_at AS litAt FROM temple_lamp_days
      WHERE user_id = ? AND lamp_day >= ? ORDER BY lamp_day DESC`),
    today: database.prepare("SELECT lamp_day AS day FROM temple_lamp_days WHERE user_id = ? AND lamp_day = ?"),
    count: database.prepare("SELECT COUNT(*) AS total FROM temple_lamp_days WHERE user_id = ?"),
    light: database.prepare(`INSERT INTO temple_lamp_days (user_id, lamp_day, makeup, lit_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(user_id, lamp_day) DO NOTHING`),
  };

  function snapshot(identity, timestamp = Date.now()) {
    const today = templeDay(timestamp);
    const recentStart = new Date(`${today}T00:00:00Z`);
    recentStart.setUTCDate(recentStart.getUTCDate() - 29);
    return {
      today,
      timeZone: "Asia/Shanghai",
      wish: query.wish.get(identity.id) ?? { text: "", updatedAt: null },
      litToday: Boolean(query.today.get(identity.id, today)),
      total: query.count.get(identity.id).total,
      days: query.days.all(identity.id, recentStart.toISOString().slice(0, 10)).map(day => ({ ...day, makeup: Boolean(day.makeup) })),
      trial: { temporaryRecords: trialMode },
    };
  }

  function act(identity, body, timestamp = Date.now()) {
    if (body.action === "wish") {
      if (typeof body.wish !== "string" || Array.from(body.wish.trim()).length > 1000 || /\p{Cc}/u.test(body.wish.replace(/[\n\t]/g, ""))) {
        return invalid("心愿请填写1000字以内，避免控制字符。");
      }
      query.saveWish.run(identity.id, body.wish.trim(), timestamp);
      return null;
    }
    if (body.action !== "light") return invalid("请选择保存心愿或点亮长明灯。");
    const today = templeDay(timestamp);
    const day = body.day ?? today;
    if (!validDay(day)) return invalid("请选择有效的点灯日期。");
    if (day > today) return invalid("未来的灯请在当天亲手点亮。");
    query.light.run(identity.id, day, day < today ? 1 : 0, timestamp);
    return null;
  }

  return { snapshot, act };
}
