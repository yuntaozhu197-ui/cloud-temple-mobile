import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, HeartHandshake, Leaf, RefreshCw, Send, Sparkles, UserRound, UsersRound, X } from "lucide-react";
import "./social.css";

type Person = { id: string; name: string };
type Friend = Person & { online: boolean };
type Invitation = { id: string; fromId?: string; toId?: string; name: string; createdAt: number };
type Greeting = { id: string; fromName: string; text: string; createdAt: number };
type IncenseCounts = { today: number; total: number; mineToday: number };
type SocialSnapshot = {
  self: Person;
  online: Person[];
  friends: Friend[];
  incoming: Invitation[];
  outgoing: Invitation[];
  incense: IncenseCounts;
  greetings: Greeting[];
  trial?: { temporaryRecords: boolean };
};
type Props = {
  selfId?: string;
  onIncense?: (count: number) => void;
  onNotice?: (message: string) => void;
};
type SocialAction = "request" | "accept" | "decline" | "cancel" | "greet";
type Tab = "online" | "invitations" | "friends";

function IncenseIcon() {
  return <svg viewBox="0 0 88 88" fill="none" aria-hidden="true">
    <path d="M23 63h42l-5 15H28l-5-15Z" fill="#cfb88b" stroke="#ad956e" strokeWidth="1.4" />
    <ellipse cx="44" cy="63" rx="22" ry="5" fill="#e1d0ad" stroke="#ad956e" strokeWidth="1.4" />
    <path d="M34 62V37m10 26V31m10 31V37" stroke="#ac7954" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M34 36v-2m10-4v-2m10 8v-2" stroke="#d8946a" strokeWidth="3" strokeLinecap="round" />
    <path d="M34 28c-9-10 8-12 0-22m10 16c-8-9 9-12 1-20m9 26c-8-8 7-11 1-19" stroke="#afbaa0" strokeWidth="1.5" strokeLinecap="round" />
  </svg>;
}

