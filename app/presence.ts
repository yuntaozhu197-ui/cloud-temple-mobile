export type TempleMotion = { id: string; x: number; z: number; heading: number; floor?: 1 | 2 | 3; at: number };
export type TemplePosition = { x: number; z: number; heading: number; floor: 1 | 2 | 3 };
export type PresenceParticipant = TempleMotion & {
  name: string; seat: number | null; action: string; meditating: boolean;
  joinedAt: number; bowSpeed?: 1 | 4;
};
export type PresenceRoom = {
  selfId: string; now: number; participants: PresenceParticipant[]; total: number; meditatingCount: number;
};
export type PresenceStatus = "connecting" | "online" | "offline" | "account_changed";
type Options = {
  selfId: string;
  onMotion: (moves: TempleMotion[]) => void;
  onRoom?: (room: PresenceRoom) => void;
  onStatus?: (status: PresenceStatus) => void;
};
const SEND_INTERVAL = 125;
const validMotion = (value: TempleMotion) => value && typeof value.id === "string" && [value.x, value.z, value.heading, value.at].every(Number.isFinite);

/** Stream other visitors and coalesce outgoing movement into a single short request. */
export function createTemplePresence(options: Options) {
  let source: EventSource | null = null;
  let closed = false;
  let pending: TemplePosition | null = null;
  let latest: TemplePosition | null = null;
  let inflight: AbortController | null = null;
  let sendTimer: ReturnType<typeof setTimeout> | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSentAt = -Infinity;
  let status: PresenceStatus | undefined;
  const newest = new Map<string, number>();

  function report(next: PresenceStatus) {
    if (closed || status === next) return;
    status = next;
    options.onStatus?.(next);
  }

  function receiveMotion(values: unknown) {
    if (!Array.isArray(values)) return;
    const accepted: TempleMotion[] = [];
    for (const value of values.slice(0, 128)) {
      if (!validMotion(value) || value.id === options.selfId || value.at <= (newest.get(value.id) ?? -Infinity)) continue;
      newest.set(value.id, value.at);
      accepted.push(value);
    }
    if (accepted.length) options.onMotion(accepted);
  }

  function disconnect() {
    source?.close();
    source = null;
    inflight?.abort();
    inflight = null;
    clearTimeout(sendTimer);
    clearTimeout(settleTimer);
    sendTimer = undefined;
    settleTimer = undefined;
  }

  function accountChanged() {
    report("account_changed");
    closed = true;
    disconnect();
    document.removeEventListener("visibilitychange", visible);
    window.removeEventListener("online", online);
  }

  function connect() {
    if (closed || document.hidden || source || typeof EventSource === "undefined") return;
    report("connecting");
    const connection = new EventSource(`/api/presence?selfId=${encodeURIComponent(options.selfId)}`, { withCredentials: true });
    source = connection;
    connection.onopen = () => { if (source === connection && !closed) report("online"); };
    connection.onerror = () => { if (source === connection && !closed) report("offline"); };
    connection.addEventListener("motion", event => {
      if (closed || source !== connection) return;
      try { receiveMotion(JSON.parse((event as MessageEvent<string>).data).moves); } catch { /* Keep the last known movement if a packet is interrupted. */ }
    });
    connection.addEventListener("room", event => {
      if (closed || source !== connection) return;
      try {
        const room = JSON.parse((event as MessageEvent<string>).data) as PresenceRoom;
        if (room.selfId !== options.selfId) { accountChanged(); return; }
        if (!Array.isArray(room.participants) || room.participants.length > 128 || !Number.isFinite(room.now)) return;
        const present = new Set(room.participants.map(person => person.id));
        for (const id of newest.keys()) if (!present.has(id)) newest.delete(id);
        receiveMotion(room.participants);
        options.onRoom?.(room);
        report("online");
      } catch { /* Automatic stream reconnect retains the authenticated account. */ }
    });
    connection.addEventListener("account", event => {
      if (closed || source !== connection) return;
      try {
        const data = JSON.parse((event as MessageEvent<string>).data);
        if (data.error === "left") { closed = true; disconnect(); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", online); }
        else accountChanged();
      } catch { accountChanged(); }
    });
  }

  function schedule(delay = SEND_INTERVAL) {
    if (closed || document.hidden || sendTimer || inflight || !pending) return;
    sendTimer = setTimeout(() => { sendTimer = undefined; void flush(); }, Math.max(delay, SEND_INTERVAL - (Date.now() - lastSentAt)));
  }

  async function flush() {
    if (closed || document.hidden || inflight || !pending) return;
    const position = pending;
    pending = null;
    const controller = new AbortController();
    inflight = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    lastSentAt = Date.now();
    let failed = false;
    try {
      const response = await fetch("/api/move", {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", "X-Temple-User": options.selfId },
        body: JSON.stringify(position),
      });
      if (closed) return;
      if (response.status === 401 || response.status === 409) { accountChanged(); return; }
      if (!response.ok) throw new Error("movement_unavailable");
      if (source?.readyState === 1) report("online");
    } catch {
      if (!closed && !document.hidden) {
        if (!pending) pending = latest ?? position;
        failed = true;
        report("offline");
      }
    } finally {
      clearTimeout(timeout);
      if (inflight === controller) inflight = null;
      schedule(failed ? 700 : 0);
    }
  }

  function visible() {
    if (closed) return;
    if (document.hidden) { disconnect(); report("offline"); }
    else { connect(); if (latest) pending = latest; schedule(0); }
  }
  function online() { if (!closed) { connect(); schedule(0); } }

  document.addEventListener("visibilitychange", visible);
  window.addEventListener("online", online);
  connect();
  if (typeof EventSource === "undefined") report("offline");
  return {
    sendPosition(position: TemplePosition) {
      if (closed || ![position.x, position.z, position.heading].every(Number.isFinite)) return;
      latest = { x: position.x, z: position.z, heading: position.heading, floor: 1 };
      pending = latest;
      schedule(0);
      clearTimeout(settleTimer);
      // A final stationary sample lets remote walkers settle naturally at the endpoint.
      settleTimer = setTimeout(() => { if (!closed && latest) { pending = latest; schedule(0); } }, 280);
    },
    close() {
      closed = true;
      disconnect();
      newest.clear();
      pending = latest = null;
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", online);
    },
  };
}
