import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Volume2, VolumeX, X } from "lucide-react";

type Props = {
  open: boolean;
  gameVolume: number;
  templeVolume: number;
  onGameVolume: (volume: number) => void;
  onTempleVolume: (volume: number) => void;
  onClose: () => void;
};

export default function TempleSoundSettings(props: Props) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(props.onClose);
  close.current = props.onClose;
  useEffect(() => {
    if (!props.open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>("button,input") ?? []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); if (previous?.isConnected) previous.focus(); };
  }, [props.open]);
  if (!props.open) return null;
  return createPortal(<div className="modal-backdrop" onClick={props.onClose}>
    <section ref={panel} className="modal game-modal sound-settings" role="dialog" aria-modal="true" aria-labelledby="sound-settings-title" onClick={event => event.stopPropagation()}>
      <button className="modal-close icon-button" type="button" aria-label="关闭声音设置" onClick={props.onClose}><X size={22} /></button>
      <h2 id="sound-settings-title">声音设置</h2>
      {[
        { id: "game-volume", label: "游戏音量", detail: "水声、喂鱼、放生、习武", value: props.gameVolume, change: props.onGameVolume },
        { id: "temple-volume", label: "寺庙音量", detail: "钟鼓、木鱼、殿内《心经》配乐、念经及礼敬", value: props.templeVolume, change: props.onTempleVolume },
      ].map(item => <div className="sound-volume-row" key={item.id}>
        <div><label htmlFor={item.id}>{item.label}</label><output htmlFor={item.id}>{Math.round(item.value * 100)}%</output></div>
        <p>{item.detail}</p>
        <div className="sound-slider-controls">
          <button type="button" aria-label={`${item.value > 0 ? "关闭" : "开启"}${item.label}`} aria-pressed={item.value === 0} onClick={() => item.change(item.value > 0 ? 0 : 1)}>{item.value > 0 ? <Volume2 size={21} /> : <VolumeX size={21} />}</button>
          <input id={item.id} type="range" min="0" max="100" step="1" value={Math.round(item.value * 100)} onChange={event => item.change(Number(event.target.value) / 100)} aria-valuetext={`${Math.round(item.value * 100)}%`} />
        </div>
      </div>)}
    </section>
  </div>, document.body);
}
