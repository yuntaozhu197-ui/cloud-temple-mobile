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
  const canTalk = Boolean(encounter?.active && nearby);
  const ready = Boolean(progress?.prayer && progress?.flower);
  const taskCount = Number(Boolean(progress?.prayer)) + Number(Boolean(progress?.flower));

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
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
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

  if (!snapshot) return null;

  return <>
    {!cinematic && !canTalk && <button ref={trigger} type="button" className="abbot-tracker" onClick={showStory} aria-haspopup="dialog" aria-label="查看住持行踪与照心灯任务">
      <Flame size={16} aria-hidden="true" />
      <span>{progress?.rewarded ? "云隐莲灯" : progress?.accepted ? `照心灯 ${taskCount}/2` : "寻访住持"}</span>
      <ChevronRight size={14} aria-hidden="true" />
    </button>}

    {notice === encounter?.id && encounter?.active && !cinematic && !open && <aside className="abbot-arrival" aria-label="住持现身提示">
      <button type="button" className="abbot-arrival-body" onClick={showStory}>
        <span className="abbot-caption">云间来客</span>
        <strong>云隐住持现身了</strong>
        <span className="abbot-body-small"><MapPin size={14} aria-hidden="true" />{encounter.location.name}，一盏灯正等有缘人。</span>
      </button>
      <button type="button" className="abbot-icon-button" aria-label="收起住持现身提示" onClick={() => setNotice(null)}><X size={16} aria-hidden="true" /></button>
      <span className="abbot-sr-only" role="status">云隐住持在{encounter.location.name}现身，可以前去交谈。</span>
    </aside>}

    {canTalk && !open && !cinematic && <button type="button" className="abbot-nearby" onClick={showStory}>
      <MessageCircle size={16} aria-hidden="true" /><span>云隐住持</span><strong>聊一聊</strong>
    </button>}

    {cinematic && <aside className="abbot-cinematic" aria-live="polite">
      <div><span className="abbot-caption">{cinematic === "greeting" ? "住持开示" : "莲灯传心"}</span>
        <p>{cinematic === "greeting" ? "老住持轻拢袈裟，拈花相迎。" : "住持托起莲灯，愿这点微光陪你前行。"}</p>
      </div>
      {props.onSkipCinematic && <button type="button" onClick={props.onSkipCinematic}>跳过动画</button>}
    </aside>}

    {open && !cinematic && createPortal(<div className="abbot-dialog-layer" onClick={() => setOpen(false)}>
      <section ref={panel} className="abbot-panel" role="dialog" aria-modal="true" aria-labelledby="abbot-story-title" onClick={event => event.stopPropagation()}>
        <header className="abbot-heading">
          <div><span className="abbot-caption">云隐住持 · 寺院奇遇</span><h2 id="abbot-story-title">一盏照心灯</h2></div>
          <button type="button" className="abbot-icon-button" aria-label="收起住持剧情" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
        </header>

        {progress?.rewarded ? <>
          <p className="abbot-speech">“你已为这座山留下一点光。往后的路，就让它陪你慢慢走。”</p>
          <div className="abbot-reward"><Flame size={24} aria-hidden="true" /><div><strong>已获云隐莲灯</strong><span>随身莲灯与称号「照心行者」已解锁。</span></div></div>
          <p className="abbot-body-small">莲灯会跟随你的小和尚，照亮接下来的山中行程。</p>
        </> : !progress?.accepted ? <>
          <p className="abbot-speech">{heard ? "“山里有一盏旧灯，等了很久。你若愿意，先安住自己的心，再为旁人留一枝花。回来时，我们一起点亮它。”" : "老和尚停下木杖，银眉下藏着笑意。“小师父，山路上的风，可曾把你的心吹乱了？”"}</p>
          {canTalk ? <button type="button" className="abbot-primary" disabled={busy} onClick={heard ? () => void submit("accept") : listen}>{busy ? "正在记下这段缘分…" : heard ? "愿修这一盏灯" : "聆听住持"}</button> : <p className="abbot-body-small">找到住持，走近后与他交谈，会开启一段山中故事。</p>}
        </> : <>
          <p className="abbot-speech">{ready ? "“心安，花开。回来吧，我们把这盏灯点亮。”" : "“先合掌，让纷乱的念头落定。再供一枝花，将温柔留在这座山上。”"}</p>
          <ul className="abbot-tasks" aria-label="照心灯修行进度">
            <li className={progress.prayer ? "is-complete" : ""}><span className="abbot-task-check">{progress.prayer && <Check size={14} aria-hidden="true" />}</span><div><strong>合掌静心</strong><p>在庭院蒲团入座后，完成一次合掌。</p></div><span className="abbot-caption">{progress.prayer ? "已完成" : "待完成"}</span></li>
            <li className={progress.flower ? "is-complete" : ""}><span className="abbot-task-check">{progress.flower && <Check size={14} aria-hidden="true" />}</span><div><strong>供一枝鲜花</strong><p>去大殿前供花，完成免费献花动作。</p></div><span className="abbot-caption">{progress.flower ? "已完成" : "待完成"}</span></li>
          </ul>
          {ready && canTalk && <button type="button" className="abbot-primary" disabled={busy} onClick={() => void submit("complete")}>{busy ? "正在点亮照心灯…" : "请住持点灯"}</button>}
          {!ready && <button type="button" className="abbot-primary" onClick={() => setOpen(false)}>去修这一盏灯</button>}
        </>}

        {!canTalk && <div className="abbot-location">
          <p className="abbot-body-small"><MapPin size={14} aria-hidden="true" />{encounter?.active ? `住持正在${encounter.location.name}。` : "住持暂时云游去了，下一次现身时会通知你。"}</p>
          {progress?.accepted && !encounter?.active && <p className="abbot-caption">修行进度已保留，可以继续合掌、供花，待住持归来再点灯。</p>}
          {encounter?.active && <button type="button" className="abbot-secondary" onClick={navigate}>循着行踪前往<ChevronRight size={14} aria-hidden="true" /></button>}
        </div>}
        {(failure || error) && <p className="abbot-error" role="alert">{failure || error}</p>}
      </section>
    </div>, document.body)}
  </>;
}
