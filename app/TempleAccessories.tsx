import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, LockKeyhole, X } from "lucide-react";
import {
  ABBOT_ACCESSORIES,
  ABBOT_ACCESSORY_SLOTS,
  ABBOT_ACCESSORY_SLOT_LABELS,
  getAbbotAccessory,
  type AbbotAccessoryId,
  type AbbotAccessorySlot,
} from "../abbot-accessories.mjs";
import type { AbbotSnapshot } from "./abbotQuest";
import "./accessories.css";

function AccessoryPreview({ id, name }: { id: AbbotAccessoryId; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    let alive = true;
    const releases: (() => void)[] = [];
    const cleanup = () => { releases.splice(0).reverse().forEach(release => release()); };
    setState("loading");
    void (async () => {
      try {
        const [T, { createAbbotAccessory }, { RoomEnvironment }] = await Promise.all([
          import("three"), import("./three/abbotAccessories"), import("three/addons/environments/RoomEnvironment.js"),
        ]);
        const node = host.current;
        if (!alive || !node) return;
        const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
        releases.push(() => { renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1;
        const scene = new T.Scene();
        const room = new RoomEnvironment();
        const generator = new T.PMREMGenerator(renderer);
        const reflection = (() => {
          try { return generator.fromScene(room, .04); }
          finally { room.dispose(); generator.dispose(); }
        })();
        releases.push(() => reflection.dispose());
        scene.environment = reflection.texture;
        scene.environmentIntensity = .55;
        const accessory = createAbbotAccessory(id);
        releases.push(() => accessory.dispose());
        accessory.animate(0);
        const box = new T.Box3().setFromObject(accessory.group);
        const center = box.getCenter(new T.Vector3());
        const size = box.getSize(new T.Vector3());
        const sculpture = new T.Group();
        sculpture.position.copy(center).negate();
        sculpture.add(accessory.group);
        const turntable = new T.Group();
        turntable.add(sculpture);
        scene.add(turntable, new T.HemisphereLight(0xfff1d6, 0x647e70, 1.3));
        const key = new T.DirectionalLight(0xffe4c4, 2.2);
        key.position.set(-2, 3, 4);
        scene.add(key);
        const camera = new T.PerspectiveCamera(32, 1, .01, 20);
        const resize = () => {
          const width = Math.max(1, node.clientWidth), height = Math.max(1, node.clientHeight);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          const halfView = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
          const distance = Math.max(size.y / (2 * halfView), size.x / (2 * halfView * camera.aspect)) * 1.2 + size.z;
          camera.position.set(distance * .12, distance * .05, distance);
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
        };
        node.appendChild(renderer.domElement);
        const observer = new ResizeObserver(resize);
        releases.push(() => observer.disconnect());
        observer.observe(node);
        resize();
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let frame = 0;
        releases.push(() => cancelAnimationFrame(frame));
        const draw = (time: number) => {
          if (!alive) return;
          accessory.animate(reducedMotion ? 0 : time / 1000);
          turntable.rotation.y = reducedMotion ? -.15 : -.15 + Math.sin(time / 3800) * .3;
          renderer.render(scene, camera);
          frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
        if (alive) setState("ready");
      } catch {
        cleanup();
        if (alive) setState("failed");
      }
    })();
    return () => { alive = false; cleanup(); };
  }, [id]);
  return <div className="accessory-preview" ref={host} role="img" aria-label={`${name}三维模型`}>
    {state === "loading" && <div className="accessory-preview-loading" role="status" aria-label="正在展示饰品" />}
    {state === "failed" && <p className="accessory-caption">饰品预览暂时无法显示，可重新打开查看。</p>}
  </div>;
}

type Props = {
  open: boolean;
  snapshot: AbbotSnapshot | null;
  onClose: () => void;
  onEquip: (id: AbbotAccessoryId | null, slot?: AbbotAccessorySlot) => Promise<void>;
};

export default function TempleAccessories({ open, snapshot, onClose, onEquip }: Props) {
  const [selected, setSelected] = useState<AbbotAccessoryId>(ABBOT_ACCESSORIES[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const panel = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const current = useRef({ onClose, onEquip });
  current.current = { onClose, onEquip };
  const pending = useRef(false);
  const selectionStarted = useRef(false);
  const mounted = useRef(true);
  const equipped = snapshot?.wardrobe.equippedBySlot;
  const unlocked = snapshot?.wardrobe.unlocked ?? [];
  const firstWorn = ABBOT_ACCESSORY_SLOTS.map(slot => equipped?.[slot]).find(Boolean);
  const initialSelection = firstWorn ?? unlocked[0] ?? ABBOT_ACCESSORIES[0].id;
  const item = getAbbotAccessory(selected)!;
  const slotLabel = ABBOT_ACCESSORY_SLOT_LABELS[item.slot];
  const wornInSlot = getAbbotAccessory(equipped?.[item.slot]);
  const ownsSelected = unlocked.includes(selected);
  const wearingSelected = wornInSlot?.id === selected;
  const replacing = ownsSelected && wornInSlot && !wearingSelected;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    selectionStarted.current = false;
    setSelected(initialSelection);
    setError("");
    setNotice("");
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); current.current.onClose(); return; }
      if (event.key !== "Tab") return;
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!first || !last) return;
      if (!panel.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
    // Keep the chosen preview steady while wardrobe snapshots refresh.
  }, [open]);

  useEffect(() => {
    if (!open || !snapshot || selectionStarted.current) return;
    selectionStarted.current = true;
    setSelected(initialSelection);
  }, [open, snapshot, initialSelection]);

  function preview(id: AbbotAccessoryId, scrollToPreview = false) {
    selectionStarted.current = true;
    setSelected(id);
    setError("");
    setNotice("");
    if (scrollToPreview && content.current) content.current.scrollTop = 0;
  }

  async function equip(id: AbbotAccessoryId | null, slot: AbbotAccessorySlot) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await current.current.onEquip(id, slot);
      if (mounted.current) setNotice(id ? `已佩戴${getAbbotAccessory(id)!.name}` : `已卸下${ABBOT_ACCESSORY_SLOT_LABELS[slot]}饰品`);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : "饰品没有保存成功，请重新操作。");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (!open) return null;
  return createPortal(<div className="accessories-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className="accessories-panel" role="dialog" aria-modal="true" aria-labelledby="accessories-title">
      <header>
        <div className="accessories-heading">
          <div><p className="accessory-caption">住持赠礼 · 已收藏{unlocked.length}件</p><h2 id="accessories-title">称号饰品</h2></div>
          <button className="accessory-close" type="button" onClick={onClose} aria-label="关闭称号饰品"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="accessory-outfit" role="group" aria-label="当前佩戴">
          {ABBOT_ACCESSORY_SLOTS.map(slot => {
            const worn = getAbbotAccessory(equipped?.[slot]);
            const label = ABBOT_ACCESSORY_SLOT_LABELS[slot];
            if (!worn) return <div className="accessory-slot" key={slot}><span>{label}</span><strong>{snapshot ? "未佩戴" : "加载中"}</strong></div>;
            const active = selected === worn.id;
            return <button key={slot} className={`accessory-slot is-worn${active ? " is-selected" : ""}`} type="button" aria-pressed={active} onClick={() => preview(worn.id, true)}>
              <span>{label}</span>
              <strong>{worn.name}</strong>
            </button>;
          })}
        </div>
      </header>
      <div className="accessories-content" ref={content}>
        <AccessoryPreview id={selected} name={item.name} />
        <div className="accessory-name"><h3>{item.name}</h3><span className="accessory-caption">{slotLabel} · {wearingSelected ? "佩戴中" : ownsSelected ? "已收藏" : "待解锁"}</span></div>
        <p className="accessory-description">{item.description}</p>
        <p className="accessory-unlock">{ownsSelected ? `「${item.title}」专属赠礼` : `获得称号「${item.title}」后解锁`}</p>
        {!snapshot && <p className="accessory-caption" role="status">正在查看你的称号收藏…</p>}
        <div className="accessory-collection" role="group" aria-label="九款称号饰品收藏">
          {ABBOT_ACCESSORIES.map(accessory => {
            const owned = unlocked.includes(accessory.id);
            const wearing = equipped?.[accessory.slot] === accessory.id;
            return <button key={accessory.id} type="button" className={selected === accessory.id ? "is-selected" : ""} aria-pressed={selected === accessory.id} onClick={() => preview(accessory.id)}>
              <span className="accessory-collection-state"><span className="accessory-color" style={{ backgroundColor: accessory.color }} aria-hidden="true" />{wearing ? <Check size={12} aria-hidden="true" /> : !owned ? <LockKeyhole size={12} aria-hidden="true" /> : null}<span>{wearing ? "佩戴中" : owned ? "已收藏" : "待解锁"}</span></span>
              <strong>{accessory.name}</strong><span className="accessory-collection-title">{accessory.title}</span>
            </button>;
          })}
        </div>
        {snapshot && unlocked.length === 0 && <p className="accessory-caption accessory-empty">完成住持的嘱托并领取称号，就能收到对应饰品。</p>}
      </div>
      <footer className="accessories-footer">
        {(error || notice) && <p className={error ? "accessory-error" : "accessory-notice"} role={error ? "alert" : "status"}>{error || notice}</p>}
        <div className="accessory-actions">
          <button type="button" className="accessory-remove" disabled={busy || !wearingSelected} onClick={() => void equip(null, item.slot)}>卸下这件</button>
          <button type="button" className="accessory-equip" disabled={busy || !ownsSelected || wearingSelected || !snapshot} onClick={() => void equip(selected, item.slot)}>{busy ? "正在保存…" : wearingSelected ? "已佩戴" : replacing ? `更换${slotLabel}饰品` : ownsSelected ? "佩戴这件" : "待称号解锁"}</button>
        </div>
        <p className="accessory-caption accessory-current">{replacing ? `将替换${slotLabel}的${wornInSlot.name}` : "每个位置可佩戴一件饰品"}</p>
      </footer>
    </section>
  </div>, document.body);
}
