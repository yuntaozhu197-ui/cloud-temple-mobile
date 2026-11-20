import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BellRing, Download, Footprints, Lightbulb, Link2, PawPrint, RotateCcw, Search, X } from "lucide-react";
import { makeCatShareUrl, TEMPLE_CAT_TITLE, type TempleCatEvent } from "./templeCat";
import { downloadTempleCatCard } from "./templeCatCard";
import "./temple-cat.css";

type Props = {
  day: string;
  playerId: string;
  phase: "intro" | "search" | "reveal" | "found";
  elapsedSeconds: number | null;
  worldReady: boolean;
  goal: "tracks" | "cat";
  hint: string;
  feedback: string;
  nearbyLabel: string | null;
  onStart: () => void;
  onClose: () => void;
  onHint: () => void;
  onInspect: () => void;
  onShowResult: () => void;
  onEvent: (event: TempleCatEvent) => void;
};

function storedTime(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    const seconds = Number(raw);
    return raw && Number.isInteger(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : null;
  } catch { return null; }
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

export default function TempleCatGame(props: Props) {
  const { day, playerId, phase, elapsedSeconds, worldReady, goal, hint, feedback, nearbyLabel, onStart, onClose, onHint, onInspect, onShowResult, onEvent } = props;
  const stampKey = `cloud-temple-cat-trail-stamp:${playerId}:${day}`;
  const [bestTime, setBestTime] = useState(() => storedTime(stampKey));
  const [legacyStamp] = useState(() => storedTime(`cloud-temple-cat-stamp:${playerId}:${day}`) !== null);
  const [shareStatus, setShareStatus] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const resultButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    if (phase === "search") heading.current?.focus({ preventScroll: true });
    else if (phase === "reveal") resultButton.current?.focus({ preventScroll: true });
    else if (phase === "found") panel.current?.querySelector<HTMLButtonElement>(".temple-cat-share-actions .temple-cat-primary")?.focus({ preventScroll: true });
    else closeButton.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    if (elapsedSeconds === null || (phase !== "reveal" && phase !== "found")) return;
    const record = Math.min(storedTime(stampKey) ?? elapsedSeconds, elapsedSeconds);
    setBestTime(previous => Math.min(previous ?? record, record));
    try { localStorage.setItem(stampKey, String(record)); } catch { /* Retain the result for this session. */ }
  }, [phase, elapsedSeconds, stampKey]);

  function onModalKeyDown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
    if (event.key === "Tab") {
      const focusable = panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  function startRound() {
    setShareStatus("");
    setShowLink(false);
    onStart();
  }

  async function shareChallenge() {
    if (shareBusy || elapsedSeconds === null) return;
    setShareBusy(true);
    setShareStatus("");
    setShowLink(false);
    const url = makeCatShareUrl(day);
    const data = { title: TEMPLE_CAT_TITLE, text: `我在云间寺找到了猫，用了 ${formatTime(elapsedSeconds)}。来找找它藏在哪儿。`, url };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        try {
          await navigator.share(data);
          setShareStatus("挑战已分享。");
          onEvent("share");
          return;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
        }
      }
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(url);
      setShareStatus("已复制本关链接，发给朋友即可挑战同一关。");
      onEvent("share");
    } catch {
      setShowLink(true);
      setShareStatus("可以长按复制本关链接。");
    } finally { setShareBusy(false); }
  }

  async function saveCard() {
    if (shareBusy || elapsedSeconds === null) return;
    setShareBusy(true);
    setShowLink(false);
    try {
      await downloadTempleCatCard({ day, seconds: elapsedSeconds });
      setShareStatus("分享卡已生成，可发给朋友。");
      onEvent("share");
    } catch { setShareStatus("分享卡暂未保存，请再试一次。"); }
    finally { setShareBusy(false); }
  }

  if (phase === "search" || phase === "reveal") {
    const revealed = phase === "reveal";
    return <aside className="temple-cat-hud" aria-labelledby="temple-cat-hud-title">
      <div className="temple-cat-hud-panel">
        <header>
          <h2 id="temple-cat-hud-title" ref={heading} tabIndex={-1}>
            <PawPrint size={17} aria-hidden="true" />{revealed ? "金铃找回来了" : goal === "tracks" ? "1/2 找脚印" : "2/2 找寺猫"}
          </h2>
          {!revealed && <button type="button" className="temple-cat-secondary" onClick={onHint}>
            <Lightbulb size={15} aria-hidden="true" />看线索
          </button>}
          <button type="button" className="temple-cat-close" aria-label="退出寻猫" onClick={onClose}><X size={20} aria-hidden="true" /></button>
        </header>
        {revealed
          ? <p role="status">猫带着金铃现身了。</p>
          : <div className="temple-cat-hud-notes" aria-live="polite">
              <p>{hint || (nearbyLabel ? "走近了，可以查看这里。" : "在寺院里走走，靠近可疑的角落。")}</p>
              {feedback && <p className="temple-cat-feedback">{feedback}</p>}
            </div>}
      </div>
      {(revealed || nearbyLabel) && <div className="temple-cat-world-action">
        {revealed
          ? <button type="button" ref={resultButton} className="temple-cat-primary" onClick={onShowResult}>
              查看成绩 <ArrowRight size={17} aria-hidden="true" />
            </button>
          : <>
              <span id="temple-cat-nearby" role="status">{nearbyLabel}</span>
              <button type="button" className="temple-cat-primary" aria-describedby="temple-cat-nearby" onClick={onInspect}>
                <Search size={16} aria-hidden="true" />{goal === "tracks" ? "查看踪迹" : "查看藏身处"}
              </button>
            </>}
      </div>}
    </aside>;
  }

  return createPortal(<div className="temple-cat-overlay">
    <section ref={panel} className="temple-cat-panel" aria-modal="true" role="dialog" aria-labelledby="temple-cat-title" onKeyDown={onModalKeyDown}>
      <header className="temple-cat-header">
        <div>
          <p className="temple-cat-date"><BellRing size={14} strokeWidth={1.8} aria-hidden="true" /><time dateTime={day}>{day.slice(5).replace("-", "月")}日</time></p>
          <h2 id="temple-cat-title">{phase === "intro" ? TEMPLE_CAT_TITLE : "金铃找回来了"}</h2>
        </div>
        <button ref={closeButton} className="temple-cat-close" type="button" aria-label="关闭寻猫小游戏" onClick={onClose}><X size={22} aria-hidden="true" /></button>
      </header>

      <div className="temple-cat-controls">
        {phase === "intro" ? <>
          <div className="temple-cat-intro">
            <div className="temple-cat-stamp" aria-hidden="true"><PawPrint size={25} strokeWidth={2.1} /></div>
            <div>
              <p className="temple-cat-instruction">先在寺院里找到脚印，再循着新线索去找猫。</p>
              <p className="temple-cat-detail">拖动摇杆或轻点地面。走近后就能查看。</p>
            </div>
          </div>
          <button className="temple-cat-primary" type="button" onClick={startRound} disabled={!worldReady}>
            <Footprints size={17} aria-hidden="true" />{worldReady ? "出发找猫" : "正准备寺院场景…"}{worldReady && <ArrowRight size={17} aria-hidden="true" />}
          </button>
          {bestTime !== null && <p className="temple-cat-detail">已收下本关猫爪印章 · 最快 {formatTime(bestTime)}</p>}
          {bestTime === null && legacyStamp && <p className="temple-cat-detail">已收下本关原版猫爪印章</p>}
        </> : <>
          <div className="temple-cat-found" role="status">
            <div className="temple-cat-stamp" aria-hidden="true"><PawPrint size={25} strokeWidth={2.1} /></div>
            <div><h3>获得猫爪印章</h3><p>本局 {formatTime(elapsedSeconds ?? 1)}</p></div>
          </div>
          <div className="temple-cat-share-actions">
            <button className="temple-cat-primary" type="button" disabled={shareBusy} onClick={() => void shareChallenge()}><Link2 size={17} aria-hidden="true" />分享挑战</button>
            <button className="temple-cat-secondary" type="button" disabled={shareBusy} onClick={() => void saveCard()}><Download size={17} aria-hidden="true" />保存分享卡</button>
          </div>
          <div className="temple-cat-replay-line">
            <button className="temple-cat-link" type="button" disabled={shareBusy || !worldReady} onClick={startRound}><RotateCcw size={15} aria-hidden="true" />再玩一局</button>
            {bestTime !== null && <p className="temple-cat-detail">最快 {formatTime(bestTime)}</p>}
          </div>
          {shareStatus && <p className="temple-cat-detail" role="status">{shareStatus}</p>}
          {showLink && <input className="temple-cat-copy-field" aria-label="本关挑战链接" value={makeCatShareUrl(day)} readOnly onFocus={event => event.currentTarget.select()} />}
        </>}
      </div>
    </section>
  </div>, document.body);
}
