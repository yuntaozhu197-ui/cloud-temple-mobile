import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);
const SESSION_COOKIE = "yunjian_session";
const SESSION_AGE_SECONDS = 30 * 24 * 60 * 60;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURE_RECORDS = 2048;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const tokenHash = token => createHash("sha256").update(token).digest("hex");

function cookieValue(request, name) {
  return request.headers.cookie?.split(";").map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function sessionCookie(request, value, maxAge) {
  const secure = request.socket.encrypted || request.headers["x-forwarded-proto"]?.split(",")[0].trim() === "https";
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function transact(database, operation) {
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

export function createTempleAuth(database, { now = Date.now } = {}) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS temple_accounts (
      username TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL UNIQUE REFERENCES community_users(id),
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS temple_sessions (
      token_hash TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES temple_accounts(owner_id),
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS temple_session_expiry ON temple_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS temple_session_owner ON temple_sessions(owner_id);
  `);
  const query = {
    account: database.prepare("SELECT username, owner_id AS ownerId, password_salt AS salt, password_hash AS hash FROM temple_accounts WHERE username = ?"),
    owner: database.prepare("SELECT username FROM temple_accounts WHERE owner_id = ?"),
    addUser: database.prepare("INSERT OR IGNORE INTO community_users (id, name, created_at) VALUES (?, ?, ?)"),
    user: database.prepare("SELECT u.id, u.name, a.username FROM community_users u JOIN temple_accounts a ON a.owner_id = u.id WHERE u.id = ?"),
    addAccount: database.prepare("INSERT INTO temple_accounts (username, owner_id, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"),
    session: database.prepare(`SELECT u.id, u.name, a.username FROM temple_sessions s
      JOIN temple_accounts a ON a.owner_id = s.owner_id JOIN community_users u ON u.id = a.owner_id
      WHERE s.token_hash = ? AND s.expires_at > ?`),
    addSession: database.prepare("INSERT INTO temple_sessions (token_hash, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)"),
    revoke: database.prepare("DELETE FROM temple_sessions WHERE token_hash = ?"),
    expired: database.prepare("DELETE FROM temple_sessions WHERE expires_at <= ?"),
  };
  const failures = new Map();
  const inFlight = new Map();
  let activeDerivations = 0;
  const dummySalt = randomBytes(16).toString("hex");
  const dummyHash = Buffer.alloc(64);

  function suppliedToken(request) {
    const token = cookieValue(request, SESSION_COOKIE);
    return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
  }

  function resolve(request) {
    const token = suppliedToken(request);
    return token ? query.session.get(tokenHash(token), now()) : undefined;
  }

  function pruneFailures(timestamp) {
    for (const [key, entry] of failures) {
      if (entry.until <= timestamp) failures.delete(key);
    }
    while (failures.size >= MAX_FAILURE_RECORDS) failures.delete(failures.keys().next().value);
  }

  function countFailure(key, timestamp) {
    const current = failures.get(key);
    if (current && current.until > timestamp) current.count += 1;
    else failures.set(key, { count: 1, until: timestamp + FAILURE_WINDOW_MS });
  }

  function failure(status, error, message) {
    return { status, body: { authenticated: false, error, message } };
  }

  function rotateSession(request, identity) {
    const secret = randomBytes(32).toString("hex");
    const timestamp = now();
    const oldToken = suppliedToken(request);
    query.expired.run(timestamp);
    if (oldToken) query.revoke.run(tokenHash(oldToken));
    query.addSession.run(tokenHash(secret), identity.id, timestamp, timestamp + SESSION_AGE_SECONDS * 1000);
    return {
      status: 200,
      body: { authenticated: true, user: identity },
      cookies: [sessionCookie(request, secret, SESSION_AGE_SECONDS)],
      identity,
    };
  }

  async function act(request, body, guestIdentity) {
    if (body.action === "logout") {
      const identity = resolve(request);
      const token = suppliedToken(request);
      if (token) query.revoke.run(tokenHash(token));
      return { status: 200, body: { authenticated: false }, cookies: [sessionCookie(request, "", 0)], signedOutId: identity?.id, rotateGuest: true };
    }
    if (body.action !== "login" && body.action !== "register") {
      return failure(400, "invalid_auth_action", "请选择登录或设置密码。");
    }
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = body.password;
    if (!/^[a-z0-9_]{3,24}$/.test(username) || typeof password !== "string" ||
        Array.from(password).length < 8 || Array.from(password).length > 128) {
      return failure(400, "invalid_credentials", "账号需3至24位英文字母、数字或下划线，密码需8至128个字符。");
    }
    const timestamp = now();
    pruneFailures(timestamp);
    // The hosting proxy appends the real peer, so use the final forwarded address.
    const address = request.headers["x-forwarded-for"]?.split(",").at(-1).trim() || request.socket.remoteAddress || "unknown";
    const addressKey = `address:${address}`;
    const accountKey = `account:${address}:${username}`;
    if ((failures.get(accountKey)?.count || 0) >= 8 || (failures.get(addressKey)?.count || 0) >= 50) {
      return failure(429, "login_rate_limited", "尝试较多，请15分钟后再登录。");
    }
    if (activeDerivations >= 8 || (inFlight.get(address) || 0) >= 2) {
      return failure(429, "auth_busy", "登录来客较多，请稍后再试。");
    }
    if (body.action === "register") {
      if (query.owner.get(guestIdentity.id)) return failure(409, "account_exists", "当前身份已设置过账号，请使用原账号登录。");
      if (query.account.get(username)) return failure(409, "username_taken", "这个账号已有人使用，请换一个。");
      if (resolve(request)) return failure(409, "already_authenticated", "你已登录，请继续使用当前账号。");
    }
    activeDerivations += 1;
    inFlight.set(address, (inFlight.get(address) || 0) + 1);
    try {
      if (body.action === "register") {
        const salt = randomBytes(16).toString("hex");
        const hash = await deriveKey(password, Buffer.from(salt, "hex"), 64, SCRYPT_OPTIONS);
        // Check again after the asynchronous derivation, before the atomic insert.
        if (query.owner.get(guestIdentity.id)) return failure(409, "account_exists", "当前身份已设置过账号，请使用原账号登录。");
        if (query.account.get(username)) return failure(409, "username_taken", "这个账号已有人使用，请换一个。");
        return transact(database, () => {
          query.addUser.run(guestIdentity.id, guestIdentity.name, now());
          query.addAccount.run(username, guestIdentity.id, salt, hash.toString("hex"), now());
          const result = rotateSession(request, query.user.get(guestIdentity.id));
          if (guestIdentity.cookie) result.cookies.unshift(guestIdentity.cookie);
          return result;
        });
      }
      const account = query.account.get(username);
      const expected = account ? Buffer.from(account.hash, "hex") : dummyHash;
      const actual = await deriveKey(password, Buffer.from(account?.salt || dummySalt, "hex"), 64, SCRYPT_OPTIONS);
      if (!account || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        countFailure(accountKey, now());
        countFailure(addressKey, now());
        return failure(401, "incorrect_credentials", "账号或密码不正确。");
      }
      failures.delete(accountKey);
      return transact(database, () => rotateSession(request, query.user.get(account.ownerId)));
    } finally {
      activeDerivations -= 1;
      const remaining = (inFlight.get(address) || 1) - 1;
      if (remaining) inFlight.set(address, remaining);
      else inFlight.delete(address);
    }
  }

  return { resolve, act };
}
