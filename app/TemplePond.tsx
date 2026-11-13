import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { POND_SPECIES, getPondSpecies, pendingPondReleases, pondRequest, rememberPondRelease, type PondRelease, type PondSnapshot, type PondSpecies } from "./pondGame";
import "./pond.css";

type ReleaseResult = { requestId: string; species: PondSpecies; stage: "released" | "cancelled" };
type Props = {
  selfId: string;
  open: boolean;
  onClose: () => void;
  onRelease: (species: PondSpecies, requestId: string) => void;
  result?: ReleaseResult | null;
  onNotice?: (message: string) => void;
};
const animalIcons: Record<PondSpecies, string> = { fish: "🐟", koi: "🎏", goldfish: "🐠", turtle: "🐢", frog: "🐸", butterfly: "🦋" };

export default function TemplePond({ selfId, open, onClose, onRelease, result, onNotice }: Props) {
  const [snapshot, setSnapshot] = useState<PondSnapshot | null>(null);
  const [selected, setSelected] = useState<PondSpecies>("fish");
  const [pending, setPending] = useState<PondRelease[]>(() => pendingPondReleases(selfId));
  const [animation, setAnimation] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const issued = useRef(new Set<string>());
  const handled = useRef(new Set<string>());
  const animationId = useRef<string | null>(null);
  const callbacks = useRef({ onClose, onRelease, onNotice });
  callbacks.current = { onClose, onRelease, onNotice };
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const generation = useRef(0);

  useEffect(() => {
    issued.current.clear();
    handled.current.clear();
    animationId.current = null;
    setAnimation(null);
    setSnapshot(null);
    setSelected("fish");
    pendingRef.current = pendingPondReleases(selfId);
    setPending(pendingRef.current);
    setError("");
    setMessage("");
  }, [selfId]);

  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    const records = [...new Map([...pendingPondReleases(selfId), ...pendingRef.current].map(record => [record.requestId, record])).values()];
    setBusy(true);
    setError("");
    void (async () => {
      let data = await pondRequest(selfId, controller.signal);
      for (const record of records) data = await pondRequest(selfId, controller.signal, record);
      if (version !== generation.current) return;
      setSnapshot(data);
      const confirmed = new Set(data.releases.map(record => record.requestId));
      setPending(current => current.filter(record => !confirmed.has(record.requestId)));
      if (records.length > 0) {
        const last = records[records.length - 1];
        const text = `${getPondSpecies(last.species)?.name ?? "小生灵"}已放生，当前 ${data.score} 分。`;
        setMessage(text);
        callbacks.current.onNotice?.(text);
      }
    })().catch(failure => {
      if (version !== generation.current) return;
      const text = failure instanceof Error && failure.name !== "AbortError" ? failure.message : "连接超时，积分请求已保留，可以重试。";
      setError(text);
      if (records.length > 0) callbacks.current.onNotice?.("放生已完成，积分等待保存。打开池边记录可重试。");
    }).finally(() => {
      clearTimeout(timeout);
      if (version === generation.current) setBusy(false);
    });
    return () => { generation.current++; controller.abort(); clearTimeout(timeout); };
  }, [selfId, refresh]);

  useEffect(() => {
    if (!result || !issued.current.has(result.requestId) || handled.current.has(result.requestId)) return;
    handled.current.add(result.requestId);
    if (animationId.current === result.requestId) { animationId.current = null; setAnimation(null); }
    if (result.stage === "cancelled") {
      setMessage("这次放生已取消，积分未增加。");
      return;
    }
    const record = { requestId: result.requestId, species: result.species, releasedAt: Date.now() };
    rememberPondRelease(selfId, record);
    setPending(current => [...current, record]);
    pendingRef.current = [...pendingRef.current, record];
    setRefresh(value => value + 1);
  }, [result, selfId]);

  useEffect(() => {
    if (!open) return;
    setRefresh(value => value + 1);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); callbacks.current.onClose(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first || !last) return;
      if (!panel.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); if (previous?.isConnected) previous.focus(); };
  }, [open]);

  const next = snapshot ? POND_SPECIES.find(species => species.points > snapshot.score) : undefined;
  const canRelease = Boolean(snapshot && !snapshot.offline && !busy && !error && !animation && pending.length === 0 && snapshot.unlocked.includes(selected));
  function release() {
    if (!canRelease || animationId.current) return;
    const requestId = crypto.randomUUID();
    issued.current.add(requestId);
    animationId.current = requestId;
    setAnimation(requestId);
    setMessage("");
    callbacks.current.onClose();
    callbacks.current.onRelease(selected, requestId);
  }

  if (!open) return null;
  return createPortal(<div className="pond-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="pond-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby="pond-title">
      <header className="pond-heading"><div><h2 id="pond-title">放生池</h2><p>一次放生一只，成功后 +1 分</p></div><button className="pond-close" type="button" onClick={onClose} aria-label="关闭放生池"><X size={20} /></button></header>
      <div className="pond-score" role="status"><strong>{snapshot?.score ?? "—"}<small>分</small></strong><span>{next ? `再得 ${next.points - snapshot!.score} 分解锁${next.name}` : snapshot ? "六种生灵均已解锁" : "正在读取放生记录…"}</span></div>
      {next && <progress className="pond-progress" value={snapshot!.score - Math.max(0, next.points - 10)} max={10} aria-label={`距离${next.name}的解锁进度`} />}
      <div className="pond-species" role="group" aria-label="选择放生的生物">
        {POND_SPECIES.map(species => {
          const unlocked = Boolean(snapshot?.unlocked.includes(species.id));
          return <button key={species.id} type="button" disabled={!unlocked || Boolean(animation)} aria-pressed={selected === species.id} className={selected === species.id ? "is-selected" : ""} onClick={() => setSelected(species.id)}>
            <span className="pond-animal" aria-hidden="true">{animalIcons[species.id]}</span><strong>{species.name}</strong><small>{unlocked ? `已放生 ${snapshot!.counts[species.id]} 只` : `${species.points} 分解锁`}</small>
          </button>;
        })}
      </div>
      {animation ? <p className="pond-status" role="status">小和尚正前往池边，完成放生后记分。</p> : <button className="pond-release" type="button" disabled={!canRelease} onClick={release}>{busy ? "正在同步记录…" : pending.length > 0 ? "积分等待保存" : `放生一只${getPondSpecies(selected)?.name}`}</button>}
      {message && <p className="pond-status" role="status">{message}</p>}
      {snapshot?.offline && <p className="pond-status">正在显示本机备份，连接恢复后可继续放生。</p>}
      {(error || snapshot?.offline || pending.length > 0) && <div className="pond-error" role="alert">{error && <p>{error}</p>}<button type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)}>{pending.length > 0 ? "重试保存积分" : "重新连接"}</button></div>}
      <p className="pond-note">虚拟放生体验 · 积分随账号保存，本机保留恢复备份</p>
    </section>
  </div>, document.body);
}
