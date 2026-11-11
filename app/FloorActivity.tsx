import { useEffect, useRef, useState } from "react";
import { Wind } from "lucide-react";
import type { TempleSound } from "./audio";
import TempleReading from "./TempleReading";

type Props = {
 kind: "sutra" | "breathe";
 onSound: (kind: TempleSound) => void;
};

export default function FloorActivity({ kind, onSound }: Props) {
 const [running, setRunning] = useState(false);
 const [elapsed, setElapsed] = useState(0);
 const elapsedRef = useRef(0);
 const completed = elapsed >= 30;

 useEffect(() => {
  if (!running) return;
  const startedAt = Date.now() - elapsedRef.current * 1000;
  const timer = setInterval(() => {
   const seconds = Math.min(30, Math.floor((Date.now() - startedAt) / 1000));
   elapsedRef.current = seconds;
   setElapsed(seconds);
   if (seconds === 30) {
    setRunning(false);
    onSound("bell");
   }
  }, 250);
  return () => clearInterval(timer);
 }, [running, onSound]);

 if (kind === "sutra") return <TempleReading kind="sutra" onSound={onSound} />;

 const breath = elapsed % 10 < 4 ? "吸气" : "呼气";
 return <>
  <p className="eyebrow">观云阁 · 静心调息</p>
  <h2 id="modal-title">观云调息</h2>
  <div className={`breathing-cloud ${running ? "is-running" : ""}`} aria-hidden="true"><Wind size={38} /></div>
  <p className="breathing-prompt" aria-live="polite">{completed ? "愿你心中清宁" : running ? breath : "随呼吸，慢慢安静"}</p>
  <p className="modal-small" role="timer">{completed ? "已完成三轮调息" : `还剩 ${30 - elapsed} 秒`}</p>
  <button className="primary-button" onClick={() => {
   if (completed) {
    elapsedRef.current = 0;
    setElapsed(0);
   }
   if (!running) onSound("meditate");
   setRunning(value => !value);
  }}>{running ? "暂停调息" : completed ? "再静心一次" : elapsed > 0 ? "继续调息" : "开始 30 秒调息"}</button>
 </>;
}
