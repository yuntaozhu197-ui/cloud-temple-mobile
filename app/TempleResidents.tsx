import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";
import { getNpcResident, type NpcResidentId } from "./npcResidents";
import { getTempleSchedule } from "./templeSchedule";
import "./residents.css";

type Props = {
  residentId: NpcResidentId | null;
  onConversationChange: (id: NpcResidentId | null) => void;
};

export default function TempleResidents({ residentId, onConversationChange }: Props) {
  const [greeting, setGreeting] = useState<{ id: NpcResidentId; text: string } | null>(null);
  const [talkingId, setTalkingId] = useState<NpcResidentId | null>(null);
  const [topic, setTopic] = useState<number | null>(null);
  const [lesson, setLesson] = useState(() => Boolean(getTempleSchedule().lesson));
  const visits = useRef(new Map<NpcResidentId, number>());
  const panel = useRef<HTMLElement>(null);
  const talkButton = useRef<HTMLButtonElement>(null);
  const callback = useRef(onConversationChange);
  callback.current = onConversationChange;
  const resident = getNpcResident(talkingId);
  const nearby = getNpcResident(greeting?.id);

  useEffect(() => {
    const check = () => setLesson(Boolean(getTempleSchedule().lesson));
    const timer = window.setInterval(check, 1000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, []);

  useEffect(() => {
    const next = getNpcResident(residentId);
    if (!next || lesson) { setGreeting(null); return; }
    const visit = visits.current.get(next.id) ?? 0;
    visits.current.set(next.id, visit + 1);
    setGreeting({ id: next.id, text: next.greetings[visit % next.greetings.length] });
  }, [residentId, lesson]);

  useEffect(() => {
    if (lesson || (talkingId && residentId !== talkingId)) closeConversation();
  }, [lesson, residentId, talkingId]);

  useEffect(() => { callback.current(talkingId); }, [talkingId]);
  useEffect(() => () => callback.current(null), []);

  useEffect(() => {
    if (!talkingId) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeConversation(); return; }
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
      else talkButton.current?.focus();
    };
  }, [talkingId]);

  function beginConversation() {
    if (!greeting || lesson) return;
    callback.current(greeting.id);
    setTopic(null);
    setTalkingId(greeting.id);
  }

  function closeConversation() {
    callback.current(null);
    setTalkingId(null);
  }

  return <>
    {nearby && greeting && !talkingId && !lesson && <aside className="resident-greeting" aria-label={`${nearby.name}向你问好`}>
      <div className="resident-greeting-heading">
        <strong>{nearby.name}<span>{nearby.role}</span></strong>
        <button ref={talkButton} type="button" className="resident-talk" onClick={beginConversation}><MessageCircle size={16} aria-hidden="true" />聊一聊</button>
        <button type="button" className="resident-dismiss" aria-label="收起问候" onClick={() => setGreeting(null)}><X size={17} aria-hidden="true" /></button>
      </div>
      <p role="status">{greeting.text}</p>
    </aside>}
    {resident && !lesson && createPortal(<div className="resident-overlay" onClick={closeConversation}>
      <section ref={panel} className="resident-panel" role="dialog" aria-modal="true" aria-labelledby="resident-dialog-title" onClick={event => event.stopPropagation()}>
        <header className="resident-dialog-heading">
          <div><h2 id="resident-dialog-title">{resident.name}</h2><p>{resident.role} · 寺院常住</p></div>
          <button type="button" className="resident-close" aria-label="结束交谈" onClick={closeConversation}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="resident-dialog-speech" role="status">
          {topic === null ? (greeting?.id === resident.id ? greeting.text : resident.greetings[0]) : resident.topics[topic].answer}
        </div>
        <div className="resident-topics" aria-label="想和他聊些什么">
          {resident.topics.map((item, index) => <button type="button" key={item.question} className={topic === index ? "is-selected" : ""} aria-pressed={topic === index} onClick={() => setTopic(index)}>{item.question}</button>)}
        </div>
        <button type="button" className="resident-farewell" onClick={closeConversation}>先去别处走走</button>
      </section>
    </div>, document.body)}
  </>;
}
