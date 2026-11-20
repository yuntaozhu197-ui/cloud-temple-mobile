import { useCallback, useMemo, useRef, useState } from "react";
import { createTempleCatReporter, sharedTempleCatDay, templeCatDay, templeCatRoute, TEMPLE_CAT_PLACES, type CatHideout } from "./templeCat";

export type CatHuntPhase = "intro" | "search" | "reveal" | "found";
type CatGuideStatus = "idle" | "walking" | "near";
const hintFields = ["clue", "direction", "detail"] as const;
type Goal = "tracks" | "cat";
type Round = {
  day: string;
  phase: CatHuntPhase;
  id: number;
  goal: Goal;
  startedAt: number;
  hintLevel: number;
  guideRequest: number;
  guideStatus: CatGuideStatus;
  feedback: string;
  checked: readonly CatHideout[];
  nearby: CatHideout | null;
  seconds: number | null;
  inspection: number;
};

function newRound(day: string): Round {
  return { day, phase: "intro", id: 0, goal: "tracks", startedAt: 0, hintLevel: 1, guideRequest: 0, guideStatus: "idle", feedback: "", checked: [], nearby: null, seconds: null, inspection: 0 };
}

export function useTempleCatHunt(playerId: string) {
  const [round, setRound] = useState<Round | null>(() => {
    const day = sharedTempleCatDay(window.location.search);
    return day ? newRound(day) : null;
  });
  const current = useRef(round);
  const sequence = useRef(0);
  const report = useMemo(() => createTempleCatReporter(playerId), [playerId]);
  const update = useCallback((next: Round | null) => {
    current.current = next;
    setRound(next);
  }, []);

  const open = () => { if (!current.current) update(newRound(templeCatDay())); };
  const close = () => update(null);

  function start() {
    const active = current.current;
    if (!active || (active.phase !== "intro" && active.phase !== "found")) return;
    update({ ...newRound(active.day), phase: "search", id: ++sequence.current, startedAt: performance.now() });
    report(active.day, "start");
  }

  function showHint() {
    const active = current.current;
    if (active?.phase === "search" && active.hintLevel < hintFields.length) {
      update({ ...active, hintLevel: active.hintLevel + 1 });
    }
  }

  function requestGuide() {
    const active = current.current;
    if (active?.phase === "search" && active.hintLevel === hintFields.length && active.guideStatus === "idle") {
      update({ ...active, guideRequest: active.guideRequest + 1, guideStatus: "walking" });
    }
  }

  const setGuideStatus = useCallback((id: number, request: number, guideStatus: CatGuideStatus) => {
    const active = current.current;
    if (active?.phase === "search" && active.id === id && active.guideRequest === request && active.guideStatus !== guideStatus) {
      update({ ...active, guideStatus });
    }
  }, [update]);

  function requestInspect() {
    const active = current.current;
    if (active?.phase === "search" && active.nearby) update({ ...active, inspection: active.inspection + 1 });
  }

  const setNearby = useCallback((id: number, nearby: CatHideout | null) => {
    const active = current.current;
    if (active?.phase === "search" && active.id === id && nearby !== active.nearby) update({ ...active, nearby });
  }, [update]);

  const inspect = useCallback((id: number, place: CatHideout) => {
    const active = current.current;
    if (active?.phase !== "search" || active.id !== id || active.checked.includes(place)) return;
    const route = templeCatRoute(active.day);
    if (place !== route[active.goal]) {
      update({ ...active, nearby: null, checked: [...active.checked, place], feedback: `在${TEMPLE_CAT_PLACES[place].label}没发现${active.goal === "tracks" ? "爪印" : "寺猫"}。换个地方找找。` });
      return;
    }
    if (active.goal === "tracks") {
      update({ ...active, goal: "cat", checked: [place], nearby: null, hintLevel: 1, guideRequest: 0, guideStatus: "idle", feedback: "找到猫爪印了。循着新线索去找寺猫。" });
      return;
    }
    const seconds = Math.max(1, Math.min(86_400, Math.round((performance.now() - active.startedAt) / 1000)));
    update({ ...active, phase: "reveal", nearby: null, seconds });
    report(active.day, "complete");
  }, [report, update]);

  function showResult() {
    const active = current.current;
    if (active?.phase === "reveal") update({ ...active, phase: "found" });
  }

  const target = round && templeCatRoute(round.day)[round.goal];
  const hint = round && target ? TEMPLE_CAT_PLACES[target][hintFields[round.hintLevel - 1]] : "";
  const guide = round?.phase === "search" && target && round.hintLevel === hintFields.length
    ? { target, request: round.guideRequest }
    : undefined;
  return { round, target, hint, guide, open, close, start, showHint, requestGuide, setGuideStatus, requestInspect, setNearby, inspect, showResult, report };
}
