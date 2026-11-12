import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flame, RotateCcw, Save, X } from "lucide-react";
import "./lamps.css";

type LampSnapshot = {
  today: string;
  timeZone: string;
  wish: { text: string; updatedAt: number | null };
  litToday: boolean;
  total: number;
  days: { day: string; makeup: boolean; litAt: number }[];
  trial: { temporaryRecords: boolean };
};

type Props = {
  selfId?: string;
  open: boolean;
  onClose: () => void;
  onLight?: () => void;
  onViewCeremony?: () => void;
};

async function lampRequest(selfId: string, signal: AbortSignal, body?: Record<string, unknown>): Promise<LampSnapshot> {
  const response = await fetch("/api/lamps", {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "X-Temple-User": selfId, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "长明灯暂时没有连接成功，请重试。");
  return result;
}

function recentDays(today: string) {
  const date = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: 14 }, (_, index) => {
    const day = new Date(date);
    day.setUTCDate(day.getUTCDate() - 13 + index);
    return day.toISOString().slice(0, 10);
  });
}

function displayDay(day: string) {
  return `${Number(day.slice(5, 7))}月${Number(day.slice(8))}日`;
}

function shanghaiDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const calendar = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${calendar.year}-${calendar.month}-${calendar.day}`;
}

export default function TempleLamps({ selfId, open, onClose, onLight, onViewCeremony }: Props) {
  const [snapshot, setSnapshot] = useState<LampSnapshot | null>(null);
  const [wish, setWish] = useState("");
  const [makeupDay, setMakeupDay] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadKey, setLoadKey] = useState(0);
  const [ceremonyUntil, setCeremonyUntil] = useState(0);
  const [ceremonyRemaining, setCeremonyRemaining] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const operation = useRef<AbortController | null>(null);
  const version = useRef(0);
  const loadedClientDay = useRef("");
  const callbacks = useRef({ onClose, onLight, onViewCeremony });
  callbacks.current = { onClose, onLight, onViewCeremony };

  useEffect(() => {
    const currentVersion = ++version.current;
    operation.current?.abort();
    operation.current = null;
    loadedClientDay.current = "";
    setSnapshot(null);
    setWish("");
    setBusy("");
    setMessage("");
    setError("");
    setCeremonyUntil(0);
    setCeremonyRemaining(0);
    setLoading(Boolean(open && selfId));
    if (!open || !selfId) return;
    const controller = new AbortController();
    const requestedClientDay = shanghaiDay();
    operation.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    void lampRequest(selfId, controller.signal).then(result => {
      if (version.current !== currentVersion) return;
      loadedClientDay.current = requestedClientDay;
      setSnapshot(result);
      setWish(result.wish.text);
      const yesterday = new Date(`${result.today}T00:00:00Z`);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      setMakeupDay(yesterday.toISOString().slice(0, 10));
    }).catch(failure => {
      if (version.current === currentVersion) setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "连接超时，请重试。");
    }).finally(() => {
      window.clearTimeout(timeout);
      if (version.current === currentVersion) {
        operation.current = null;
        setLoading(false);
      }
    });
    return () => {
      version.current++;
      window.clearTimeout(timeout);
      controller.abort();
      operation.current?.abort();
    };
  }, [open, selfId, loadKey]);

  useEffect(() => {
    if (!open || !ceremonyUntil) return;
    let interval: number | undefined;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((ceremonyUntil - Date.now()) / 1000));
      setCeremonyRemaining(remaining);
      if (!remaining && interval !== undefined) window.clearInterval(interval);
    };
    update();
    if (Date.now() >= ceremonyUntil) return;
    interval = window.setInterval(update, 500);
    return () => window.clearInterval(interval);
  }, [open, ceremonyUntil]);

  useEffect(() => {
    if (!open || !selfId) return;
    let timeout: number | undefined;
    const refreshNewDay = () => {
      if (document.visibilityState === "hidden" || operation.current || !loadedClientDay.current || shanghaiDay() === loadedClientDay.current) return;
      const currentVersion = version.current;
      const controller = new AbortController();
      const requestedClientDay = shanghaiDay();
      operation.current = controller;
      timeout = window.setTimeout(() => controller.abort(), 12_000);
      void lampRequest(selfId, controller.signal).then(result => {
        if (version.current !== currentVersion) return;
        loadedClientDay.current = requestedClientDay;
        setSnapshot(result);
        setMessage("");
        setError("");
        // Keep the wish draft and selected makeup date while refreshing the calendar.
      }).catch(failure => {
        if (version.current === currentVersion) setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "日期更新超时，可稍后重新打开长明灯。");
      }).finally(() => {
        window.clearTimeout(timeout);
        if (version.current === currentVersion) operation.current = null;
      });
    };
    const interval = window.setInterval(refreshNewDay, 15_000);
    document.addEventListener("visibilitychange", refreshNewDay);
    window.addEventListener("focus", refreshNewDay);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", refreshNewDay);
      window.removeEventListener("focus", refreshNewDay);
    };
  }, [open, selfId]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") callbacks.current.onClose();
      if (event.key !== "Tab") return;
      const controls = panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled)");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previousFocus?.focus(); };
  }, [open]);

  async function submit(action: "wish" | "light", day?: string) {
    if (!selfId || operation.current || !snapshot) return;
    const currentVersion = version.current;
    const controller = new AbortController();
    const requestedClientDay = shanghaiDay();
    operation.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setBusy(action === "wish" ? "wish" : day ?? snapshot.today);
    setError("");
    setMessage("");
    try {
      // Omitting today's date lets the server select the day even across midnight.
      const result = await lampRequest(selfId, controller.signal, action === "wish" ? { action, wish } : { action, ...(day ? { day } : {}) });
      if (version.current !== currentVersion) return;
      loadedClientDay.current = requestedClientDay;
      setSnapshot(result);
      if (action === "wish") {
        setWish(result.wish.text);
        setMessage(result.wish.text ? "心愿已安放，愿你日日心有光。" : "心愿已清空。");
      } else {
        setMessage(day && day < result.today ? `${displayDay(day)}的灯已补亮。` : "今日长明灯已点亮。愿你平安从容。");
        if (result.total > snapshot.total) {
          setCeremonyUntil(Date.now() + 24_000);
          setCeremonyRemaining(24);
          callbacks.current.onLight?.();
        }
      }
    } catch (failure) {
      if (version.current === currentVersion) setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "连接超时，请重试。重复点灯会保留同一天的一次记录。");
    } finally {
      window.clearTimeout(timeout);
      if (version.current === currentVersion) { operation.current = null; setBusy(""); }
    }
  }

  if (!open) return null;
  const litDays = new Set(snapshot?.days.map(day => day.day));
  const yesterday = snapshot ? new Date(`${snapshot.today}T00:00:00Z`) : null;
  yesterday?.setUTCDate(yesterday.getUTCDate() - 1);
  const maxMakeupDay = yesterday?.toISOString().slice(0, 10);

  return createPortal(
    <div className="lamp-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="lamp-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby="lamp-title">
        <header className="lamp-header">
          <div><h2 id="lamp-title">长明灯塔</h2><p>免费点灯 · 心愿仅自己可见</p></div>
          <button className="lamp-close" type="button" onClick={onClose} aria-label="关闭长明灯塔"><X size={20} /></button>
        </header>
        {loading && <p className="lamp-status" role="status">正在迎回你的灯火…</p>}
        {!selfId && <p className="lamp-status">取一个名字入寺后，就能保存自己的长明灯。</p>}
        {snapshot && <>
          <div className={`lamp-hero ${snapshot.litToday || ceremonyRemaining > 0 ? "is-lit" : ""} ${ceremonyRemaining > 0 ? "is-ceremonial" : ""}`}>
            {ceremonyRemaining > 0 && <div className="lamp-sparkles" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ left: `${10 + index * 7}%`, animationDelay: `${index * -0.34}s` }} />)}</div>}
            <div className="lamp-lantern" aria-hidden="true"><div className="lamp-flame" /></div>
            <strong>{snapshot.litToday ? "今日灯火已亮" : "为今天点一盏灯"}</strong>
            <span>已点亮 {snapshot.total} 天</span>
            <button className="lamp-primary" type="button" disabled={Boolean(busy) || snapshot.litToday} onClick={() => void submit("light")}>
              <Flame size={18} />{busy === snapshot.today ? "点亮中…" : snapshot.litToday ? "今日已点亮" : "亲手点亮今日长明灯"}
            </button>
            {ceremonyRemaining > 0 && <div className="lamp-ceremony-status" role="status"><span>{ceremonyRemaining > 17 ? "灯火逐层亮起" : ceremonyRemaining > 8 ? "莲光与心愿缓缓升起" : "愿这一盏温柔长伴"}</span><small>点灯仪式 · {ceremonyRemaining}秒</small>{onViewCeremony && <button className="lamp-secondary" type="button" onClick={() => callbacks.current.onViewCeremony?.()}>观看灯塔仪式</button>}</div>}
          </div>
          <form className="lamp-wish" onSubmit={event => { event.preventDefault(); void submit("wish"); }}>
            <label htmlFor="lamp-wish">我的心愿</label>
            <textarea id="lamp-wish" value={wish} onChange={event => setWish(event.target.value)} maxLength={1000} rows={3} placeholder="愿家人安康，愿自己踏实向前…" disabled={Boolean(busy)} />
            <button className="lamp-secondary" type="submit" disabled={Boolean(busy) || wish.trim() === snapshot.wish.text}><Save size={16} />{busy === "wish" ? "保存中…" : "保存心愿"}</button>
          </form>
          <section className="lamp-calendar" aria-label="最近两周点灯记录">
            <h3>近两周灯火</h3>
            <div className="lamp-days">{recentDays(snapshot.today).map(day => <button key={day} type="button" className={`${litDays.has(day) ? "is-lit" : ""} ${makeupDay === day ? "is-selected" : ""}`} aria-label={`${displayDay(day)}${litDays.has(day) ? "已点亮" : day === snapshot.today ? "今日待点亮" : "待补点"}`} disabled={Boolean(busy) || litDays.has(day) || day === snapshot.today} onClick={() => setMakeupDay(day)}><span>{Number(day.slice(8))}</span><Flame size={14} /></button>)}</div>
          </section>
          <form className="lamp-makeup" onSubmit={event => { event.preventDefault(); void submit("light", makeupDay); }}>
            <label htmlFor="lamp-makeup-day">忘记点灯，可以免费补点</label>
            <div><input id="lamp-makeup-day" type="date" value={makeupDay} max={maxMakeupDay} onChange={event => setMakeupDay(event.target.value)} required disabled={Boolean(busy)} /><button className="lamp-secondary" type="submit" disabled={Boolean(busy) || !makeupDay || makeupDay >= snapshot.today || litDays.has(makeupDay)}><RotateCcw size={16} />补点</button></div>
          </form>
          <p className="lamp-footnote">每日记录按北京时间更新。{snapshot.trial.temporaryRecords ? "免费试用环境重启后，记录可能重置。" : "点灯记录会随你的入寺身份保存。"}</p>
        </>}
        {message && <p className="lamp-message" role="status">{message}</p>}
        {error && <div className="lamp-error" role="alert"><p>{error}</p>{!snapshot && !loading && <button className="lamp-secondary" type="button" onClick={() => setLoadKey(value => value + 1)}>重新连接</button>}</div>}
      </section>
    </div>, document.body,
  );
}
