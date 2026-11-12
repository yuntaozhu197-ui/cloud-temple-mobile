import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Download, Flower2, Heart, LogOut, Plus, RefreshCw, Save, Send, Trash2, X } from "lucide-react";
import "./life.css";

type Diary = {
  id: string;
  title: string;
  body: string;
  visibility: "private" | "public";
  updatedAt: number;
};
type PublicDiary = Diary & { authorId: string; authorName: string };
type LifeSnapshot = {
  self: { id: string; name: string };
  mine: Diary[];
  publicEntries: PublicDiary[];
  offerings: {
    flowers: number;
    totalSponsor: number;
    rituals: number;
    mineFlowers: number;
    mineSponsor: number;
    mineRituals: number;
  };
  feedbackCount: number;
  trial: { temporaryRecords: boolean };
};
type Props = {
  selfId?: string;
  exitRequest?: number;
  flowerRequest?: number;
  ritualRequest?: number;
  onNotice: (message: string) => void;
  onProfileChange: () => void;
  onOffering: (kind: "flower" | "ritual" | "sponsor") => void;
  onLeave: () => void;
};
type Tab = "diary" | "offerings" | "profile" | "leave";
type RitualKind = "平安祈愿" | "追思祝福" | "感恩回向";
const ritualKinds: RitualKind[] = ["平安祈愿", "追思祝福", "感恩回向"];
const tabs: { key: Tab; label: string }[] = [
  { key: "diary", label: "日记" },
  { key: "offerings", label: "随喜" },
  { key: "profile", label: "我的" },
  { key: "leave", label: "离寺" },
];

async function lifeRequest(body?: Record<string, unknown>, expectedUser?: string): Promise<LifeSnapshot | { ok: boolean }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/life", {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(expectedUser ? { "X-Temple-User": expectedUser } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "暂时没有保存成功，请稍后再试。");
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

function requestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
}

function validLength(value: string, minimum: number, maximum: number) {
  const length = Array.from(value.trim()).length;
  return length >= minimum && length <= maximum;
}

