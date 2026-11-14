import { useCallback, useEffect, useRef, useState } from "react";
import { PRACTICE_GAMES, practiceGameMaximum, practiceGamesRequest, readPracticeArchive, rememberPracticeReceipt, snapshotFromPracticeReceipts, type PracticeGameKind, type PracticeGamesSnapshot } from "./practiceGames";

type Options = { onUpgrade?: (kind: PracticeGameKind, tier: number) => void };

export function usePracticeGames(selfId: string, options: Options = {}) {
  const initial = () => {
    const saved = readPracticeArchive(selfId);
    return snapshotFromPracticeReceipts([...saved.receipts, ...saved.pending]);
  };
  const [snapshot, setSnapshot] = useState<PracticeGamesSnapshot>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const current = useRef(snapshot);
  const callback = useRef(options.onUpgrade);
  callback.current = options.onUpgrade;
  const session = useRef({ id: selfId, generation: 0, alive: false });
  const schedule = useRef<(delay?: number) => void>(() => {});
  const issued = useRef(new Set<PracticeGameKind>());

  useEffect(() => {
    const generation = session.current.generation + 1;
    session.current = { id: selfId, generation, alive: true };
    let inFlight = false;
    let requested = false;
    let timer: number | undefined;
    let scheduledAt = Infinity;
    let controller: AbortController | undefined;
    let initialized = false;
    const saved = readPracticeArchive(selfId);
    const confirmed = snapshotFromPracticeReceipts(saved.receipts);
    const notified = Object.fromEntries(PRACTICE_GAMES.map(game => [game.id, confirmed.games[game.id].tier])) as Record<PracticeGameKind, number>;
    issued.current.clear();
    const active = () => session.current.alive && session.current.id === selfId && session.current.generation === generation;
    const publish = (temporaryRecords = true) => {
      if (!active()) return;
      const archive = readPracticeArchive(selfId);
      const next = snapshotFromPracticeReceipts([...archive.receipts, ...archive.pending], temporaryRecords);
      current.current = next;
      setSnapshot(next);
    };
    publish();
    setError("");

    const sync = async () => {
      if (!active() || document.hidden) return;
      if (inFlight) { requested = true; return; }
      inFlight = true;
      requested = false;
      setBusy(true);
      controller = new AbortController();
      const requestController = controller;
      const timeout = window.setTimeout(() => requestController.abort(), 15_000);
      let failed = false;
      try {
        const pending = readPracticeArchive(selfId).pending;
        const next = await practiceGamesRequest(selfId, requestController.signal, pending);
        if (!active()) return;
        for (const game of PRACTICE_GAMES) {
          const tier = next.games[game.id].tier;
          if (tier > notified[game.id] && (initialized || issued.current.has(game.id))) callback.current?.(game.id, tier);
          notified[game.id] = Math.max(notified[game.id], tier);
        }
        initialized = true;
        setError("");
        publish(next.trial.temporaryRecords);
      } catch (failure) {
        failed = true;
        if (active()) setError(requestController.signal.aborted ? "修行进度保存较慢，记录已保留，可稍后重试。" : (failure as Error).message);
      } finally {
        window.clearTimeout(timeout);
        if (controller === requestController) controller = undefined;
        inFlight = false;
        if (active()) {
          setBusy(false);
          if (failed) schedule.current(10_000);
          else if (requested || readPracticeArchive(selfId).pending.length) schedule.current(200);
        }
      }
    };
    schedule.current = (delay = 0) => {
      if (!active()) return;
      if (inFlight) { requested = true; return; }
      const at = Date.now() + delay;
      if (timer !== undefined && at >= scheduledAt) return;
      window.clearTimeout(timer);
      scheduledAt = at;
      timer = window.setTimeout(() => { timer = undefined; scheduledAt = Infinity; void sync(); }, delay);
    };
    schedule.current();
    const refresh = () => { if (!document.hidden) schedule.current(); };
    const poll = window.setInterval(refresh, 30_000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      session.current.alive = false;
      controller?.abort();
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [selfId]);

  const record = useCallback((kind: PracticeGameKind) => {
    if (!session.current.alive || session.current.id !== selfId || current.current.games[kind].score >= practiceGameMaximum(kind)) return;
    const receipt = { requestId: crypto.randomUUID(), kind, completedAt: Date.now() };
    rememberPracticeReceipt(selfId, receipt);
    issued.current.add(kind);
    const saved = readPracticeArchive(selfId);
    const next = snapshotFromPracticeReceipts([...saved.receipts, ...saved.pending], current.current.trial.temporaryRecords);
    current.current = next;
    setSnapshot(next);
    schedule.current(200);
  }, [selfId]);
  const retry = useCallback(() => schedule.current(), []);
  return { snapshot, error, busy, record, retry };
}
