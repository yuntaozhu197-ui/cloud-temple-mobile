import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BellRing, Check, Download, House, Lightbulb, Link2, Mountain, PawPrint, RotateCcw, Trees, X } from "lucide-react";
import { CAT_HIDEOUTS, makeCatShareUrl, TEMPLE_CAT_TITLE, type CatHideout } from "./templeCat";
import { downloadTempleCatCard } from "./templeCatCard";
import "./temple-cat.css";

type Stage = "intro" | "search" | "found";
type Round = { stage: Stage; began: number; inspected: CatHideout[] };
type Props = {
  day: string;
  hideout: CatHideout;
  playerId: string;
  onClose: () => void;
  onEvent: (event: "start" | "complete" | "share") => void;
};

const PLACES = {
  bamboo: { name: "竹影边", Icon: Trees, empty: "竹叶一抖，只落下了一片叶子。", clue: "风停了，成排的竹叶还在轻轻晃。" },
  eaves: { name: "瓦檐下", Icon: House, empty: "屋檐下只有一阵穿堂风。", clue: "顺着一小串爪印往上看，青瓦边闪过一点金光。" },
  stones: { name: "叠石旁", Icon: Mountain, empty: "叠石后只有一盏还亮着的小灯。", clue: "铃响了一声，石头叠起来的地方藏着一点动静。" },
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

type SceneProps = {
  round: Round;
  hideout: CatHideout;
  capture: { current: (() => string | undefined) | null };
  children: ReactNode;
};

function CatDiorama({ round, hideout, capture, children }: SceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const pins = useRef<HTMLDivElement>(null);
  const latest = useRef({ round, hideout });
  latest.current = { round, hideout };
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    let active = true;
    const cleanups: (() => void)[] = [];
    const release = () => {
      capture.current = null;
      cleanups.splice(0).reverse().forEach(cleanup => cleanup());
    };

    void (async () => {
      try {
        const [T, { createTempleCatScene }] = await Promise.all([import("three"), import("./three/templeCatScene")]);
        const target = host.current;
        const pinLayer = pins.current;
        if (!active || !target || !pinLayer) return;

        const model = createTempleCatScene();
        cleanups.push(() => model.dispose());
        const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
        const canvas = renderer.domElement;
        cleanups.push(() => { renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); });
        canvas.setAttribute("aria-hidden", "true");
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        target.appendChild(canvas);

        const projected = new T.Vector3();
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        let lost = false;
        let frame = 0;
        let previous: Round | undefined;
        let stageBegan = 0;
        let lastDraw = -Infinity;

        function positionPins() {
          model.camera.updateMatrixWorld();
          for (const place of CAT_HIDEOUTS) {
            projected.copy(model.hotspots[place]).project(model.camera);
            const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
            pinLayer!.style.setProperty(`--cat-${place}-x`, `${clamp((projected.x + 1) / 2, .16, .84) * 100}%`);
            pinLayer!.style.setProperty(`--cat-${place}-y`, `${clamp((1 - projected.y) / 2, .15, .81) * 100}%`);
          }
        }

        function draw(time: number) {
          const { round: current, hideout: spot } = latest.current;
          if (previous?.stage !== current.stage) stageBegan = time;
          model.update(current.stage, Math.max(0, (time - stageBegan) / 1000), spot, current.inspected, media.matches);
          renderer.render(model.scene, model.camera);
          if (current.stage === "search") positionPins();
          previous = current;
          lastDraw = time;
        }

        function resize() {
          if (lost) return;
          const width = Math.max(1, target!.clientWidth);
          const height = Math.max(1, target!.clientHeight);
          renderer.setSize(width, height, false);
          model.camera.aspect = width / height;
          model.camera.updateProjectionMatrix();
          draw(performance.now());
        }

        function animate(time: number) {
          if (!active) return;
          frame = requestAnimationFrame(animate);
          if (document.hidden || lost) return;
          const current = latest.current.round;
          if (current !== previous || (!media.matches && time - lastDraw > 32)) draw(time);
        }

        const onContextLost = (event: Event) => {
          event.preventDefault();
          lost = true;
          if (active) setStatus("fallback");
        };
        const onContextRestored = () => {
          lost = false;
          resize();
          if (active) setStatus("ready");
        };
        canvas.addEventListener("webglcontextlost", onContextLost);
        canvas.addEventListener("webglcontextrestored", onContextRestored);
        const onMotionPreference = () => { if (!lost) draw(performance.now()); };
        if (media.addEventListener) media.addEventListener("change", onMotionPreference);
        else media.addListener(onMotionPreference);
        cleanups.push(() => {
          cancelAnimationFrame(frame);
          if (media.removeEventListener) media.removeEventListener("change", onMotionPreference);
          else media.removeListener(onMotionPreference);
          canvas.removeEventListener("webglcontextlost", onContextLost);
          canvas.removeEventListener("webglcontextrestored", onContextRestored);
        });

        const observer = new ResizeObserver(resize);
        observer.observe(target);
        cleanups.push(() => observer.disconnect());
        resize();
        setStatus("ready");
        frame = requestAnimationFrame(animate);
        capture.current = () => {
          if (lost) return undefined;
          try {
            // The opening pose shows the cat and bell before the cat moves toward any hideout.
            model.update("intro", .71, latest.current.hideout, [], false);
            renderer.render(model.scene, model.camera);
            const preview = canvas.toDataURL("image/png");
            return preview === "data:," ? undefined : preview;
          } catch { return undefined; }
          finally { draw(performance.now()); }
        };
      } catch {
        release();
        if (active) setStatus("fallback");
      }
    })();
    return () => { active = false; release(); };
  }, [capture]);

  return <div className="temple-cat-scene" data-scene-status={status} data-stage={round.stage}>
    <div className="temple-cat-canvas" ref={host} />
    {status !== "ready" && <div className="temple-cat-scene-placeholder" aria-hidden="true">
      <span><BellRing size={28} strokeWidth={1.5} /></span>
    </div>}
    <div className="temple-cat-pins" ref={pins}>{children}</div>
  </div>;
}

