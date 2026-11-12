import { useEffect, useRef, useState } from "react";
import type { TempleAudio } from "./audio";
import { getTempleSchedule, isTemplePrayerHall } from "./templeSchedule";
import "./ambience.css";

type Props = {
  position: { x: number; z: number };
  sound: boolean;
  unlocked: boolean;
  audio: TempleAudio | null;
};

function remaining(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function TempleAmbience({ position, sound, unlocked, audio }: Props) {
  const [schedule, setSchedule] = useState(() => getTempleSchedule());
  const [visible, setVisible] = useState(() => !document.hidden);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [manualUnlocked, setManualUnlocked] = useState(false);
  const [retry, setRetry] = useState(0);
  const controls = useRef({ sound, unlocked, audio });
  controls.current = { sound, unlocked: unlocked || manualUnlocked, audio };
  const inHall = isTemplePrayerHall(position);
  const lesson = schedule.lesson;
  const lessonStart = lesson?.start;
  const ambienceKind = lesson ? "lesson" : inHall ? "hall" : null;
  const canPlay = sound && (unlocked || manualUnlocked) && visible;

  useEffect(() => {
    let lastTick = Date.now();
    let lastSlot = getTempleSchedule(lastTick).bellSlot?.id;
    let wasVisible = !document.hidden;
    const tick = () => {
      const now = Date.now();
      const next = getTempleSchedule(now);
      const isVisible = !document.hidden;
      const slot = next.bellSlot;
      const elapsed = now - lastTick;
      const crossedBoundary = slot && slot.id !== lastSlot && slot.at > lastTick;
      if (crossedBoundary && isVisible && wasVisible && elapsed >= 0 && elapsed <= 5000 && now - slot.at <= 5000) {
        const current = controls.current;
        if (current.sound && current.unlocked) current.audio?.ringTimeBell();
      }
      lastTick = now;
      lastSlot = slot?.id;
      wasVisible = isVisible;
      setSchedule(next);
      setVisible(isVisible);
    };
    const resume = () => {
      const now = Date.now();
      const next = getTempleSchedule(now);
      lastTick = now;
      lastSlot = next.bellSlot?.id;
      wasVisible = !document.hidden;
      setSchedule(next);
      setVisible(wasVisible);
      if (!wasVisible) {
        void controls.current.audio?.setAmbience(null);
        controls.current.audio?.stop("towerBell");
      }
    };
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      void controls.current.audio?.setAmbience(null);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!audio || !canPlay || !ambienceKind) {
      setStatus("idle");
      void audio?.setAmbience(null);
      return;
    }
    setStatus("loading");
    const request = lessonStart !== undefined ? { kind: "lesson" as const, start: lessonStart } : { kind: "hall" as const };
    void audio.setAmbience(request).then(playing => {
      if (alive) setStatus(playing ? "ready" : "unavailable");
    });
    return () => { alive = false; void audio.setAmbience(null); };
  }, [audio, canPlay, ambienceKind, lessonStart, retry]);

  const retryAudio = () => {
    if (!sound || !audio) return;
    audio.setEnabled(true);
    void audio.unlock().then(ready => {
      setManualUnlocked(ready);
      setRetry(value => value + 1);
    });
  };

  useEffect(() => {
    if (status !== "unavailable" || !audio || !sound) return;
    let alive = true;
    const retryOnGesture = () => {
      void audio.unlock().then(ready => {
        if (alive && ready) { setManualUnlocked(true); setRetry(value => value + 1); }
      });
    };
    window.addEventListener("pointerdown", retryOnGesture, { once: true });
    return () => { alive = false; window.removeEventListener("pointerdown", retryOnGesture); };
  }, [status, audio, sound]);

  if (!lesson) return null;
  return <aside className="temple-lesson-notice" role="status" aria-label={lesson.label}>
    <div><strong>{lesson.label}</strong><span aria-live="off">剩余 {remaining(lesson.remainingSeconds)}</span></div>
    {!sound ? <small>声音已关闭</small> : !(unlocked || manualUnlocked) ? <button type="button" onClick={retryAudio}>轻点开启念诵声音</button> : status === "unavailable" ? <button type="button" onClick={retryAudio}>念诵暂未连接 · 重试播放</button> : status === "loading" ? <small>正在迎来心经念诵…</small> : <small>全寺共修 · 北京时间</small>}
  </aside>;
}
