import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const SESSION_COOKIE = "yunjian_admin";
const SESSION_PATH = "/api/admin";
const SESSION_LENGTH = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW = 10 * 60 * 1000;
const LOGIN_ATTEMPTS = 8;
const MAX_ATTEMPT_BUCKETS = 2048;
const MAX_SEEN_PLAYERS = 8192;
const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_OFFSET = 8 * 60 * 60 * 1000;
const VISIT_RETENTION_DAYS = 90;
const FEEDBACK_PAGE_SIZE = 20;
const EXPORT_BATCH_SIZE = 100;
const CAT_GAME_HISTORY_DAYS = 30;
const CAT_GAME_RATE_WINDOW = 60_000;
const CAT_GAME_RATE_LIMIT = 24;
const CAT_GAME_EVENTS = ["start", "complete", "share"];
const PRIVATE_JSON = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

const dayNumber = timestamp => Math.floor((timestamp + BEIJING_OFFSET) / DAY_MS);
const dayLabel = day => new Date(day * DAY_MS).toISOString().slice(0, 10);
const digest = value => createHash("sha256").update(value).digest();

function sendJson(response, status, body) {
  response.writeHead(status, PRIVATE_JSON);
  response.end(JSON.stringify(body));
}

function fail(response, status, error, message) {
  sendJson(response, status, { error, message });
}

