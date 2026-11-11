import { useEffect, useRef, useState } from "react";
import { BookOpen, Wind } from "lucide-react";
import type { TempleSound } from "./audio";

const sutraPassages = [
 "观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空，度一切苦厄。",
 "舍利子，色不异空，空不异色，色即是空，空即是色。受想行识，亦复如是。",
 "是故空中无色，无受想行识。无眼耳鼻舌身意，无色声香味触法。",
 "菩提萨埵，依般若波罗蜜多故，心无罣碍。无罣碍故，无有恐怖，远离颠倒梦想，究竟涅槃。",
];

type Props = {
 kind: "sutra" | "breathe";
 onSound: (kind: TempleSound) => void;
};

export default function FloorActivity({ kind, onSound }: Props) {
 const [passage, setPassage] = useState(0);
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

 if (kind === "sutra") return <>
  <p className="eyebrow">二层 · 藏经阁</p>
  <h2 id="modal-title">诵读心经选段</h2>
  <BookOpen className="floor-activity-icon" size={34} aria-hidden="true" />
  <p className="sutra-passage" aria-live="polite">{sutraPassages[passage]}</p>
  <p className="modal-small">选段 {passage + 1} / {sutraPassages.length}</p>
  <button className="primary-button" onClick={() => {
   setPassage(value => (value + 1) % sutraPassages.length);
   onSound("beads");
  }}>{passage === sutraPassages.length - 1 ? "再读一遍" : "下一段"}</button>
 </>;

 const breath = elapsed % 10 < 4 ? "吸气" : "呼气";
 return <>
  <p className="eyebrow">三层 · 观云阁</p>
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
