import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { createReadStream, mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { DatabaseSync } from "node:sqlite";

const COOKIE_NAME = "yunjian_guest";
const SESSION_AGE_MS = 45_000;
const MAX_VISITORS = 128;
const MAX_BODY_BYTES = 1024;
const ACTIONS = new Set(["idle", "prayer", "bow", "beads", "wood", "meditate"]);
const POSITION_KEYS = ["x", "z", "heading"];
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

function secureRequest(request) {
  return Boolean(request.socket.encrypted) ||
    request.headers["x-forwarded-proto"]?.split(",")[0].trim() === "https";
}

function requestIdentity(request) {
  const supplied = request.headers.cookie?.split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  const fresh = !supplied || !/^[a-f0-9]{64}$/.test(supplied);
  const secret = fresh ? randomBytes(32).toString("hex") : supplied;
  const id = createHash("sha256").update(secret).digest("hex");
  const first = ["小", "云", "山", "松", "竹", "月", "星", "茶"];
  const last = ["圆", "觉", "安", "宁", "满", "悟", "明", "和"];
  const name = `${first[parseInt(id.slice(0, 2), 16) % first.length]}${last[parseInt(id.slice(2, 4), 16) % last.length]}·${id.slice(4, 7)}`;
  const secure = secureRequest(request) ? "; Secure" : "";
  return {
    id,
    name,
    cookie: fresh
      ? `${COOKIE_NAME}=${secret}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`
      : undefined,
  };
}

function sendJson(response, data, status = 200, identity) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Vary", "Cookie");
  if (identity?.cookie) response.setHeader("Set-Cookie", identity.cookie);
  response.writeHead(status);
  response.end(JSON.stringify(data));
}

function sameOrigin(request, publicOrigin) {
  if (!request.headers.origin) return true;
  try {
    const protocol = secureRequest(request) ? "https:" : "http:";
    const expected = publicOrigin || `${protocol}//${request.headers.host}`;
    return new URL(request.headers.origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

function readJson(request) {
  if (Number(request.headers["content-length"]) > MAX_BODY_BYTES) {
    request.resume();
    return Promise.reject(new Error("oversized"));
  }
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    request.on("data", chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        chunks.length = 0;
        rejectBody(new Error("oversized"));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          throw new Error("invalid");
        }
        resolveBody(body);
      } catch (error) {
        rejectBody(error);
      }
    });
    request.on("error", rejectBody);
    request.on("aborted", () => rejectBody(new Error("aborted")));
  });
}

function validateUpdate(body) {
  for (const key of POSITION_KEYS) {
    const bound = key === "heading" ? Math.PI * 2 : 15;
    if (Object.hasOwn(body, key) &&
        (typeof body[key] !== "number" || !Number.isFinite(body[key]) || Math.abs(body[key]) > bound)) {
      return { error: "invalid_position", message: "请在寺庙范围内走动。" };
    }
  }
  if (Object.hasOwn(body, "seat") && body.seat !== null &&
      (!Number.isInteger(body.seat) || body.seat < 0 || body.seat > 7)) {
    return { error: "invalid_seat", message: "请选择庭院里的蒲团。" };
  }
  if (Object.hasOwn(body, "action") && !ACTIONS.has(body.action)) {
    return { error: "invalid_action", message: "暂不支持这个动作。" };
  }
  if (Object.hasOwn(body, "meditating") && typeof body.meditating !== "boolean") {
    return { error: "invalid_meditation", message: "请重新选择静坐状态。" };
  }
  if (Object.hasOwn(body, "leave") && typeof body.leave !== "boolean") {
    return { error: "invalid_leave" };
  }
  return null;
}

function updateVisitor(visitor, body) {
  if (Object.hasOwn(body, "seat")) visitor.seat = body.seat;
  for (const key of POSITION_KEYS) {
    if (Object.hasOwn(body, key)) visitor[key] = body[key];
  }
  if (Object.hasOwn(body, "meditating")) {
    visitor.meditating = body.meditating && visitor.seat !== null;
    visitor.action = visitor.meditating
      ? "meditate"
      : body.action && body.action !== "meditate" ? body.action : "idle";
  } else if (Object.hasOwn(body, "action")) {
    visitor.meditating = body.action === "meditate" && visitor.seat !== null;
    visitor.action = body.action === "meditate" && visitor.seat === null ? "idle" : body.action;
  } else if (Object.hasOwn(body, "seat")) {
    visitor.meditating = false;
    visitor.action = "idle";
  }
}

