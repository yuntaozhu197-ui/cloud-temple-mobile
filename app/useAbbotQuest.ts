import { useCallback, useEffect, useRef, useState } from "react";
import { actAbbot, getAbbotSnapshot, type AbbotAction, type AbbotObjectiveKind, type AbbotSnapshot } from "./abbotQuest";

/** Keep progress current while avoiding races between polling and ritual receipts. */
export function useAbbotQuest(selfId: string) {
  const [snapshot, setSnapshot] = useState<AbbotSnapshot | null>(null);
  const [error, setError] = useState("");
  const current = useRef<AbbotSnapshot | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const alive = useRef(false);
  const revision = useRef(0);
  const generation = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const recording = useRef(new Set<string>());

  const receive = useCallback((next: AbbotSnapshot) => {
    if (!alive.current) return;
    current.current = next;
    setSnapshot(next);
    setError("");
  }, []);

  useEffect(() => {
    alive.current = true;
    const session = ++generation.current;
    let reading = false;
    const refresh = async () => {
      if (document.hidden || reading || pending.current) return;
      reading = true;
      const controller = new AbortController();
      controllers.current.add(controller);
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      const version = revision.current;
      try {
        const next = await getAbbotSnapshot(selfId, controller.signal);
        if (session === generation.current && version === revision.current) receive(next);
      } catch (failure) {
        if (alive.current && session === generation.current) setError(controller.signal.aborted ? "住持行踪连接较慢，正在重新寻找。" : (failure as Error).message);
      } finally {
        window.clearTimeout(timeout);
        controllers.current.delete(controller);
        reading = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      alive.current = false;
      generation.current++;
      controllers.current.forEach(controller => controller.abort());
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [selfId, receive]);

  const act = useCallback((action: AbbotAction) => {
    pending.current++;
    revision.current++;
    const session = generation.current;
    const encounterId = current.current?.encounter.id;
    const questId = current.current?.quest.id;
    const operation = queue.current.catch(() => {}).then(async () => {
      const controller = new AbortController();
      controllers.current.add(controller);
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      try {
        if (!alive.current || session !== generation.current) throw new Error("这次奇遇已经结束，请重新进入寺庙。");
        const next = await actAbbot(selfId, action, encounterId, controller.signal, questId);
        if (session === generation.current) receive(next);
      } catch (failure) {
        const message = controller.signal.aborted ? "这次修行记录连接超时，请稍后重试。" : (failure as Error).message;
        if (alive.current && session === generation.current) setError(message);
        throw new Error(message);
      } finally {
        window.clearTimeout(timeout);
        controllers.current.delete(controller);
        pending.current--;
      }
    });
    queue.current = operation;
    return operation;
  }, [selfId, receive]);

  const record = useCallback(async (action: AbbotObjectiveKind) => {
    const snapshot = current.current;
    const objective = snapshot?.quest.objectives.find(item => item.kind === action);
    if (!snapshot?.progress.accepted || snapshot.progress.rewarded || !objective || snapshot.progress.objectives[objective.id]) return;
    const key = `${generation.current}:${objective.id}`;
    if (recording.current.has(key)) return;
    recording.current.add(key);
    try { await act(action); } catch { /* The quest panel keeps the retry message visible. */ }
    finally { recording.current.delete(key); }
  }, [act]);

  return { snapshot, error, act, record };
}
