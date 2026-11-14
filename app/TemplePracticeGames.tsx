import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, X } from "lucide-react";
import { PRACTICE_GAMES, type PracticeGameKind, type PracticeGamesSnapshot } from "./practiceGames";
import "./practice-games.css";

function PropPreview({ kind, tier, name }: { kind: PracticeGameKind; tier: number; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let cleanup = () => {};
    setFailed(false);
    void (async () => {
      try {
        const [T, { createPracticeProp }, { RoomEnvironment }] = await Promise.all([import("three"), import("./three/practiceModels"), import("three/addons/environments/RoomEnvironment.js")]);
        const node = host.current;
        if (!alive || !node) return;
        const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1;
        const scene = new T.Scene();
        const room = new RoomEnvironment();
        const generator = new T.PMREMGenerator(renderer);
        const reflection = generator.fromScene(room, .04);
        scene.environment = reflection.texture;
        scene.environmentIntensity = .55;
        room.dispose();
        generator.dispose();
        const camera = new T.PerspectiveCamera(34, 1, .01, 20);
        const prop = createPracticeProp(kind, tier);
        const box = new T.Box3().setFromObject(prop.group);
        const center = box.getCenter(new T.Vector3());
        const radius = Math.max(.1, box.getSize(new T.Vector3()).length() * .5);
        prop.group.position.sub(center);
        const turntable = new T.Group();
        turntable.add(prop.group);
        scene.add(turntable, new T.HemisphereLight(0xfff1d6, 0x577d72, 1.3));
        const key = new T.DirectionalLight(0xffe2b4, 2);
        key.position.set(-2, 3, 4);
        scene.add(key);
        camera.position.set(radius * (kind === "beads" ? .45 : 1.3), radius * (kind === "beads" ? .35 : .8), radius * (kind === "beads" ? 3.2 : 2.45));
        camera.lookAt(0, 0, 0);
        node.appendChild(renderer.domElement);
        const resize = () => {
          const width = Math.max(1, node.clientWidth), height = Math.max(1, node.clientHeight);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(node);
        resize();
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let frame = 0;
        const draw = (time: number) => {
          if (!alive) return;
          turntable.rotation.y = reducedMotion ? -.35 : -.35 + Math.sin(time / 3500) * .35;
          renderer.render(scene, camera);
          frame = requestAnimationFrame(draw);
        };
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          prop.dispose();
          reflection.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
        frame = requestAnimationFrame(draw);
      } catch { if (alive) setFailed(true); }
    })();
    return () => { alive = false; cleanup(); };
  }, [kind, tier]);
  return <div className="practice-model" ref={host} role="img" aria-label={`${name}三维模型`}>{failed && <span>模型预览暂时无法显示</span>}</div>;
}

type Props = {
  open: boolean;
  snapshot: PracticeGamesSnapshot;
  error: string;
  busy: boolean;
  onClose: () => void;
  onPlay: (kind: PracticeGameKind) => void;
  onRetry: () => void;
};

export default function TemplePracticeGames({ open, snapshot, error, busy, onClose, onPlay, onRetry }: Props) {
  const [kind, setKind] = useState<PracticeGameKind>("wood");
  const [previewTier, setPreviewTier] = useState<number | null>(null);
  const panel = useRef<HTMLElement>(null);
  const callback = useRef(onClose);
  callback.current = onClose;
  const game = PRACTICE_GAMES.find(item => item.id === kind)!;
  const progress = snapshot.games[kind];
  const shown = previewTier ?? progress.tier;
  const tier = game.tiers[shown];
  const next = game.tiers[progress.tier + 1];
  const current = game.tiers[progress.tier];

  useEffect(() => {
    if (!open) return;
    setPreviewTier(null);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); callback.current(); }
      if (event.key !== "Tab") return;
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); if (previous?.isConnected) previous.focus(); };
  }, [open]);

  if (!open) return null;
  return createPortal(<div className="practice-games-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className="practice-games-panel" role="dialog" aria-modal="true" aria-labelledby="practice-games-title">
      <header><div><p>云间小修行</p><h2 id="practice-games-title">一点一滴，慢慢进阶</h2></div><button className="practice-games-close" onClick={onClose} aria-label="关闭修行小游戏"><X size={20} /></button></header>
      <div className="practice-game-tabs" role="tablist" aria-label="选择修行小游戏">{PRACTICE_GAMES.map(item => <button key={item.id} role="tab" aria-selected={kind === item.id} onClick={() => { setKind(item.id); setPreviewTier(null); }}>{item.name}</button>)}</div>
      <PropPreview kind={kind} tier={shown} name={tier.name} />
      <div className="practice-model-title"><h3>{tier.name}</h3><span>{shown > progress.tier ? `${tier.points}分解锁` : shown === progress.tier ? "正在使用" : "已收藏"}</span></div>
      <p className="practice-model-description">{tier.description}</p>
      <div className="practice-game-score"><strong>{progress.score}<small>分</small></strong><span>{next ? `再得${next.points - progress.score}分，解锁${next.name}` : "五阶已全部解锁"}</span></div>
      {next && <progress aria-label={`${game.name}距离下一阶的进度`} max={next.points - current.points} value={progress.score - current.points} />}
      <div className="practice-tier-list" aria-label="五阶模型收藏">{game.tiers.map((item, index) => <button key={item.name} className={shown === index ? "is-selected" : ""} aria-pressed={shown === index} onClick={() => setPreviewTier(index)}><span>{index <= progress.tier && <Check size={12} aria-hidden="true" />}{item.points === 0 ? "初始" : `${item.points}分`}</span><strong>{item.name}</strong></button>)}</div>
      <p className="practice-game-rule">{kind === "wood" ? "每敲一下木鱼得1分，10、20、50、100分依次进阶。" : kind === "beads" ? "在蒲团上完成一次转珠得1分，5、10、20、50分依次进阶。" : "完成一次免费供花得1分，3、5、10、20分依次进阶。"}满级后仍可继续游玩。</p>
      {error && <div className="practice-games-error" role="alert"><span>{error}</span><button onClick={onRetry} disabled={busy}>重试保存</button></div>}
      <button className="practice-game-play" onClick={() => onPlay(kind)}>{game.actionLabel}<ChevronRight size={18} /></button>
      <p className="practice-games-save">{busy ? "正在保存进度…" : "进度随小和尚保存，本机保留恢复备份"}</p>
    </section>
  </div>, document.body);
}