export default function TempleCatGame({ day, hideout, playerId, onClose, onEvent }: Props) {
  const stampKey = `cloud-temple-cat-stamp:${playerId}:${day}`;
  const [bestTime, setBestTime] = useState(() => storedTime(stampKey));
  const [round, setRound] = useState<Round>(() => ({ stage: "intro", began: performance.now(), inspected: [] }));
  const [finishTime, setFinishTime] = useState<number | null>(null);
  const [clue, setClue] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const capture = useRef<(() => string | undefined) | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButton.current?.focus();
    return () => { if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, []);

  useEffect(() => {
    if (round.stage === "intro") return;
    const selector = round.stage === "search" ? ".temple-cat-pin" : ".temple-cat-share-actions .temple-cat-primary";
    panel.current?.querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true });
  }, [round.stage]);

  function onKeyDown(event: KeyboardEvent) {
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
    onEvent("start");
    setClue("仔细看，再点一个角落找找。");
    setShareStatus("");
    setShowLink(false);
    setFinishTime(null);
    setRound({ stage: "search", began: performance.now(), inspected: [] });
  }

  function inspect(place: CatHideout) {
    if (round.stage !== "search" || round.inspected.includes(place)) return;
    if (place !== hideout) {
      setClue(PLACES[place].empty);
      setRound({ ...round, inspected: [...round.inspected, place] });
      return;
    }

    const seconds = Math.max(1, Math.min(86_400, Math.round((performance.now() - round.began) / 1000)));
    const best = Math.min(bestTime ?? seconds, seconds);
    setFinishTime(seconds);
    setBestTime(best);
    try { localStorage.setItem(stampKey, String(best)); } catch { /* Keep the in-session stamp if storage is disabled. */ }
    setRound({ stage: "found", began: performance.now(), inspected: round.inspected });
    onEvent("complete");
  }

  async function shareChallenge() {
    if (shareBusy) return;
    setShareBusy(true);
    setShareStatus("");
    setShowLink(false);
    const url = makeCatShareUrl(day);
    const data = { title: TEMPLE_CAT_TITLE, text: `我在云间寺找到了猫，用了 ${formatTime(finishTime ?? bestTime ?? 1)}。来找找它藏在哪儿。`, url };
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
    if (shareBusy || finishTime === null) return;
    setShareBusy(true);
    setShowLink(false);
    try {
      await downloadTempleCatCard({ day, seconds: finishTime, preview: capture.current?.() });
      setShareStatus("分享卡已生成，可发给朋友。");
      onEvent("share");
    } catch { setShareStatus("分享卡暂未保存，请再试一次。"); }
    finally { setShareBusy(false); }
  }

  return createPortal(<div className="temple-cat-overlay">
    <section ref={panel} className="temple-cat-panel" aria-modal="true" role="dialog" aria-labelledby="temple-cat-title" onKeyDown={onKeyDown}>
      <header className="temple-cat-header">
        <div>
          <p className="temple-cat-date"><BellRing size={14} strokeWidth={1.8} aria-hidden="true" /><time dateTime={day}>{day.slice(5).replace("-", "月")}日</time></p>
          <h2 id="temple-cat-title">{TEMPLE_CAT_TITLE}</h2>
        </div>
        <button ref={closeButton} className="temple-cat-close" type="button" aria-label="关闭寻猫小游戏" onClick={onClose}><X size={22} aria-hidden="true" /></button>
      </header>

      <CatDiorama round={round} hideout={hideout} capture={capture}>
        {round.stage === "search" && CAT_HIDEOUTS.map(place => {
          const { name, Icon } = PLACES[place];
          const checked = round.inspected.includes(place);
          return <button key={place} className="temple-cat-pin" type="button" data-place={place} aria-disabled={checked} aria-label={checked ? `${name}已找过` : `查看${name}`} onClick={() => inspect(place)}>
            {checked ? <Check size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
            <span>{name}</span>
          </button>;
        })}
      </CatDiorama>

      <div className="temple-cat-controls" data-stage={round.stage}>
        {round.stage === "intro" && <>
          <p className="temple-cat-instruction">猫叼着铃铛跑了。跟上它，看看它躲在院子哪个角落。</p>
          <button className="temple-cat-primary" type="button" onClick={startRound}>跟上它 <ArrowRight size={18} aria-hidden="true" /></button>
          {bestTime !== null && <p className="temple-cat-detail">已收下本关猫爪印章 · 最快 {formatTime(bestTime)}</p>}
        </>}
        {round.stage === "search" && <>
          <p role="status" className="temple-cat-instruction">{clue}</p>
          <button className="temple-cat-secondary temple-cat-hint" type="button" onClick={() => setClue(PLACES[hideout].clue)}><Lightbulb size={16} aria-hidden="true" /> 看线索</button>
        </>}
        {round.stage === "found" && <>
          <div className="temple-cat-found" role="status">
            <div className="temple-cat-stamp" aria-hidden="true"><PawPrint size={25} strokeWidth={2.3} /></div>
            <div><h3>金铃找回来了</h3><p>获得猫爪印章 · 本局 {formatTime(finishTime ?? 1)}</p></div>
          </div>
          <div className="temple-cat-share-actions">
            <button className="temple-cat-primary" type="button" disabled={shareBusy} onClick={() => void shareChallenge()}><Link2 size={17} aria-hidden="true" /> 分享挑战</button>
            <button className="temple-cat-secondary" type="button" disabled={shareBusy} onClick={() => void saveCard()}><Download size={17} aria-hidden="true" /> 保存分享卡</button>
          </div>
          <div className="temple-cat-replay-line">
            <button className="temple-cat-link" type="button" disabled={shareBusy} onClick={startRound}><RotateCcw size={14} aria-hidden="true" /> 再玩一局</button>
            {bestTime !== null && <p className="temple-cat-detail">最快 {formatTime(bestTime)}</p>}
          </div>
          {shareStatus && <p className="temple-cat-detail" role="status">{shareStatus}</p>}
          {showLink && <input className="temple-cat-copy-field" aria-label="本关挑战链接" value={makeCatShareUrl(day)} readOnly onFocus={event => event.currentTarget.select()} />}
        </>}
      </div>
    </section>
  </div>, document.body);
}
