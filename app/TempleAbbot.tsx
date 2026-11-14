import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Flame, MapPin, MessageCircle, X } from "lucide-react";
import type { AbbotSnapshot } from "./abbotQuest";
import "./abbot.css";

type Cinematic = "greeting" | "blessing";
type Props = {
  snapshot: AbbotSnapshot | null;
  nearby: boolean;
  cinematic: Cinematic | null;
  onConversationChange: (open: boolean) => void;
  onNavigate: () => void;
  onAccept: () => Promise<void>;
  onComplete: () => Promise<void>;
  onCinematic: (kind: Cinematic) => void;
  onSkipCinematic?: () => void;
  error?: string;
  ceremony?: number;
};

export default function TempleAbbot(props: Props) {
  const { snapshot, nearby, cinematic, error } = props;
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [heard, setHeard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const announced = useRef(new Set<string>());
  const previousCinematic = useRef<Cinematic | null>(null);
  const reopenAfterGreeting = useRef(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const encounter = snapshot?.encounter;
  const progress = snapshot?.progress;
  const quest = snapshot?.quest;
  const canTalk = Boolean(encounter?.active && nearby);
  const ready = Boolean(quest?.objectives.every(item => progress?.objectives[item.id]));
  const taskCount = quest?.objectives.filter(item => progress?.objectives[item.id]).length ?? 0;
  const ceremony = props.ceremony ?? quest?.ceremony ?? 0;
  const greetingNames = ["合掌开示", "拈花问心", "转珠叮咛", "云间一揖"];
  const blessingNames = ["莲灯传心", "清莲相赠", "瑞光随愿", "合掌授愿"];

  useEffect(() => { setHeard(false); }, [quest?.id]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      callbacks.current.onConversationChange(false);
    };
  }, []);

  useEffect(() => {
    callbacks.current.onConversationChange(open && !cinematic);
  }, [open, cinematic]);

  useEffect(() => {
    if (!encounter?.active || announced.current.has(encounter.id)) return;
    announced.current.add(encounter.id);
    setNotice(encounter.id);
    setHeard(false);
    const timeout = window.setTimeout(() => setNotice(null), 12_000);
    return () => window.clearTimeout(timeout);
  }, [encounter?.id, encounter?.active]);

  useEffect(() => {
    if (cinematic) setOpen(false);
    if (!cinematic && previousCinematic.current === "greeting" && reopenAfterGreeting.current) {
      reopenAfterGreeting.current = false;
      if (canTalk) setOpen(true);
    }
    previousCinematic.current = cinematic;
  }, [cinematic, canTalk]);

  useEffect(() => {
    if (!open || cinematic) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key !== "Tab") return;
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), summary") ?? []);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) return;
      if (!panel.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
      else trigger.current?.focus();
    };
  }, [open, cinematic]);

  function showStory() {
    setFailure("");
    setNotice(null);
    setOpen(true);
  }

  function navigate() {
    setOpen(false);
    setNotice(null);
    callbacks.current.onConversationChange(false);
    callbacks.current.onNavigate();
  }

  function listen() {
    if (!canTalk || pending.current) return;
    setHeard(true);
    reopenAfterGreeting.current = true;
    setOpen(false);
    callbacks.current.onConversationChange(false);
    callbacks.current.onCinematic("greeting");
  }

  async function submit(kind: "accept" | "complete") {
    if (!canTalk || pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailure("");
    try {
      await (kind === "accept" ? callbacks.current.onAccept() : callbacks.current.onComplete());
      if (!mounted.current) return;
      setOpen(false);
      callbacks.current.onConversationChange(false);
      if (kind === "complete") callbacks.current.onCinematic("blessing");
    } catch (problem) {
      if (mounted.current) setFailure(problem instanceof Error ? problem.message : "暂时没有连上住持，请稍后再试。");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (!snapshot || !quest) return null;

  return <>
    {!cinematic && !canTalk && <button ref={trigger} type="button" className="abbot-tracker" onClick={showStory} aria-haspopup="dialog" aria-label="查看住持行踪与修行任务">
      <Flame size={16} aria-hidden="true" />
      <span>{progress?.rewarded ? "称号收藏" : progress?.accepted ? `住持嘱托 ${taskCount}/${quest.objectives.length}` : "寻访住持"}</span>
      <ChevronRight size={14} aria-hidden="true" />
    </button>}

    {notice === encounter?.id && encounter?.active && !cinematic && !open && <aside className="abbot-arrival" aria-label="住持现身提示">
      <button type="button" className="abbot-arrival-body" onClick={showStory}>
        <span className="abbot-caption">云间来客</span>
        <strong>云隐住持现身了</strong>
        <span className="abbot-body-small"><MapPin size={14} aria-hidden="true" />{encounter.location.name}，带来了新的山中嘱托。</span>
      </button>
      <button type="button" className="abbot-icon-button" aria-label="收起住持现身提示" onClick={() => setNotice(null)}><X size={16} aria-hidden="true" /></button>
      <span className="abbot-sr-only" role="status">云隐住持在{encounter.location.name}现身，可以前去交谈。</span>
    </aside>}

    {canTalk && !open && !cinematic && <button type="button" className="abbot-nearby" onClick={showStory}>
      <MessageCircle size={16} aria-hidden="true" /><span>云隐住持</span><strong>聊一聊</strong>
    </button>}

    {cinematic && <aside className="abbot-cinematic" aria-live="polite">
      <div><span className="abbot-caption">{cinematic === "greeting" ? greetingNames[ceremony] : blessingNames[ceremony]}</span>
        <p>{cinematic === "greeting" ? quest.teaching : `住持将${quest.reward.lanternName}赠予你，授号「${quest.reward.title}」。`}</p>
      </div>
      {props.onSkipCinematic && <button type="button" onClick={props.onSkipCinematic}>跳过动画</button>}
    </aside>}

    {open && !cinematic && createPortal(<div className="abbot-dialog-layer" onClick={() => setOpen(false)}>
      <section ref={panel} className="abbot-panel" role="dialog" aria-modal="true" aria-labelledby="abbot-story-title" onClick={event => event.stopPropagation()}>
        <header className="abbot-heading">
          <div><span className="abbot-caption">云隐住持 · 寺院奇遇</span><h2 id="abbot-story-title">{quest.title}</h2></div>
          <button type="button" className="abbot-icon-button" aria-label="收起住持剧情" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
        </header>

        {progress?.rewarded ? <>
          <p className="abbot-speech">{quest.completion}</p>
          <div className="abbot-reward"><Flame size={24} aria-hidden="true" /><div><strong>已获{quest.reward.lanternName}</strong><span>称号「{quest.reward.title}」已收入收藏。</span></div></div>
          <p className="abbot-body-small">下一次住持现身时，会带来新的嘱托、称号与仪式。</p>
        </> : !progress?.accepted ? <>
          <p className="abbot-speech">{heard ? quest.teaching : quest.intro}</p>
          <p className="abbot-body-small">这一轮有{quest.objectives.length}项嘱托，完成后可得称号「{quest.reward.title}」。</p>
          {canTalk ? <button type="button" className="abbot-primary" disabled={busy} onClick={heard ? () => void submit("accept") : listen}>{busy ? "正在记下这段缘分…" : heard ? "接下住持的嘱托" : "聆听住持"}</button> : <p className="abbot-body-small">找到住持，走近后与他交谈，会开启一段山中故事。</p>}
        </> : <>
          <p className="abbot-speech">{ready ? "“你已将嘱托一一完成。回来吧，山里的这段缘分，等你来圆满。”" : quest.teaching}</p>
          <ul className="abbot-tasks" aria-label="住持嘱托进度">
            {quest.objectives.map(item => <li key={item.id} className={progress.objectives[item.id] ? "is-complete" : ""}><span className="abbot-task-check">{progress.objectives[item.id] && <Check size={14} aria-hidden="true" />}</span><div><strong>{item.label}</strong><p>{item.description}</p></div><span className="abbot-caption">{progress.objectives[item.id] ? "已完成" : "待完成"}</span></li>)}
          </ul>
          {ready && canTalk && <button type="button" className="abbot-primary" disabled={busy} onClick={() => void submit("complete")}>{busy ? "正在记下这段修行…" : "回禀住持，领受赠礼"}</button>}
          {!ready && <button type="button" className="abbot-primary" onClick={() => setOpen(false)}>去完成住持嘱托</button>}
        </>}

        {!canTalk && <div className="abbot-location">
          <p className="abbot-body-small"><MapPin size={14} aria-hidden="true" />{encounter?.active ? `住持正在${encounter.location.name}。` : "住持暂时云游去了，下一次现身时会通知你。"}</p>
          {progress?.accepted && !progress.rewarded && !encounter?.active && <p className="abbot-caption">已接取的嘱托与进度会保留，完成后待住持归来再回禀。</p>}
          {encounter?.active && <button type="button" className="abbot-secondary" onClick={navigate}>循着行踪前往<ChevronRight size={14} aria-hidden="true" /></button>}
        </div>}
        {(failure || error) && <p className="abbot-error" role="alert">{failure || error}</p>}
        {snapshot.rewards.titles.length > 0 && <details className="abbot-title-collection"><summary>已收集称号 · {snapshot.rewards.titles.length}</summary><p>{snapshot.rewards.titles.join(" · ")}</p></details>}
      </section>
    </div>, document.body)}
  </>;
}