function sessionCookie(request, token, maxAge) {
  const secure = Boolean(request.socket.encrypted) || request.headers["x-forwarded-proto"]?.split(",")[0].trim() === "https";
  return `${SESSION_COOKIE}=${token}; Path=${SESSION_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

function loginAddress(request) {
  // Reverse proxies append the address they actually connected to at the end.
  const forwarded = request.headers["x-forwarded-for"]?.split(",").at(-1)?.trim();
  return isIP(forwarded ?? "") ? forwarded : request.socket.remoteAddress ?? "unknown";
}

export function createTempleAdmin(database, { credentialHash, now = Date.now, trialMode = false } = {}) {
  const enabled = typeof credentialHash === "string" && /^[0-9a-f]{64}$/i.test(credentialHash);
  const expected = enabled ? Buffer.from(credentialHash, "hex") : null;
  const signingKey = expected && createHmac("sha256", expected).update("cloud-temple-admin-session-v1").digest();
  database.exec(`
    CREATE TABLE IF NOT EXISTS temple_admin_tracking (
      id INTEGER PRIMARY KEY CHECK (id = 1), started_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS temple_player_days (
      day INTEGER NOT NULL, player_key TEXT NOT NULL, PRIMARY KEY (day, player_key)
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS temple_cat_events (
      player_key TEXT NOT NULL,
      challenge_day INTEGER NOT NULL,
      event TEXT NOT NULL CHECK (event IN ('start', 'complete', 'share')),
      activity_day INTEGER NOT NULL,
      PRIMARY KEY (player_key, challenge_day, event, activity_day)
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS temple_cat_event_activity ON temple_cat_events(activity_day, event, player_key);
    CREATE TABLE IF NOT EXISTS temple_admin_sessions (
      token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS temple_admin_session_expiry ON temple_admin_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS temple_feedback_recent ON temple_feedback(created_at DESC, id);
  `);
  database.prepare("INSERT OR IGNORE INTO temple_admin_tracking (id, started_at) VALUES (1, ?)").run(now());
  const trackingSince = database.prepare("SELECT started_at AS startedAt FROM temple_admin_tracking WHERE id = 1").get().startedAt;
  const query = {
    visit: database.prepare("INSERT OR IGNORE INTO temple_player_days (day, player_key) VALUES (?, ?)"),
    pruneVisits: database.prepare("DELETE FROM temple_player_days WHERE day < ?"),
    playerCount: database.prepare("SELECT COUNT(DISTINCT player_key) AS count FROM temple_player_days WHERE day BETWEEN ? AND ?"),
    dailyCount: database.prepare("SELECT day, COUNT(*) AS players FROM temple_player_days WHERE day BETWEEN ? AND ? GROUP BY day"),
    catEvent: database.prepare("INSERT OR IGNORE INTO temple_cat_events (player_key, challenge_day, event, activity_day) VALUES (?, ?, ?, ?)"),
    catPriorEvent: database.prepare("SELECT 1 FROM temple_cat_events WHERE player_key = ? AND challenge_day = ? AND event = ? AND activity_day <= ? LIMIT 1"),
    catCounts: database.prepare(`SELECT event, COUNT(DISTINCT player_key) AS count FROM temple_cat_events
      WHERE activity_day BETWEEN ? AND ? GROUP BY event`),
    pruneCatEvents: database.prepare("DELETE FROM temple_cat_events WHERE activity_day < ?"),
    feedbackTotal: database.prepare("SELECT COUNT(*) AS count FROM temple_feedback"),
    feedback: database.prepare(`SELECT f.id, u.name AS authorName, f.message, f.created_at AS createdAt
      FROM temple_feedback AS f JOIN community_users AS u ON u.id = f.user_id
      ORDER BY f.created_at DESC, f.id LIMIT ? OFFSET ?`),
    lastFeedbackRow: database.prepare("SELECT COALESCE(MAX(rowid), 0) AS lastRow FROM temple_feedback"),
    exportFeedback: database.prepare(`SELECT f.rowid AS rowIndex, u.name AS authorName, f.message, f.created_at AS createdAt
      FROM temple_feedback AS f JOIN community_users AS u ON u.id = f.user_id
      WHERE f.rowid > ? AND f.rowid <= ? ORDER BY f.rowid LIMIT ?`),
    createSession: database.prepare("INSERT INTO temple_admin_sessions (token_hash, expires_at) VALUES (?, ?)"),
    activeSession: database.prepare("SELECT 1 FROM temple_admin_sessions WHERE token_hash = ? AND expires_at > ?"),
    revokeSession: database.prepare("DELETE FROM temple_admin_sessions WHERE token_hash = ?"),
    pruneSessions: database.prepare("DELETE FROM temple_admin_sessions WHERE expires_at <= ?"),
  };
  const loginAttempts = new Map();
  const seenPlayers = new Set();
  const catGameRequests = new Map();
  let seenDay;
  let catPrunedDay;

  function recordVisit(identity, timestamp = now()) {
    if (typeof identity?.id !== "string" || !identity.id || !Number.isFinite(timestamp)) return;
    const day = dayNumber(timestamp);
    if (day !== seenDay) {
      query.pruneVisits.run(day - VISIT_RETENTION_DAYS + 1);
      seenPlayers.clear();
      seenDay = day;
    }
    if (seenPlayers.has(identity.id)) return;
    const playerKey = digest(`cloud-temple-player-day:${identity.id}`).toString("hex");
    query.visit.run(day, playerKey);
    if (seenPlayers.size >= MAX_SEEN_PLAYERS) seenPlayers.delete(seenPlayers.values().next().value);
    seenPlayers.add(identity.id);
  }

  function recordCatGame(identity, { day, event }, timestamp = now()) {
    const phase = CAT_GAME_EVENTS.indexOf(event);
    if (phase < 0) return { status: 400, error: "invalid_cat_game_event" };

    const today = dayNumber(timestamp);
    const challengeDay = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(day) / DAY_MS : NaN;
    if (!Number.isInteger(challengeDay) || challengeDay < today - CAT_GAME_HISTORY_DAYS + 1 || challengeDay > today || dayLabel(challengeDay) !== day) {
      return { status: 400, error: "invalid_cat_game_day" };
    }

    let bucket = catGameRequests.get(identity.id);
    if (!bucket || bucket.until <= timestamp) {
      if (!bucket && catGameRequests.size >= MAX_SEEN_PLAYERS) catGameRequests.delete(catGameRequests.keys().next().value);
      bucket = { count: 0, until: timestamp + CAT_GAME_RATE_WINDOW };
      catGameRequests.set(identity.id, bucket);
    }
    if (bucket.count >= CAT_GAME_RATE_LIMIT) {
      return { status: 429, error: "cat_game_rate_limited", retryAfter: Math.ceil((bucket.until - timestamp) / 1000) };
    }
    bucket.count += 1;

    if (catPrunedDay !== today) {
      query.pruneCatEvents.run(today - VISIT_RETENTION_DAYS + 1);
      catPrunedDay = today;
    }
    const playerKey = digest(`cloud-temple-cat-game:${identity.id}`).toString("hex");
    if (phase > 0 && !query.catPriorEvent.get(playerKey, challengeDay, CAT_GAME_EVENTS[phase - 1], today)) {
      return { status: 409, error: "cat_game_sequence" };
    }
    query.catEvent.run(playerKey, challengeDay, event, today);
    return null;
  }

  function catGameCounts(firstDay, lastDay) {
    const counts = new Map(query.catCounts.all(firstDay, lastDay).map(row => [row.event, row.count]));
    return { started: counts.get("start") ?? 0, completed: counts.get("complete") ?? 0, shared: counts.get("share") ?? 0 };
  }

  function metricsAt(timestamp, onlineCount) {
    const today = dayNumber(timestamp);
    const firstDay = today - 6;
    const counts = new Map(query.dailyCount.all(firstDay, today).map(row => [row.day, row.players]));
    const daily = Array.from({ length: 7 }, (_, index) => {
      const day = firstDay + index;
      return { date: dayLabel(day), players: counts.get(day) ?? 0 };
    });
    return {
      online: onlineCount,
      today: counts.get(today) ?? 0,
      last7Days: query.playerCount.get(firstDay, today).count,
      last30Days: query.playerCount.get(today - 29, today).count,
      daily,
      trackingSince,
      catGame: { today: catGameCounts(today, today), last7Days: catGameCounts(firstDay, today) },
    };
  }

  function snapshot(timestamp = now(), onlineCount = 0, offset = 0) {
    const total = query.feedbackTotal.get().count;
    const lastPage = Math.floor(Math.max(0, total - 1) / FEEDBACK_PAGE_SIZE) * FEEDBACK_PAGE_SIZE;
    const pageOffset = Math.min(offset, lastPage);
    return {
      metrics: metricsAt(timestamp, onlineCount),
      feedback: { entries: query.feedback.all(FEEDBACK_PAGE_SIZE, pageOffset), total, offset: pageOffset, limit: FEEDBACK_PAGE_SIZE },
      trial: { temporaryRecords: trialMode },
    };
  }

  async function exportDashboard(response, timestamp, onlineCount) {
    const metrics = metricsAt(timestamp, onlineCount);
    const { lastRow } = query.lastFeedbackRow.get();
    function* json() {
      yield `{"exportedAt":${timestamp},"metrics":${JSON.stringify(metrics)},"feedback":[`;
      let rowIndex = 0;
      while (rowIndex < lastRow) {
        const rows = query.exportFeedback.all(rowIndex, lastRow, EXPORT_BATCH_SIZE);
        if (!rows.length) break;
        const entries = rows.map(({ rowIndex: _rowIndex, ...entry }) => JSON.stringify(entry));
        yield `${rowIndex > 0 ? "," : ""}${entries.join(",")}`;
        rowIndex = rows.at(-1).rowIndex;
      }
      yield "]}";
    }
    response.writeHead(200, {
      ...PRIVATE_JSON,
      "Content-Disposition": `attachment; filename="yunjian-${dayLabel(dayNumber(timestamp))}.json"`,
    });
    await pipeline(Readable.from(json()), response);
  }

  function sign(nonce) {
    return createHmac("sha256", signingKey).update(nonce).digest();
  }

  function readSession(request, timestamp) {
    const token = request.headers.cookie?.split(";").map(value => value.trim())
      .find(value => value.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    if (!token || !/^[0-9a-f]{64}\.[0-9a-f]{64}$/.test(token)) return null;
    const [nonce, signature] = token.split(".");
    if (!timingSafeEqual(sign(nonce), Buffer.from(signature, "hex"))) return null;
    const tokenHash = digest(nonce).toString("hex");
    return query.activeSession.get(tokenHash, timestamp) ? tokenHash : null;
  }

  function loginBucket(address, timestamp) {
    const existing = loginAttempts.get(address);
    if (existing?.until > timestamp) return existing;
    if (loginAttempts.size >= MAX_ATTEMPT_BUCKETS) {
      for (const [key, attempts] of loginAttempts) if (attempts.until <= timestamp) loginAttempts.delete(key);
      if (loginAttempts.size >= MAX_ATTEMPT_BUCKETS) loginAttempts.delete(loginAttempts.keys().next().value);
    }
    const bucket = { failures: 0, until: timestamp + LOGIN_WINDOW };
    loginAttempts.set(address, bucket);
    return bucket;
  }

  async function handleSession(request, response, readJson, sameOrigin) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      fail(response, 405, "method_not_allowed", "请通过管理页面登录。");
      return;
    }
    if (!enabled) {
      request.resume();
      fail(response, 503, "admin_disabled", "管理员入口尚未启用。");
      return;
    }
    if (!sameOrigin(request) || request.headers["sec-fetch-site"] === "cross-site") {
      request.resume();
      fail(response, 403, "invalid_origin", "请在云间寺管理页面操作。");
      return;
    }
    if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
      request.resume();
      fail(response, 415, "invalid_content_type", "请通过管理页面提交登录请求。");
      return;
    }
    let body;
    try { body = await readJson(request); }
    catch {
      fail(response, 400, "invalid_request", "登录信息未能读取，请重试。");
      return;
    }
    const timestamp = now();
    if (body.action === "logout") {
      const session = readSession(request, timestamp);
      if (session) query.revokeSession.run(session);
      response.setHeader("Set-Cookie", sessionCookie(request, "", 0));
      sendJson(response, 200, { authenticated: false });
      return;
    }
    if (body.action !== "login") {
      fail(response, 400, "invalid_action", "请通过管理页面登录。");
      return;
    }
    const address = loginAddress(request);
    const bucket = loginBucket(address, timestamp);
    if (bucket.failures >= LOGIN_ATTEMPTS) {
      response.setHeader("Retry-After", String(Math.ceil((bucket.until - timestamp) / 1000)));
      fail(response, 429, "admin_rate_limited", "尝试次数过多，请稍后再试。");
      return;
    }
    const validInput = typeof body.passcode === "string" && body.passcode.length > 0 && body.passcode.length <= 256;
    const supplied = digest(validInput ? body.passcode : "");
    if (!timingSafeEqual(supplied, expected) || !validInput) {
      bucket.failures += 1;
      fail(response, 401, "admin_authentication_required", "管理员登录码有误。");
      return;
    }
    loginAttempts.delete(address);
    query.pruneSessions.run(timestamp);
    const previous = readSession(request, timestamp);
    if (previous) query.revokeSession.run(previous);
    const nonce = randomBytes(32).toString("hex");
    const token = `${nonce}.${sign(nonce).toString("hex")}`;
    query.createSession.run(digest(nonce).toString("hex"), timestamp + SESSION_LENGTH);
    response.setHeader("Set-Cookie", sessionCookie(request, token, SESSION_LENGTH / 1000));
    sendJson(response, 200, { authenticated: true });
  }

  async function handleApi(request, response, pathname, onlineCount) {
    if (pathname !== "/api/admin/dashboard" && pathname !== "/api/admin/export") {
      request.resume();
      fail(response, 404, "not_found", "找不到这个管理页面。");
      return;
    }
    if (request.method !== "GET") {
      request.resume();
      response.setHeader("Allow", "GET");
      fail(response, 405, "method_not_allowed", "请在管理页面查看记录。");
      return;
    }
    if (!enabled) {
      fail(response, 503, "admin_disabled", "管理员入口尚未启用。");
      return;
    }
    const timestamp = now();
    if (!readSession(request, timestamp)) {
      fail(response, 401, "admin_authentication_required", "请先登录管理页面。");
      return;
    }
    if (pathname === "/api/admin/export") {
      await exportDashboard(response, timestamp, onlineCount);
      return;
    }
    const offset = Number(new URL(request.url, "http://localhost").searchParams.get("offset") ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) {
      fail(response, 400, "invalid_offset", "请重新选择留言页码。");
      return;
    }
    sendJson(response, 200, snapshot(timestamp, onlineCount, offset));
  }

  return { enabled, recordVisit, recordCatGame, snapshot, handleSession, handleApi };
}