async function api(path: string, body?: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.message || "暂时没有送达，请稍后再试。") as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function SocialTemple({ selfId, onIncense, onNotice }: Props) {
  const [snapshot, setSnapshot] = useState<SocialSnapshot | null>(null);
  const [connection, setConnection] = useState<"loading" | "ready" | "offline">("loading");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("online");
  const [busy, setBusy] = useState<string | null>(null);
  const [offering, setOffering] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState("");
  const modalRef = useRef<HTMLElement>(null);
  const callbacks = useRef({ onIncense, onNotice });
  const mounted = useRef(true);
  const refreshPending = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  callbacks.current = { onIncense, onNotice };

  const inform = useCallback((message: string) => {
    if (callbacks.current.onNotice) callbacks.current.onNotice(message);
    else {
      setNotice(message);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(""), 4000);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!selfId || refreshPending.current) return;
    refreshPending.current = true;
    try {
      const result = await api("/api/social") as SocialSnapshot;
      if (mounted.current) {
        setSnapshot(result);
        setConnection("ready");
      }
    } catch {
      if (mounted.current) setConnection("offline");
    } finally {
      refreshPending.current = false;
    }
  }, [selfId]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 8000);
    const resume = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", resume);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [refresh]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const buttons = modalRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),[href],[tabindex='0']");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
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
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keys);
      previousFocus?.focus();
    };
  }, [open]);

  async function act(action: SocialAction, target: string) {
    if (busy) return;
    setBusy(`${action}-${target}`);
    try {
      const identity = action === "request" || action === "greet" ? { targetId: target } : { requestId: target };
      await api("/api/social", { action, ...identity });
      const messages = {
        request: "结缘邀请已送达，等一位有缘人回应。",
        accept: "结缘成功，今后也是一起静坐的寺友了。",
        decline: "已婉拒这份邀请。",
        cancel: "已收回结缘邀请。",
        greet: "问候已送达，愿寺友今日心安。",
      };
      inform(messages[action]);
      await refresh();
    } catch (error) {
      inform(error instanceof Error ? error.message : "暂时没有送达，请稍后再试。");
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function offerIncense() {
    if (offering || cooldown) return;
    setOffering(true);
    try {
      const counts = await api("/api/incense", {}) as IncenseCounts;
      setSnapshot(current => current ? { ...current, incense: counts } : current);
      setCooldown(5);
      callbacks.current.onIncense?.(counts.mineToday);
      inform("已敬上一炷清香，愿你心安。");
    } catch (error) {
      if ((error as Error & { status?: number }).status === 429) setCooldown(5);
      inform(error instanceof Error ? error.message : "香火暂时没有送达，请稍后再试。");
    } finally {
      if (mounted.current) setOffering(false);
    }
  }

  const online = connection === "ready" ? snapshot?.online.filter(person => person.id !== snapshot.self.id) ?? [] : [];
  const friends = snapshot?.friends ?? [];
  const incoming = snapshot?.incoming ?? [];
  const outgoing = snapshot?.outgoing ?? [];
  const ready = connection === "ready";

  function onlineAction(person: Person) {
    if (friends.some(friend => friend.id === person.id)) return <span className="social-friend-badge"><Check size={13} /> 已结缘</span>;
    const received = incoming.find(invitation => invitation.fromId === person.id);
    if (received) return <button className="social-small-button" disabled={Boolean(busy)} onClick={() => void act("accept", received.id)}>接受结缘</button>;
    const pending = outgoing.find(invitation => invitation.toId === person.id);
    if (pending) return <button className="social-small-button quiet" disabled={Boolean(busy)} onClick={() => void act("cancel", pending.id)}>待回应 · 撤回</button>;
    return <button className="social-small-button" disabled={Boolean(busy)} onClick={() => void act("request", person.id)}><HeartHandshake size={14} /> 结缘</button>;
  }

  return <div className="social-temple">
    {snapshot?.trial?.temporaryRecords && <p className="social-trial-note">免费体验版的好友与香火记录可能在服务休眠或重启后重置。</p>}
    <section className="social-card incense-card" aria-label="菩萨敬香">
      <div className="social-card-heading"><span><Sparkles size={15} /> 一炷清香，一念善意</span><span className="social-soft-label">敬香祈愿</span></div>
      <div className="incense-content"><div className={`incense-illustration ${offering || cooldown ? "is-lit" : ""}`}><IncenseIcon /></div><div><h2>菩萨前，敬一炷香</h2><p>把心愿轻轻放下，<br />愿你与在意的人平安自在。</p></div></div>
      <div className="incense-counts"><span>今日香火 <strong>{snapshot?.incense.today ?? "—"}</strong></span><span>我的敬香 <strong>{snapshot?.incense.mineToday ?? "—"}</strong></span></div>
      <button className="social-main-button incense-offer" disabled={!ready || offering || cooldown > 0} onClick={() => void offerIncense()}><Sparkles size={16} />{offering ? "正在敬香…" : cooldown ? `清香袅袅 · ${cooldown} 秒` : "敬香祈愿"}</button>
      <p className="social-card-foot">{connection === "loading" ? "正在连接殿前香炉…" : connection === "offline" ? "暂时离线，连接后即可敬香" : "殿前香炉会点亮，香火记录随心意留下"}</p>
    </section>

    <section className="social-card friendship-card" aria-label="寺友结缘">
      <div className="social-card-heading"><span><HeartHandshake size={15} /> 寺友 · 结缘</span>{incoming.length > 0 && <span className="social-unread">{incoming.length} 份邀请</span>}</div>
      <h2>一同静坐，也能相识</h2>
      <p>向同在庭院的有缘人问好，<br />让每次回来，都多一份熟悉。</p>
      <div className="social-summary"><UsersRound size={17} /><span>{ready ? `${online.length} 位同修在此，${friends.length} 位寺友已结缘` : connection === "loading" ? "正在轻轻推开结缘的门…" : "结缘连接暂时中断"}</span></div>
      <button className="social-main-button" onClick={() => { setOpen(true); void refresh(); }}><UsersRound size={16} />看看有缘人<ChevronRight size={15} /></button>
      <p className="social-card-foot">好友邀请由对方接受后建立</p>
    </section>

    {notice && <div className="social-inline-notice" role="status"><Leaf size={14} />{notice}</div>}
    {open && <div className="social-backdrop" onClick={() => setOpen(false)}>
      <section ref={modalRef} className="social-sheet" role="dialog" aria-modal="true" aria-labelledby="social-title" onClick={event => event.stopPropagation()}>
        <header className="social-sheet-header"><div><span className="social-overline">有缘相逢，同在此刻</span><h2 id="social-title">寺友 · 结缘</h2></div><button className="social-close" aria-label="关闭结缘窗口" onClick={() => setOpen(false)}><X size={21} /></button></header>
        <div className="social-tabs" role="tablist" aria-label="结缘分类">{([{ key: "online", label: "在线同修", count: online.length }, { key: "invitations", label: "结缘邀请", count: incoming.length }, { key: "friends", label: "我的寺友", count: friends.length }] as const).map(item => <button key={item.key} role="tab" aria-selected={tab === item.key} aria-controls={`social-panel-${item.key}`} id={`social-tab-${item.key}`} onClick={() => setTab(item.key)}>{item.label}{item.count > 0 && <span>{item.count}</span>}</button>)}</div>
        <div className="social-sheet-body" role="tabpanel" id={`social-panel-${tab}`} aria-labelledby={`social-tab-${tab}`}>
          {!ready && <div className="social-connection"><RefreshCw size={20} /><strong>{connection === "loading" ? "正在连接同修…" : "暂时没有连接到庭院"}</strong><p>网络恢复后，会显示真实在线的有缘人。</p><button className="social-small-button" onClick={() => void refresh()}>重新连接</button></div>}
          {ready && tab === "online" && (online.length ? <ul className="social-person-list">{online.map(person => <li key={person.id}><span className="social-avatar"><UserRound size={20} /></span><div className="social-person-name"><strong>{person.name}</strong><span><i className="social-live-dot" /> 正在庭院中</span></div>{onlineAction(person)}</li>)}</ul> : <div className="social-empty"><Leaf size={27} /><strong>此刻清静，等一位有缘人</strong><p>朋友打开同一个寺庙链接后，就能在这里相遇。</p></div>)}
          {ready && tab === "invitations" && <>
            {incoming.length > 0 && <><h3 className="social-list-title">收到的邀请</h3><ul className="social-person-list">{incoming.map(invitation => <li key={invitation.id}><span className="social-avatar"><HeartHandshake size={20} /></span><div className="social-person-name"><strong>{invitation.name}</strong><span>想与你结为寺友</span></div><div className="social-invitation-actions"><button className="social-small-button quiet" disabled={Boolean(busy)} onClick={() => void act("decline", invitation.id)}>婉拒</button><button className="social-small-button" disabled={Boolean(busy)} onClick={() => void act("accept", invitation.id)}>接受</button></div></li>)}</ul></>}
            {outgoing.length > 0 && <><h3 className="social-list-title">送出的邀请</h3><ul className="social-person-list">{outgoing.map(invitation => <li key={invitation.id}><span className="social-avatar"><Send size={18} /></span><div className="social-person-name"><strong>{invitation.name}</strong><span>等待对方回应</span></div><button className="social-small-button quiet" disabled={Boolean(busy)} onClick={() => void act("cancel", invitation.id)}>撤回</button></li>)}</ul></>}
            {!incoming.length && !outgoing.length && <div className="social-empty"><HeartHandshake size={29} /><strong>还没有结缘邀请</strong><p>去在线同修里，向一位有缘人问好吧。</p><button className="social-small-button" onClick={() => setTab("online")}>看看在线同修</button></div>}
          </>}
          {ready && tab === "friends" && <>
            {friends.length ? <ul className="social-person-list">{friends.map(friend => <li key={friend.id}><span className="social-avatar friend"><UserRound size={20} /></span><div className="social-person-name"><strong>{friend.name}</strong><span>{friend.online ? <><i className="social-live-dot" /> 正在庭院中</> : "暂歇片刻，改日再见"}</span></div><button className="social-small-button" disabled={Boolean(busy)} onClick={() => void act("greet", friend.id)}><Leaf size={13} /> 问好</button></li>)}</ul> : <div className="social-empty"><UsersRound size={29} /><strong>等一段自在的相识</strong><p>结缘邀请被接受后，寺友就会出现在这里。</p></div>}
            {snapshot?.greetings.length ? <div className="social-greetings"><h3>寺友捎来的问候</h3>{snapshot.greetings.slice(0, 5).map(greeting => <div key={greeting.id}><Leaf size={14} /><p><strong>{greeting.fromName}</strong><span>{greeting.text}</span></p></div>)}</div> : null}
          </>}
        </div>
        <footer className="social-sheet-footer"><span>{snapshot?.self.name ? `你是 ${snapshot.self.name}` : "一位路过的有缘人"}</span><small>结缘身份保存在当前浏览器，清除浏览器数据会失去此身份。</small></footer>
      </section>
    </div>}
  </div>;
}
