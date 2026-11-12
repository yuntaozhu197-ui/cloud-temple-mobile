import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Send, X } from "lucide-react";

type Wish = { id: string; wish: string; createdAt: number };
type Props = { selfId: string; open: boolean; onClose: () => void; onRelease: () => void };

export default function TempleLanterns({ selfId, open, onClose, onRelease }: Props) {
  const [wish, setWish] = useState("");
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const callbacks = useRef({ onClose, onRelease });
  callbacks.current = { onClose, onRelease };
  const version = useRef(0);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => { setWish(""); setWishes([]); requestId.current = null; }, [selfId]);
  useEffect(() => {
    version.current++;
    if (!open) return;
    const loadVersion = version.current;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    setError("");
    const controller = new AbortController();
    void fetch("/api/lanterns", { headers: { "X-Temple-User": selfId }, cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw Error(); return response.json(); })
      .then(data => { if (loadVersion === version.current) setWishes(data.wishes); }).catch(() => {});
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") callbacks.current.onClose();
      if (event.key !== "Tab") return;
      const controls = panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled),textarea:not(:disabled)");
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { version.current++; controller.abort(); operation.current?.abort(); setBusy(false); document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [open, selfId]);

  async function release() {
    if (busy || !wish.trim()) return;
    setBusy(true); setError("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    const controller = new AbortController();
    operation.current = controller;
    const requestVersion = version.current;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch("/api/lanterns", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Temple-User": selfId },
        body: JSON.stringify({ action: "release", requestId: requestId.current, wish }), signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "心愿暂时没有送达，请重试。");
      if (requestVersion !== version.current) return;
      setWishes(result.wishes); setWish(""); requestId.current = null;
      callbacks.current.onRelease(); callbacks.current.onClose();
    } catch (failure) { if (requestVersion === version.current) setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "连接超时，可以重试同一盏灯。"); }
    finally { clearTimeout(timeout); if (requestVersion === version.current) { operation.current = null; setBusy(false); } }
  }

  if (!open) return null;
  return createPortal(<div className="lamp-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="lamp-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby="sky-lantern-title">
      <header className="lamp-header"><div><h2 id="sky-lantern-title">孔明灯许愿</h2><p>免费放飞 · 心愿仅自己可见</p></div><button className="lamp-close" onClick={onClose} aria-label="关闭孔明灯许愿"><X size={20} /></button></header>
      <form className="lamp-wish" onSubmit={event => { event.preventDefault(); void release(); }}>
        <label htmlFor="sky-lantern-wish">写下这一盏灯的心愿</label>
        <textarea id="sky-lantern-wish" rows={4} maxLength={300} value={wish} disabled={busy} onChange={event => { setWish(event.target.value); requestId.current = null; }} placeholder="愿明天有新的光，愿心中所念平安…" />
        <button className="lamp-primary" disabled={busy || !wish.trim()}><Send size={17} />{busy ? "正在安放心愿…" : "放飞孔明灯"}</button>
      </form>
      {error && <p className="lamp-error" role="alert">{error}</p>}
      <p className="lamp-footnote">小和尚会走到许愿台，托灯举过头顶，再目送它缓缓升空。</p>
      {wishes.length > 0 && <section className="lamp-calendar"><h3>我的灯愿</h3>{wishes.slice(0, 5).map(item => <p key={item.id} className="lamp-footnote">{item.wish}</p>)}</section>}
    </section>
  </div>, document.body);
}