function openCommunityDatabase(dataDir) {
  let filename = ":memory:";
  if (dataDir !== ":memory:") {
    mkdirSync(dataDir, { recursive: true });
    filename = resolve(dataDir, "temple.sqlite");
  }
  const database = new DatabaseSync(filename);
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS community_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL REFERENCES community_users(id),
      to_id TEXT NOT NULL REFERENCES community_users(id),
      pair_low TEXT NOT NULL,
      pair_high TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pending_friend_pair
      ON friend_requests(pair_low, pair_high) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS friend_request_recipient
      ON friend_requests(to_id, status, created_at);
    CREATE INDEX IF NOT EXISTS friend_request_sender
      ON friend_requests(from_id, status, created_at);
    CREATE TABLE IF NOT EXISTS friendships (
      user_low TEXT NOT NULL REFERENCES community_users(id),
      user_high TEXT NOT NULL REFERENCES community_users(id),
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_low, user_high)
    );
    CREATE INDEX IF NOT EXISTS friendship_high_user ON friendships(user_high);
    CREATE TABLE IF NOT EXISTS greetings (
      id INTEGER PRIMARY KEY,
      from_id TEXT NOT NULL REFERENCES community_users(id),
      to_id TEXT NOT NULL REFERENCES community_users(id),
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS greeting_recipient ON greetings(to_id, created_at);
    CREATE INDEX IF NOT EXISTS greeting_pair ON greetings(from_id, to_id, created_at);
    CREATE TABLE IF NOT EXISTS incense_offerings (
      id INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES community_users(id),
      offering_day TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS incense_day ON incense_offerings(offering_day);
    CREATE INDEX IF NOT EXISTS incense_user_day ON incense_offerings(user_id, offering_day);
    CREATE INDEX IF NOT EXISTS incense_user_time ON incense_offerings(user_id, created_at);
  `);
  return database;
}

const offeringDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
});

function friendPair(first, second) {
  return first < second ? [first, second] : [second, first];
}

function transaction(database, operation) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

async function serveFile(request, response, pathname, distDirectory) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  if (decoded.includes("\\") || decoded.includes("\0") ||
      decoded.split("/").some(part => part === ".." || part.startsWith("."))) {
    response.writeHead(404).end("Not found");
    return;
  }
  const filePath = resolve(distDirectory, `.${decoded === "/" ? "/index.html" : decoded}`);
  if (!filePath.startsWith(`${distDirectory}${sep}`)) {
    response.writeHead(404).end("Not found");
    return;
  }
  let file;
  try {
    file = await stat(filePath);
    if (!file.isFile()) throw new Error("not_file");
  } catch {
    response.writeHead(404).end("Not found");
    return;
  }
  const contentType = CONTENT_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
  response.setHeader("Content-Type", contentType);
  response.setHeader("Cache-Control", decoded.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const gzip = file.size > 1024 &&
    /\b(?:text|javascript|json|svg|wasm)\b/.test(contentType) &&
    /(?:^|,)\s*gzip\s*(?:,|$|;)/i.test(request.headers["accept-encoding"] || "");
  if (gzip) {
    response.setHeader("Content-Encoding", "gzip");
    response.setHeader("Vary", "Accept-Encoding");
  } else {
    response.setHeader("Content-Length", file.size);
  }
  response.writeHead(200);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  try {
    const stream = createReadStream(filePath);
    if (gzip) await pipeline(stream, createGzip(), response);
    else await pipeline(stream, response);
  } catch {
    response.destroy();
  }
}

/** One server process owns one shared, short-lived meditation room. */
export function createTempleServer({
  distDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "dist"),
  now = Date.now,
  publicOrigin = process.env.PUBLIC_ORIGIN,
  dataDir = process.env.TEMPLE_DATA_DIR || resolve(dirname(fileURLToPath(import.meta.url)), "data"),
  trialMode = process.env.TEMPLE_TRIAL_MODE === "true",
} = {}) {
  const visitors = new Map();
  const staticRoot = resolve(distDirectory);
  const database = openCommunityDatabase(dataDir);
  const queries = {
    register: database.prepare("INSERT OR IGNORE INTO community_users (id, name, created_at) VALUES (?, ?, ?)"),
    user: database.prepare("SELECT id, name FROM community_users WHERE id = ?"),
    friend: database.prepare("SELECT 1 FROM friendships WHERE user_low = ? AND user_high = ?"),
    friends: database.prepare(`SELECT u.id, u.name FROM friendships AS f
      JOIN community_users AS u ON u.id = CASE WHEN f.user_low = ? THEN f.user_high ELSE f.user_low END
      WHERE f.user_low = ? OR f.user_high = ? ORDER BY f.created_at DESC`),
    incoming: database.prepare(`SELECT r.id, r.from_id AS fromId, u.name, r.created_at AS createdAt
      FROM friend_requests AS r JOIN community_users AS u ON u.id = r.from_id
      WHERE r.to_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`),
    outgoing: database.prepare(`SELECT r.id, r.to_id AS toId, u.name, r.created_at AS createdAt
      FROM friend_requests AS r JOIN community_users AS u ON u.id = r.to_id
      WHERE r.from_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`),
    pendingPair: database.prepare("SELECT id, from_id AS fromId FROM friend_requests WHERE pair_low = ? AND pair_high = ? AND status = 'pending'"),
    request: database.prepare("SELECT id, from_id AS fromId, to_id AS toId, status FROM friend_requests WHERE id = ?"),
    insertRequest: database.prepare("INSERT INTO friend_requests (id, from_id, to_id, pair_low, pair_high, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
    requestStatus: database.prepare("UPDATE friend_requests SET status = ? WHERE id = ?"),
    insertFriend: database.prepare("INSERT OR IGNORE INTO friendships (user_low, user_high, created_at) VALUES (?, ?, ?)"),
    greetings: database.prepare(`SELECT g.id, u.name AS fromName, g.text, g.created_at AS createdAt
      FROM greetings AS g JOIN community_users AS u ON u.id = g.from_id
      WHERE g.to_id = ? ORDER BY g.created_at DESC, g.id DESC LIMIT 30`),
    lastGreeting: database.prepare("SELECT created_at AS createdAt FROM greetings WHERE from_id = ? AND to_id = ? ORDER BY created_at DESC LIMIT 1"),
    insertGreeting: database.prepare("INSERT INTO greetings (from_id, to_id, text, created_at) VALUES (?, ?, ?, ?)"),
    incenseToday: database.prepare("SELECT COUNT(*) AS count FROM incense_offerings WHERE offering_day = ?"),
    incenseTotal: database.prepare("SELECT COUNT(*) AS count FROM incense_offerings"),
    incenseMine: database.prepare("SELECT COUNT(*) AS count FROM incense_offerings WHERE user_id = ? AND offering_day = ?"),
    lastIncense: database.prepare("SELECT created_at AS createdAt FROM incense_offerings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"),
    insertIncense: database.prepare("INSERT INTO incense_offerings (user_id, offering_day, created_at) VALUES (?, ?, ?)"),
  };

  function registerUser(identity, timestamp) {
    queries.register.run(identity.id, identity.name, timestamp);
  }

  function incenseCounts(identity, timestamp) {
    const day = offeringDayFormatter.format(new Date(timestamp));
    return {
      today: queries.incenseToday.get(day).count,
      total: queries.incenseTotal.get().count,
      mineToday: queries.incenseMine.get(identity.id, day).count,
    };
  }

  function socialSnapshot(identity, timestamp) {
    expireVisitors(timestamp);
    return {
      self: { id: identity.id, name: identity.name },
      online: [...visitors.values()].filter(visitor => visitor.id !== identity.id)
        .map(visitor => ({ id: visitor.id, name: visitor.name })),
      friends: queries.friends.all(identity.id, identity.id, identity.id)
        .map(friend => ({ ...friend, online: visitors.has(friend.id) })),
      incoming: queries.incoming.all(identity.id),
      outgoing: queries.outgoing.all(identity.id),
      incense: incenseCounts(identity, timestamp),
      greetings: queries.greetings.all(identity.id),
      trial: { temporaryRecords: trialMode },
    };
  }

  function socialAction(identity, body, timestamp) {
    const invalid = (error, message, status = 400) => ({ error, message, status });
    if (body.action === "request" || body.action === "greet") {
      if (typeof body.targetId !== "string" || !/^[a-f0-9]{64}$/.test(body.targetId)) {
        return invalid("invalid_target", "请选择一位同修。");
      }
      if (body.targetId === identity.id) return invalid("self_request", "去和其他同修结缘吧。");
      if (!queries.user.get(body.targetId)) return invalid("user_not_found", "这位同修暂时没有来到寺里。", 404);
      const pair = friendPair(identity.id, body.targetId);
      const alreadyFriends = Boolean(queries.friend.get(...pair));
      if (body.action === "request") {
        if (alreadyFriends) return null;
        const pending = queries.pendingPair.get(...pair);
        if (pending) {
          return pending.fromId === identity.id ? null : invalid("invitation_received", "对方也想与你结缘，请在邀请里回应。", 409);
        }
        if (queries.outgoing.all(identity.id).length >= 32) {
          return invalid("too_many_invitations", "先等一等已有的结缘邀请吧。", 429);
        }
        queries.insertRequest.run(randomBytes(16).toString("hex"), identity.id, body.targetId, ...pair, timestamp);
        return null;
      }
      if (!alreadyFriends) return invalid("not_friends", "彼此结缘后，就可以送上问候。", 403);
      const previous = queries.lastGreeting.get(identity.id, body.targetId);
      if (previous && timestamp - previous.createdAt < 10_000) {
        return invalid("greeting_cooldown", "问候已经送达，稍等片刻再打招呼吧。", 429);
      }
      queries.insertGreeting.run(identity.id, body.targetId, "向你合掌问候，愿你今日心安。", timestamp);
      return null;
    }

    if (!["accept", "decline", "cancel"].includes(body.action)) {
      return invalid("invalid_action", "请选择结缘或问候操作。");
    }
    if (typeof body.requestId !== "string" || !/^[a-f0-9]{32}$/.test(body.requestId)) {
      return invalid("invalid_invitation", "这份邀请没有找到，请刷新后再试。");
    }
    const invitation = queries.request.get(body.requestId);
    if (!invitation) return invalid("invitation_not_found", "这份邀请没有找到，请刷新后再试。", 404);
    const expectedUser = body.action === "cancel" ? invitation.fromId : invitation.toId;
    if (expectedUser !== identity.id) return invalid("not_your_invitation", "请操作发给自己的邀请。", 403);
    const status = { accept: "accepted", decline: "declined", cancel: "canceled" }[body.action];
    if (invitation.status === status) return null;
    if (invitation.status !== "pending") return invalid("invitation_resolved", "这份邀请已经处理过了。", 409);
    transaction(database, () => {
      if (body.action === "accept") queries.insertFriend.run(...friendPair(invitation.fromId, invitation.toId), timestamp);
      queries.requestStatus.run(status, invitation.id);
    });
    return null;
  }

  async function handleCommunity(request, response, pathname) {
    const identity = requestIdentity(request);
    const allowed = pathname === "/api/social" ? ["GET", "POST"] : ["POST"];
    if (!allowed.includes(request.method)) {
      response.setHeader("Allow", allowed.join(", "));
      sendJson(response, { error: "method_not_allowed" }, 405, identity);
      return;
    }
    if (request.method === "POST" && !sameOrigin(request, publicOrigin)) {
      request.resume();
      sendJson(response, { error: "invalid_origin", message: "请在寺庙网页内操作。" }, 403, identity);
      return;
    }
    let body;
    if (request.method === "POST") {
      try {
        body = await readJson(request);
      } catch {
        sendJson(response, { error: "invalid_request", message: "操作没有送达，请再试一次。" }, 400, identity);
        return;
      }
    }
    const timestamp = now();
    registerUser(identity, timestamp);
    if (pathname === "/api/incense") {
      const previous = queries.lastIncense.get(identity.id);
      if (previous && timestamp - previous.createdAt < 5_000) {
        response.setHeader("Retry-After", Math.ceil((5_000 - timestamp + previous.createdAt) / 1000));
        sendJson(response, { error: "incense_cooldown", message: "清香已敬上，静心片刻再来吧。", ...incenseCounts(identity, timestamp) }, 429, identity);
        return;
      }
      queries.insertIncense.run(identity.id, offeringDayFormatter.format(new Date(timestamp)), timestamp);
      sendJson(response, incenseCounts(identity, timestamp), 200, identity);
      return;
    }
    if (body) {
      const failure = socialAction(identity, body, timestamp);
      if (failure) {
        const { status, ...error } = failure;
        sendJson(response, error, status, identity);
        return;
      }
    }
    sendJson(response, socialSnapshot(identity, timestamp), 200, identity);
  }

  function expireVisitors(timestamp) {
    for (const [id, visitor] of visitors) {
      if (visitor.lastSeen < timestamp - SESSION_AGE_MS) visitors.delete(id);
    }
  }

  function snapshot(identity, timestamp) {
    const participants = [...visitors.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(({ lastSeen, ...visitor }) => visitor);
    return {
      selfId: identity.id,
      now: timestamp,
      participants,
      total: participants.length,
      meditatingCount: participants.filter(visitor => visitor.meditating).length,
    };
  }

  function refresh(identity, timestamp) {
    let visitor = visitors.get(identity.id);
    if (!visitor && visitors.size < MAX_VISITORS) {
      visitor = {
        id: identity.id,
        name: identity.name,
        seat: null,
        x: 0,
        z: 9,
        heading: 0,
        action: "idle",
        meditating: false,
        joinedAt: timestamp,
        lastSeen: timestamp,
      };
      visitors.set(identity.id, visitor);
    }
    if (visitor) visitor.lastSeen = timestamp;
    return visitor;
  }

  async function handleRoom(request, response) {
    const identity = requestIdentity(request);
    if (request.method !== "GET" && request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      sendJson(response, { error: "method_not_allowed" }, 405, identity);
      return;
    }
    if (request.method === "POST" && !sameOrigin(request, publicOrigin)) {
      request.resume();
      sendJson(response, { error: "invalid_origin", message: "请在寺庙网页内操作。" }, 403, identity);
      return;
    }
    let body;
    if (request.method === "POST") {
      try {
        body = await readJson(request);
      } catch {
        sendJson(response, { error: "invalid_request", message: "操作没有送达，请再试一次。" }, 400, identity);
        return;
      }
      const invalid = validateUpdate(body);
      if (invalid) {
        sendJson(response, invalid, 400, identity);
        return;
      }
    }

    // No asynchronous work separates expiry, reservation and snapshot generation.
    const timestamp = now();
    registerUser(identity, timestamp);
    expireVisitors(timestamp);
    if (body?.leave === true) {
      visitors.delete(identity.id);
      sendJson(response, snapshot(identity, timestamp), 200, identity);
      return;
    }
    const visitor = refresh(identity, timestamp);
    if (!visitor) {
      sendJson(response, { error: "room_full", message: "庭院来客较多，稍后再来共修吧。" }, 503, identity);
      return;
    }
    if (body) {
      const occupied = body.seat !== null && Object.hasOwn(body, "seat") &&
        [...visitors.values()].some(other => other.id !== identity.id && other.seat === body.seat);
      if (occupied) {
        sendJson(response, {
          ...snapshot(identity, timestamp),
          error: "seat_taken",
          message: "这个蒲团刚刚有人坐下，换一个试试吧。",
        }, 409, identity);
        return;
      }
      updateVisitor(visitor, body);
    }
    sendJson(response, snapshot(identity, timestamp), 200, identity);
  }

  const server = createServer((request, response) => {
    void (async () => {
      let pathname;
      try {
        pathname = new URL(request.url || "/", "http://localhost").pathname;
      } catch {
        response.writeHead(400).end("Bad request");
        return;
      }
      if (pathname === "/api/room") {
        await handleRoom(request, response);
        return;
      }
      if (pathname === "/api/social" || pathname === "/api/incense") {
        await handleCommunity(request, response, pathname);
        return;
      }
      if (pathname === "/health" && (request.method === "GET" || request.method === "HEAD")) {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        response.end(request.method === "HEAD" ? undefined : '{"status":"ok"}');
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        request.resume();
        response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
        return;
      }
      await serveFile(request, response, pathname, staticRoot);
    })().catch(() => {
      if (response.headersSent) response.destroy();
      else sendJson(response, { error: "server_error", message: "寺门暂时没有打开，请稍后重试。" }, 500);
    });
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.once("close", () => database.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }
  const host = process.env.HOST || "0.0.0.0";
  const server = createTempleServer();
  server.listen(port, host, () => console.log(`云间寺已启动，端口 ${port}`));
  process.once("SIGTERM", () => server.close());
  process.once("SIGINT", () => server.close());
}