export default function TempleLife({ selfId, exitRequest = 0, flowerRequest = 0, ritualRequest = 0, onNotice, onProfileChange, onOffering, onLeave }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("diary");
  const [ritualOnly, setRitualOnly] = useState(false);
  const [snapshot, setSnapshot] = useState<LifeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [diaryView, setDiaryView] = useState<"mine" | "public">("mine");
  const [editingId, setEditingId] = useState<string>();
  const [draftId, setDraftId] = useState(requestId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<Diary["visibility"]>("private");
  const [deletingId, setDeletingId] = useState<string>();
  const [name, setName] = useState("");
  const [sponsor, setSponsor] = useState<10 | 50 | 100>(10);
  const [ritualKind, setRitualKind] = useState<RitualKind>("平安祈愿");
  const [intention, setIntention] = useState("");
  const [ritualRemaining, setRitualRemaining] = useState(0);
  const [ritualCompleted, setRitualCompleted] = useState(false);
  const [flowerCooldown, setFlowerCooldown] = useState(0);
  const [feedback, setFeedback] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const requestVersion = useRef(0);
  const ritualEnd = useRef(0);
  const sponsorAttempt = useRef<{ amount: number; id: string } | null>(null);
  const ritualAttempt = useRef<{ key: string; id: string } | null>(null);
  const feedbackAttempt = useRef<{ message: string; id: string } | null>(null);
  const callbacks = useRef({ onNotice, onProfileChange, onOffering, onLeave });
  callbacks.current = { onNotice, onProfileChange, onOffering, onLeave };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!selfId || busyRef.current) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const result = await lifeRequest(undefined, selfId);
      if (mounted.current && version === requestVersion.current && "mine" in result) {
        setSnapshot(result);
        setName(current => current || result.self.name);
      }
    } catch (failure) {
      if (mounted.current && version === requestVersion.current) {
        setError(failure instanceof Error ? failure.message : "心居暂时没有连接成功。");
      }
    } finally {
      if (mounted.current && version === requestVersion.current) setLoading(false);
    }
  }, [selfId]);

  useEffect(() => { if (open) void refresh(); }, [open, refresh]);

  useEffect(() => {
    if (!exitRequest) return;
    setTab("leave");
    setOpen(true);
    setError("");
  }, [exitRequest]);

  useEffect(() => { if (flowerRequest) void offerFlower(); }, [flowerRequest]);
  useEffect(() => { if (ritualRequest) { setRitualOnly(true); setTab("offerings"); setOpen(true); } }, [ritualRequest]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex='0']");
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!flowerCooldown) return;
    const timer = window.setTimeout(() => setFlowerCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [flowerCooldown]);

  useEffect(() => {
    if (!ritualRemaining) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((ritualEnd.current - Date.now()) / 1000));
      setRitualRemaining(remaining);
      if (!remaining) {
        setRitualCompleted(true);
        callbacks.current.onNotice("仪式圆满。愿这份善意，陪你回到生活。");
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [ritualRemaining > 0]);

  async function mutate(action: string, payload: Record<string, unknown> = {}) {
    if (busyRef.current) return false;
    busyRef.current = true;
    ++requestVersion.current;
    setLoading(false);
    setBusy(action);
    setError("");
    try {
      const result = await lifeRequest({ action, ...payload }, selfId);
      if (mounted.current && "mine" in result) setSnapshot(result);
      return true;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "暂时没有保存成功，请稍后再试。";
      if (mounted.current) setError(message);
      callbacks.current.onNotice(message);
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy("");
    }
  }

  function newDiary() {
    setDraftId(requestId());
    setEditingId(undefined);
    setTitle("");
    setBody("");
    setVisibility("private");
    setDeletingId(undefined);
  }

  async function saveDiary() {
    if (!validLength(title, 1, 60) || !validLength(body, 1, 2000)) {
      setError("请填写1–60字的标题和1–2000字的正文。");
      return;
    }
    if (await mutate("saveDiary", { id: editingId ?? draftId, title: title.trim(), body: body.trim(), visibility })) {
      callbacks.current.onNotice(visibility === "public" ? "日记已保存，并分享在公开心语中。" : "私人日记已保存。");
      newDiary();
    }
  }

  async function deleteDiary(id: string) {
    if (await mutate("deleteDiary", { id })) {
      if (editingId === id) newDiary();
      setDeletingId(undefined);
      callbacks.current.onNotice("这篇日记已删除。");
    }
  }

  async function changeName() {
    if (!name.trim()) {
      setError("请给小和尚取个名字。");
      return;
    }
    if (await mutate("profile", { name: name.trim() })) {
      callbacks.current.onProfileChange();
      callbacks.current.onNotice("名字已更新，庭院里的同修也能看到。");
    }
  }

  async function offerFlower() {
    if (flowerCooldown) return;
    if (await mutate("flower")) {
      setFlowerCooldown(5);
      setOpen(false);
      callbacks.current.onOffering("flower");
      callbacks.current.onNotice("鲜花已备好，正前往大殿供花。");
    }
  }

  async function offerSponsor() {
    if (sponsorAttempt.current?.amount !== sponsor) sponsorAttempt.current = { amount: sponsor, id: requestId() };
    if (await mutate("sponsor", { amount: sponsor, requestId: sponsorAttempt.current.id })) {
      sponsorAttempt.current = null;
      callbacks.current.onOffering("sponsor");
      callbacks.current.onNotice(`免费虚拟随喜已记下，随喜值 +${sponsor}。`);
    }
  }

  async function beginRitual() {
    if (ritualRemaining) return;
    if (!validLength(intention, 0, 120)) {
      setError("心愿请控制在120字以内。");
      return;
    }
    const key = JSON.stringify([ritualKind, intention.trim()]);
    if (ritualAttempt.current?.key !== key) ritualAttempt.current = { key, id: requestId() };
    if (await mutate("ritual", { kind: ritualKind, intention: intention.trim(), requestId: ritualAttempt.current.id })) {
      ritualAttempt.current = null;
      ritualEnd.current = Date.now() + 30_000;
      setRitualCompleted(false);
      setRitualRemaining(30);
      setOpen(false);
      callbacks.current.onOffering("ritual");
    }
  }

  async function submitAndLeave() {
    if (!validLength(feedback, 1, 1000)) {
      setError("请填写1–1000字的感受，也可以选择直接离寺。");
      return;
    }
    const message = feedback.trim();
    if (feedbackAttempt.current?.message !== message) feedbackAttempt.current = { message, id: requestId() };
    if (await mutate("feedback", { message, requestId: feedbackAttempt.current.id })) {
      feedbackAttempt.current = null;
      setFeedback("");
      setOpen(false);
      callbacks.current.onLeave();
    }
  }

  function exportDiaries() {
    if (!snapshot) return;
    const file = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), diaries: snapshot.mine }, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `云间寺日记-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const ready = Boolean(snapshot);
  const offerings = snapshot?.offerings;
  const breath = (30 - ritualRemaining) % 10 < 4 ? "慢慢吸气" : "轻轻呼气";

  return <div className="temple-life">
    <button className="life-shortcut" onClick={() => { setRitualOnly(false); setOpen(true); }} aria-label="打开心居日记与随喜"><BookOpen size={20} /><span>心居</span></button>
    {open && createPortal(<div className="life-backdrop" onClick={() => setOpen(false)}>
      <section ref={dialogRef} className="life-sheet" role="dialog" aria-modal="true" aria-labelledby="life-title" onClick={event => event.stopPropagation()}>
        <header className="life-header"><div><span>把这一刻，轻轻留下</span><h2 id="life-title">云间心居</h2></div><button className="life-close" onClick={() => setOpen(false)} aria-label="关闭心居"><X size={24} /></button></header>
        <div className="life-tabs" role="tablist" aria-label="心居功能">{tabs.map(item => <button key={item.key} role="tab" aria-selected={tab === item.key} id={`life-tab-${item.key}`} aria-controls={`life-panel-${item.key}`} onClick={() => { setTab(item.key); setError(""); }}>{item.label}</button>)}</div>
        <div className="life-body" role="tabpanel" id={`life-panel-${tab}`} aria-labelledby={`life-tab-${tab}`}>
          {error && <p className="life-error" role="alert">{error}</p>}
          {!ready && <div className="life-loading"><p>{loading || !selfId ? "正在连接心居…" : "心居暂时没有连接成功。"}</p><button className="life-button secondary" disabled={loading || !selfId} onClick={() => void refresh()}><RefreshCw size={18} />重新连接</button></div>}
          {ready && tab === "diary" && <>
            <div className="life-toolbar"><button className={`life-button ${diaryView === "mine" ? "" : "secondary"}`} onClick={() => setDiaryView("mine")}>我的日记</button><button className={`life-button ${diaryView === "public" ? "" : "secondary"}`} onClick={() => { setDiaryView("public"); void refresh(); }}>公开心语</button></div>
            {diaryView === "mine" ? <>
              <div className="life-section-heading"><h3>{editingId ? "编辑日记" : "写下今日一念"}</h3><button className="life-text-button" disabled={Boolean(busy)} onClick={newDiary}><Plus size={17} />新日记</button></div>
              <form className="life-form" onSubmit={event => { event.preventDefault(); void saveDiary(); }}>
                <label>标题<input disabled={Boolean(busy)} value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="给这一刻起个名字" required /></label>
                <label>正文<textarea disabled={Boolean(busy)} value={body} onChange={event => setBody(event.target.value)} maxLength={4000} rows={6} placeholder="此刻的心情、感谢或小小愿望…" required /></label>
                <label>谁可以看到<select disabled={Boolean(busy)} value={visibility} onChange={event => setVisibility(event.target.value as Diary["visibility"])}><option value="private">仅自己可见</option><option value="public">公开，分享给寺友</option></select></label>
                <p className="life-hint">{visibility === "private" ? "私人日记仅当前浏览器里的你可见。" : "保存后，所有来到寺庙的人都能阅读这篇日记。"}</p>
                <button className="life-button" disabled={Boolean(busy)} type="submit"><Save size={18} />{busy === "saveDiary" ? "正在保存…" : "保存日记"}</button>
              </form>
              <div className="life-section-heading"><h3>已保存的日记</h3><button className="life-text-button" onClick={exportDiaries} disabled={!snapshot?.mine.length}><Download size={17} />导出备份</button></div>
              {!snapshot?.mine.length && <p className="life-hint">这里还很清静，写下第一篇吧。</p>}
              <div className="life-entry-list">{snapshot?.mine.map(entry => <article className="life-entry" key={entry.id}><div className="life-entry-meta"><span>{entry.visibility === "private" ? "仅自己可见" : "已公开"}</span><time dateTime={new Date(entry.updatedAt).toISOString()}>{new Date(entry.updatedAt).toLocaleDateString()}</time></div><h3>{entry.title}</h3><p>{entry.body}</p><div className="life-entry-actions"><button className="life-text-button" disabled={Boolean(busy)} onClick={() => { setEditingId(entry.id); setTitle(entry.title); setBody(entry.body); setVisibility(entry.visibility); dialogRef.current?.querySelector(".life-body")?.scrollTo({ top: 0, behavior: "smooth" }); }}>编辑</button>{deletingId === entry.id ? <><button className="life-text-button danger" disabled={Boolean(busy)} onClick={() => void deleteDiary(entry.id)}>确认删除</button><button className="life-text-button" onClick={() => setDeletingId(undefined)}>保留</button></> : <button className="life-text-button danger" onClick={() => setDeletingId(entry.id)}><Trash2 size={16} />删除</button>}</div></article>)}</div>
            </> : <>
              <p className="life-hint">寺友主动公开的心语。你的私人日记会留在“我的日记”中。</p>
              {!snapshot?.publicEntries.length && <p className="life-empty">还没有公开心语，等一念善意相逢。</p>}
              <div className="life-entry-list">{snapshot?.publicEntries.map(entry => <article className="life-entry" key={entry.id}><div className="life-entry-meta"><strong>{entry.authorName}</strong><time dateTime={new Date(entry.updatedAt).toISOString()}>{new Date(entry.updatedAt).toLocaleDateString()}</time></div><h3>{entry.title}</h3><p>{entry.body}</p></article>)}</div>
            </>}
          </>}
          {ready && tab === "offerings" && <>
            {!ritualOnly && <><section className="life-offering"><Flower2 size={29} /><h3>献一朵花</h3><p>把善意留在庭院，愿你我心中有花。</p><p className="life-count">共有 {offerings?.flowers ?? 0} 朵花 · 我献过 {offerings?.mineFlowers ?? 0} 朵</p><button className="life-button" disabled={Boolean(busy) || flowerCooldown > 0} onClick={() => void offerFlower()}><Flower2 size={18} />{flowerCooldown ? `花香渐起 · ${flowerCooldown}秒` : "免费献花"}</button></section>
            <section className="life-offering"><Heart size={29} /><h3>免费虚拟随喜</h3><p>选择一份心意，累积免费随喜值。</p><div className="life-choice-row">{([10, 50, 100] as const).map(amount => <button className={sponsor === amount ? "selected" : ""} key={amount} onClick={() => setSponsor(amount)} aria-pressed={sponsor === amount}>+{amount}</button>)}</div><p className="life-count">全寺随喜值 {offerings?.totalSponsor ?? 0} · 我的随喜值 {offerings?.mineSponsor ?? 0}</p><button className="life-button" disabled={Boolean(busy)} onClick={() => void offerSponsor()}><Heart size={18} />免费随喜 +{sponsor}</button></section></>}
            <section className="life-offering"><h3>法事祈愿 · 三十秒回向</h3><p>线上自助祈愿体验，跟随呼吸，安住此刻。</p><label>仪式<select value={ritualKind} disabled={ritualRemaining > 0} onChange={event => setRitualKind(event.target.value as RitualKind)}>{ritualKinds.map(kind => <option key={kind}>{kind}</option>)}</select></label><label>心愿，可留空<textarea value={intention} disabled={ritualRemaining > 0} onChange={event => setIntention(event.target.value)} maxLength={240} rows={3} placeholder="愿你与在意的人，平安自在。" /></label><p className="life-hint">开始时记录次数，随后跟随30秒呼吸。心愿私密保存，页面只公开累计次数。</p><p className="life-count">全寺祈愿记录 {offerings?.rituals ?? 0} 次 · 我参与 {offerings?.mineRituals ?? 0} 次</p>{ritualRemaining > 0 ? <div className="life-ritual" role="timer"><span>{breath}</span><strong>{ritualRemaining}<small>秒</small></strong><p>让肩膀放松，让心愿落定。</p></div> : <>{ritualCompleted && <p className="life-complete">仪式圆满，带着善意继续生活。</p>}<button className="life-button" disabled={Boolean(busy)} onClick={() => void beginRitual()}>开始{ritualKind}</button></>}</section>
          </>}
          {ready && tab === "profile" && <>
            <h3>给小和尚起个名字</h3><form className="life-form" onSubmit={event => { event.preventDefault(); void changeName(); }}><label>寺友们会看到这个名字<input value={name} onChange={event => setName(event.target.value)} required autoComplete="nickname" /></label><p className="life-hint">中文、英文和数字都可以，名字会同步到庭院和公开心语。</p><button className="life-button" type="submit" disabled={Boolean(busy)}><Save size={18} />保存名字</button></form><section className="life-offering"><h3>我的心意</h3><p>献花 {offerings?.mineFlowers ?? 0} 朵</p><p>随喜值 {offerings?.mineSponsor ?? 0}</p><p>仪式 {offerings?.mineRituals ?? 0} 次</p></section><p className="life-hint">这个浏览器会记住你的小和尚、日记和寺友。同名访客各有独立记录。</p>
          </>}
          {tab === "leave" && <>
            <h3>带着安静，回到生活</h3><p>离寺前，可以留下一点感受或建议。</p><form className="life-form" onSubmit={event => { event.preventDefault(); void submitAndLeave(); }}><label>给云间寺的话，选填<textarea value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={2000} rows={5} placeholder="今天的体验、想增加的功能，或一句问候…" /></label><button className="life-button" type="submit" disabled={Boolean(busy) || !ready}><Send size={18} />{busy === "feedback" ? "正在提交…" : "提交并离寺"}</button></form><button className="life-button secondary life-leave-button" disabled={Boolean(busy)} onClick={() => { setOpen(false); callbacks.current.onLeave(); }}><LogOut size={18} />直接离寺</button><p className="life-hint">愿你归去时，心里多一份自在。</p>
          </>}
          {snapshot?.trial.temporaryRecords && <p className="life-trial">免费体验服务的日记、名字和心意记录可能在休眠或重启后重置。私人日记可点击“导出备份”保存到自己的设备。</p>}
        </div>
      </section>
    </div>, document.body)}
  </div>;
}
