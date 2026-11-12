"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Volume2, VolumeX, CircleHelp, X, Leaf, Pause, Play, Wind, Share2, Sparkles, Camera, MoreHorizontal } from "lucide-react";
import TempleWorld from "./TempleWorld";
import SocialTemple from "./SocialTemple";
import TempleLife from "./TempleLife";
import AccountGate, { type AccountUser } from "./AccountGate";
import FloorActivity from "./FloorActivity";
import TempleReading from "./TempleReading";
import TempleLamps from "./TempleLamps";
import { type ShrineId } from "./shrines";
import { createTempleAudio, type TempleSound } from "./audio";
import { TEMPLE_SEATS } from "./templeSeats";
import { lampRequest } from "./lampArchive";
import TempleAmbience from "./TempleAmbience";
import TempleLanterns from "./TempleLanterns";
type Visitor = { id: string; name: string; seat: number | null; action: string; meditating: boolean; joinedAt: number; x: number; z: number; heading: number; floor?: 1 | 2 | 3 };
type Room = { selfId: string; now: number; participants: Visitor[]; total: number; meditatingCount: number };
type Stats = { date: string; bows: number; wood: number; beads: number; prayer: number; seconds: number };
const seats = TEMPLE_SEATS;
const day = () => new Date().toLocaleDateString("en-CA");
const freshStats = (): Stats => ({date:day(),bows:0,wood:0,beads:0,prayer:0,seconds:0});
const clock = (n:number) => `${Math.floor(n/60).toString().padStart(2,"0")}:${Math.floor(n%60).toString().padStart(2,"0")}`;
function Lotus({className=""}:{className?:string}) { return <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 34C11 31 11 19 14 13c7 2 10 8 10 15 0-7 3-13 10-15 3 6 3 18-10 21Z" stroke="currentColor" strokeWidth="1.8"/><path d="M24 34C11 36 5 28 5 22c8-1 15 4 19 12Zm0 0c13 2 19-6 19-12-8-1-15 4-19 12Z" stroke="currentColor" strokeWidth="1.8"/><path d="M24 27c-7-7-5-15 0-21 5 6 7 14 0 21Z" stroke="currentColor" strokeWidth="1.8"/><path d="M16 40h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> }
function ActionIcon({kind}:{kind:string}) {return <svg viewBox="0 0 64 58" fill="none" aria-hidden="true" className="action-icon">
  {kind==="prayer"&&<><path d="m31 42-2-31c-.3-4-4-4-5 0l-4 17-7 12 11 9m9-7 2-31c.3-4 4-4 5 0l4 17 7 12-11 9" fill="#f5cfac" stroke="#9b7054" strokeWidth="1.8" strokeLinejoin="round"/><path d="m12 41 12 8-5 6-13-8m45-6-12 8 5 6 13-8" fill="#dba478" stroke="#9b7054" strokeWidth="1.6"/><path d="M32 4V1M12 17l-4-3m44 3 4-3" stroke="#baae86" strokeWidth="2" strokeLinecap="round"/></>}
  {kind==="bow"&&<><ellipse cx="32" cy="49" rx="25" ry="5" fill="#e1d6b7"/><path d="M13 44c-2-17 5-25 17-21l16 15-9 10H18Z" fill="#cf9062" stroke="#916649" strokeWidth="1.8"/><circle cx="44" cy="35" r="12" fill="#f1c9a5" stroke="#916649" strokeWidth="1.7"/><path d="m46 45 9 2M24 34l11 12 10 1" stroke="#916649" strokeWidth="1.8" strokeLinecap="round"/></>}
  {kind==="beads"&&<><ellipse cx="31" cy="27" rx="18" ry="20" stroke="#b58b5e" strokeWidth="5"/>{Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return <circle key={i} cx={Number((31+18*Math.sin(a)).toFixed(3))} cy={Number((27+20*Math.cos(a)).toFixed(3))} r="4.2" fill="#b98755" stroke="#865e3f" strokeWidth="1"/>})}<path d="m31 47 1 6m-4 0h8m-4-3-3 7m3-7 3 7" stroke="#ad7252" strokeWidth="2" strokeLinecap="round"/></>}
  {kind==="wood"&&<><path d="M10 36c0-12 9-20 22-18 14 1 22 10 21 20-1 12-41 15-43-2Z" fill="#ba8554" stroke="#835f43" strokeWidth="1.8"/><path d="M28 19c8 4 10 12 3 18m-2 0 16-4" stroke="#76563f" strokeWidth="2.7" strokeLinecap="round"/><path d="m40 16 12-11" stroke="#947455" strokeWidth="4" strokeLinecap="round"/><ellipse cx="53" cy="7" rx="5" ry="6" transform="rotate(42 53 7)" fill="#d1aa77" stroke="#947455" strokeWidth="1.5"/><path d="M15 42c11 5 24 4 31 0" stroke="#d5ae79" strokeWidth="1.5" strokeLinecap="round"/></>}
</svg>}
export default function Home() {
 const [account, setAccount] = useState<AccountUser | null>(null);
 const signedOut = useCallback(() => setAccount(null), []);
 return account ? <TempleGame account={account} onSignedOut={signedOut} /> : <AccountGate onAuthenticated={setAccount} />;
}
function TempleGame({ account, onSignedOut }: { account: AccountUser; onSignedOut: () => void }) {
 const [incensePulse, setIncensePulse] = useState(0);
 const [incenseShrine, setIncenseShrine] = useState<ShrineId>("rulai");
 const [lampOpen, setLampOpen] = useState(false);
 const [lampPulse, setLampPulse] = useState(0);
 const [lampLit, setLampLit] = useState(false);
 const [skyLanternOpen, setSkyLanternOpen] = useState(false);
 const [skyLanternPulse, setSkyLanternPulse] = useState(0);
 const [audioUnlocked, setAudioUnlocked] = useState(false);
 const [ambientPosition, setAmbientPosition] = useState({ x: 0, z: 9 });
 const ambientPositionRef = useRef(ambientPosition);
 const [room,setRoom]=useState<Room|null>(null),[connection,setConnection]=useState("connecting"),[seat,setSeat]=useState<number|null>(null),[action,setAction]=useState("idle"),[pulse,setPulse]=useState(0);
 const [stats,setStats]=useState<Stats>(freshStats),[loaded,setLoaded]=useState(false),[sound,setSound]=useState(true),[toast,setToast]=useState(""),[modal,setModal]=useState<"help"|"practice"|"meditate"|"mural"|"sutra"|"breathe"|null>(null);
 const [auto,setAuto]=useState(false),[bowCount,setBowCount]=useState(0),[meditating,setMeditating]=useState(false),[duration,setDuration]=useState(5),[remaining,setRemaining]=useState(0);
 const audioRef=useRef<ReturnType<typeof createTempleAudio>|null>(null),toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null),actionTimer=useRef<ReturnType<typeof setTimeout>|null>(null),positionRef=useRef<{x:number;z:number;heading:number;floor:1|2|3}>({x:0,z:9,heading:0,floor:1}),positionSent=useRef(0);
 const [place,setPlace]=useState("静心庭院");
 const [cameraMode, setCameraMode] = useState<"first" | "third" | "map">("map");
 const [menuOpen, setMenuOpen] = useState(false);
 const [isSeated, setIsSeated] = useState(false);
 const seatedRef = useRef(false);
 const [practiceOpen, setPracticeOpen] = useState(false);
 const [incenseRequest, setIncenseRequest] = useState(0);
 const [flowerRequest, setFlowerRequest] = useState(0);
 const [ritualRequest, setRitualRequest] = useState(0);
 const [flowerPulse, setFlowerPulse] = useState(0);
 const [ritualPulse, setRitualPulse] = useState(0);
 const [exitRequest, setExitRequest] = useState(0);
 const [bowSpeed, setBowSpeed] = useState<1 | 4>(1);
 const bowSpeedRef = useRef(bowSpeed);
 bowSpeedRef.current = bowSpeed;
 const [departed, setDeparted] = useState(false);
 const departedRef = useRef(false);
 const gameAlive = useRef(true);
 const requestSeq=useRef(0),requestQueue=useRef<Promise<unknown>>(Promise.resolve()),requestBusy=useRef(false),roomRef=useRef<Room|null>(null),preferredSeat=useRef(5),bowCountRef=useRef(0),meditationEnd=useRef(0),lastTick=useRef(0),autoRef=useRef(false),meditatingRef=useRef(false),seatRef=useRef<number|null>(null);
 const notify=useCallback((text:string)=>{setToast(text);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(""),3200)},[]);
 const add=useCallback((key:keyof Omit<Stats,"date">,amount=1)=>setStats(s=>{const base=s.date===day()?s:freshStats();return {...base,[key]:base[key]+amount}}),[]);
 const getAudio = useCallback(() => {
  if (!audioRef.current) audioRef.current = createTempleAudio();
  return audioRef.current;
 }, []);
 const unlockAudio = useCallback(() => {
  if (!sound) return;
  const audio = getAudio();
  audio.setEnabled(true);
  void audio.unlock().then(ok => { if (gameAlive.current) setAudioUnlocked(ok); });
 }, [getAudio, sound]);
 const tone = useCallback((kind: TempleSound = "wood") => {
  const audio = getAudio();
  audio.setEnabled(sound);
  if (sound) audio.play(kind);
 }, [getAudio, sound]);
 const toggleSound = () => {
  const enabled = !sound;
  const audio = getAudio();
  audio.setEnabled(enabled);
  if (enabled) void audio.unlock().then(ok => { if (gameAlive.current) setAudioUnlocked(ok); });
  setSound(enabled);
  notify(enabled ? "声音已开启，每个动作都有自己的轻响" : "声音已关闭");
 };
 useEffect(() => { audioRef.current?.setEnabled(sound); }, [sound]);
 useEffect(() => {
  let stopped = false;
  let pending = false;
  let active: AbortController | null = null;
  const refreshLamp = async () => {
   if (stopped || pending || document.hidden) return;
   pending = true;
   active = new AbortController();
   const timeout = setTimeout(() => active?.abort(), 12_000);
   try {
    const snapshot = await lampRequest(account.id, active.signal);
    if (!stopped) setLampLit(snapshot.litToday);
   } catch { /* A later focus or timer retries the saved lamp state. */ }
   finally { clearTimeout(timeout); pending = false; }
  };
  void refreshLamp();
  const timer = setInterval(() => void refreshLamp(), 60_000);
  const resume = () => { if (!document.hidden) void refreshLamp(); };
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", resume);
  return () => { stopped = true; active?.abort(); clearInterval(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
 }, [account.id]);
 useEffect(() => {
  const viewport = window.visualViewport;
  const resize = () => document.documentElement.style.setProperty("--temple-viewport-height", `${Math.round(viewport?.height ?? window.innerHeight)}px`);
  resize();
  viewport?.addEventListener("resize", resize);
  window.addEventListener("resize", resize);
  return () => { viewport?.removeEventListener("resize", resize); window.removeEventListener("resize", resize); };
 }, []);
 const sync=useCallback((body?:Record<string,unknown>):Promise<Room|null>=>{
  const seq=++requestSeq.current;
  const run=async():Promise<Room|null>=>{
   if (!gameAlive.current || (departedRef.current && body?.leave !== true)) return null;
   // Preserve seat and meditation transitions while coalescing queued movement.
   const userTransition=Object.hasOwn(body??{},"seat")||Object.hasOwn(body??{},"meditating")||Object.hasOwn(body??{},"leave");
   if(seq!==requestSeq.current&&!userTransition)return null;
   let payload:Record<string,unknown>|undefined=body?{...positionRef.current,...body}:body;
   requestBusy.current=true;
   try{
    for(let attempt=0;attempt<=seats.length;attempt++){
     const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
     let res:Response;
     try{
      res=await fetch("/api/room",{method:payload?"POST":"GET",headers:{"X-Temple-User":account.id,...(payload?{"Content-Type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined,cache:"no-store",signal:controller.signal});
     }finally{clearTimeout(timeout)}
     if (!gameAlive.current) return null;
     if (res.status === 401) { onSignedOut(); return null; }
     if(!res.ok&&res.status!==409)throw new Error("room");
     const data=await res.json() as Room & { error?: string };
     if (data.error === "account_changed" || data.selfId !== account.id) { onSignedOut(); return null; }
     // Completed requests are already ordered by the queue, including on slow networks.
     const self=data.participants.find(v=>v.id===data.selfId);
     if(self?.seat===null&&meditatingRef.current&&attempt<seats.length){
      const available=[preferredSeat.current,...seats.map((_,index)=>index)].find(n=>!data.participants.some(p=>p.seat===n));
      if(available!==undefined){
       // A mobile tab may outlive its presence lease. Reclaim an available cushion.
       payload={...positionRef.current,seat:available,...(meditatingRef.current?{meditating:true,action:"meditate"}:autoRef.current?{action:"bow"}:{})};
       continue;
      }
     }
     roomRef.current=data;setRoom(data);setConnection("online");
     seatRef.current=self?.seat??null;setSeat(seatRef.current);
     if(seatRef.current!==null)preferredSeat.current=seatRef.current;
     if(seatRef.current===null&&meditatingRef.current){
      meditatingRef.current=false;setMeditating(false);setRemaining(0);setAction("idle");
      notify("蒲团暂时坐满了，等一位同修起身后再静坐吧");
     }else if(res.status===409){notify("这个蒲团已有同修，请选另一个")}
     return res.status===409?null:data;
    }
   }catch{
    setConnection("offline");
   }finally{
    requestBusy.current=false;
   }
   return null;
  };
  const result=requestQueue.current.then(run,run);
  requestQueue.current=result;
  return result;
 },[notify,onSignedOut,account.id]);
 useEffect(()=>{gameAlive.current=true;try{const saved=JSON.parse(localStorage.getItem("cloud-temple-stats:"+account.id)||localStorage.getItem("cloud-temple-stats")||"null");if(saved?.date===day()&&["bows","wood","beads","prayer","seconds"].every(k=>Number.isFinite(saved[k])&&saved[k]>=0))setStats(saved);setSound(localStorage.getItem("cloud-temple-sound")!=="false")}catch{}setLoaded(true);void sync();const timer=setInterval(()=>{if(!document.hidden&&!requestBusy.current)void sync(meditatingRef.current?{meditating:true,action:"meditate"}:autoRef.current?{action:"bow",bowSpeed:bowSpeedRef.current}:undefined)},3000);return()=>{gameAlive.current=false;clearInterval(timer);if(toastTimer.current)clearTimeout(toastTimer.current);if(actionTimer.current)clearTimeout(actionTimer.current);audioRef.current?.dispose()}},[sync]);
 useEffect(()=>{if(loaded){try{localStorage.setItem("cloud-temple-stats:"+account.id,JSON.stringify(stats));localStorage.removeItem("cloud-temple-stats");localStorage.setItem("cloud-temple-sound",String(sound))}catch{}}},[loaded,stats,sound]);
 useEffect(()=>{autoRef.current=auto;meditatingRef.current=meditating;seatRef.current=seat},[auto,meditating,seat]);
 useEffect(()=>{const visible=()=>{if(document.hidden){if(autoRef.current){autoRef.current=false;setAuto(false);setAction("idle");void sync({action:"idle"});notify("礼拜已暂停，回来后可继续")}}else void sync(meditatingRef.current?{meditating:true,action:"meditate"}:undefined)};document.addEventListener("visibilitychange",visible);return()=>document.removeEventListener("visibilitychange",visible)},[sync,notify]);
 const doAction = useCallback((kind: string) => {
  if (kind !== "wood" && !seatedRef.current) {
   notify("走近蒲团坐稳后，再开始修行吧");
   return;
  }
  if (meditatingRef.current || autoRef.current) return;
  setAction(kind);
  setPulse(value => value + 1);
  const key = ({ prayer: "prayer", bow: "bows", beads: "beads", wood: "wood" } as const)[kind as "prayer" | "bow" | "beads" | "wood"];
  if (key) add(key);
  tone(kind as TempleSound);
  void sync({ action: kind, bowSpeed: 1 });
  if (actionTimer.current) clearTimeout(actionTimer.current);
  actionTimer.current = setTimeout(() => {
   setAction("idle");
   void sync({ action: "idle" });
  }, kind === "prayer" || kind === "beads" ? 2800 : 1050);
 }, [add, tone, sync, notify]);
 const startAuto=()=>{if(!seatedRef.current){notify("坐上蒲团后，就可以开始108拜");return}unlockAudio();if(autoRef.current)return;if(meditatingRef.current){notify("先结束静坐，再开始礼拜吧");return}if(actionTimer.current)clearTimeout(actionTimer.current);if(bowCountRef.current>=108){bowCountRef.current=0;setBowCount(0)}autoRef.current=true;setAuto(true);setAction("idle");notify(bowCountRef.current>0?"继续礼拜，慢慢来":"已开始 108 次礼拜，可随时暂停")};
 useEffect(() => {
  if (!auto) return;
  let completedBow: ReturnType<typeof setTimeout> | undefined;
  const bow = () => {
   if (!autoRef.current || bowCountRef.current >= 108) return;
   setAction("bow");
   setPulse(value => value + 1);
   tone("bow");
   completedBow = setTimeout(() => {
    if (!autoRef.current) return;
    bowCountRef.current += 1;
    setBowCount(bowCountRef.current);
    add("bows");
   }, 1050 / bowSpeed);
  };
  bow();
  const timer = setInterval(bow, 1250 / bowSpeed);
  void sync({ action: "bow", bowSpeed });
  return () => { clearInterval(timer); clearTimeout(completedBow); };
 }, [auto, add, sync, tone, bowSpeed]);
 useEffect(()=>{if(auto&&bowCount>=108){autoRef.current=false;setAuto(false);setAction("prayer");tone("bell");notify("108 次礼拜圆满。愿你心生欢喜。");void sync({action:"prayer"})}},[bowCount,auto,tone,notify,sync]);
 const stopAuto=()=>{autoRef.current=false;setAuto(false);setAction("idle");void sync({action:"idle"})};
 const finishMeditation=useCallback((completed=false)=>{setMeditating(false);meditatingRef.current=false;setRemaining(0);setAction("idle");void sync({meditating:false,action:"idle"});tone("bell");notify(completed?"静坐圆满，带着这份平静继续生活吧":"已结束静坐，愿此刻的安静陪着你")},[sync,tone,notify]);
 useEffect(()=>{if(!meditating)return;const timer=setInterval(()=>{const now=Date.now(),left=Math.max(0,Math.ceil((meditationEnd.current-now)/1000)),elapsed=Math.max(0,Math.floor((Math.min(now,meditationEnd.current)-lastTick.current)/1000));if(elapsed>0){add("seconds",elapsed);lastTick.current+=elapsed*1000}setRemaining(left);if(left===0)finishMeditation(true)},1000);return()=>clearInterval(timer)},[meditating,add,finishMeditation]);
 const beginMeditation=async()=>{unlockAudio();if(meditatingRef.current)return;if(seatRef.current===null||!seatedRef.current){notify("先走到蒲团上坐稳吧");setModal(null);return}if(autoRef.current)stopAuto();if(actionTimer.current)clearTimeout(actionTimer.current);setModal(null);meditationEnd.current=Date.now()+duration*60000;lastTick.current=Date.now();setRemaining(duration*60);setMeditating(true);meditatingRef.current=true;setAction("meditate");tone("meditate");const data=await sync({meditating:true,action:"meditate"});if(meditatingRef.current)notify(data?"已加入静坐。吸气，呼气，回到此刻。":"正在独自静坐；网络恢复后将重新连接")};
 const chooseSeat=async(n:number)=>{if(autoRef.current){notify("暂停礼拜后，就可以换蒲团了");return}if(connection==="online"&&room?.participants.some(p=>p.seat===n&&p.id!==room.selfId)){notify("这个蒲团已有同修，请选另一个");return}preferredSeat.current=n;const body={seat:n,...(meditatingRef.current?{meditating:true,action:"meditate"}:{})};if(connection!=="online"){seatRef.current=n;setSeat(n);notify("已在这里坐下，正在等待网络恢复");void sync(body);return}const data=await sync(body);if(data)notify("坐稳啦，把心慢慢放下来")};
 const leaveSeat=()=>{if(autoRef.current||meditatingRef.current)return;seatedRef.current=false;setIsSeated(false);seatRef.current=null;setSeat(null);setAction("idle");void sync({seat:null,action:"idle"})};
 const movePosition = useCallback((position: {x:number;z:number;heading:number;floor:1|2|3}) => {
  const floorChanged = position.floor !== positionRef.current.floor;
  positionRef.current = position;
  if (Math.hypot(position.x - ambientPositionRef.current.x, position.z - ambientPositionRef.current.z) >= 0.5 || floorChanged) {
   ambientPositionRef.current = { x: position.x, z: position.z };
   setAmbientPosition(ambientPositionRef.current);
  }
  if (Date.now() - positionSent.current > 1200 || floorChanged) {
   positionSent.current = Date.now();
   void sync({ ...position });
  }
 }, [sync]);
 const activeParticipants=connection==="online"?(room?.participants??[]):[];
 const others=activeParticipants.filter(v=>v.id!==room?.selfId),selfName=room?.participants.find(v=>v.id===room.selfId)?.name??"小知";
 const share=async()=>{try{const data={title:"云间寺 · 给心放个假",text:"来云间寺，和我一起静坐一会儿。",url:window.location.href};if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);notify("寺庙链接已复制，邀朋友来坐坐吧")}}catch(e){if((e as Error).name!=="AbortError")notify("可复制浏览器地址，邀朋友一起静坐")}};
 const leaveTemple = () => {
  autoRef.current = false;
  meditatingRef.current = false;
  departedRef.current = true;
  setAuto(false);
  setMeditating(false);
  if (actionTimer.current) clearTimeout(actionTimer.current);
  audioRef.current?.setEnabled(false);
  setDeparted(true);
  void sync({ leave: true });
 };
 const contextAction = (kind: "incense" | "incenseGuanyin" | "incenseWenshu" | "incenseCaishen" | "longLamp" | "skyLantern" | "drum" | "towerBell" | "flower" | "ritual" | "bell" | "fish" | "pondFeed" | "mural" | "lamp" | "sutra" | "breathe" | "release" | "martial" | "pagoda") => {
  const incenseTargets: Partial<Record<typeof kind, ShrineId>> = { incense: "rulai", incenseGuanyin: "guanyin", incenseWenshu: "wenshu", incenseCaishen: "caishen" };
  const shrine = incenseTargets[kind];
  if (shrine) {
   setIncenseShrine(shrine);
   setIncenseRequest(value => value + 1);
  }
  if (kind === "longLamp") setLampOpen(true);
  if (kind === "skyLantern") setSkyLanternOpen(true);
  if (kind === "flower") setFlowerRequest(value => value + 1);
  if (kind === "ritual") setRitualRequest(value => value + 1);
  if (kind === "bell") { tone("bell"); notify("钟声已响，让这一念慢慢安定。"); }
  if (kind === "drum") { tone("drum"); notify("鼓声沉稳，余音慢慢散入山间。"); }
  if (kind === "towerBell") { tone("towerBell"); notify("铜钟轻撞，愿这一声悠远陪你静心。"); }
  if (kind === "fish" || kind === "pondFeed") notify("走到池畔，轻轻撒下鱼食。");
  if (kind === "lamp") { tone("incense"); notify("莲灯已点亮，愿这一盏温柔陪着你。"); }
  if (kind === "mural") setModal("mural");
  if (kind === "sutra" || kind === "breathe") setModal(kind);
  if (kind === "release") notify("走到放生池畔，把小鱼轻轻送入水中。");
  if (kind === "martial") notify("走到广场中央，准备练一套功夫。移动即可收招。");
  if (kind === "pagoda") { tone("pagoda"); notify("塔前合掌，留一念清宁。"); }
 };
 if (departed) return <div className="site-shell temple-game temple-departure"><Lotus /><h1>愿你带着平静，回到生活</h1><p>谢谢你来坐坐，我们下次再见。</p><button className="primary-button" onClick={() => window.location.reload()}>再回寺里走走</button></div>;
 return (
  <div className="site-shell temple-game" onKeyDownCapture={unlockAudio} onPointerDownCapture={unlockAudio}>
   <main className="temple-stage" aria-label="云间寺三维庭院">
    <div className="courtyard world-courtyard">
     <TempleWorld
      cameraMode={cameraMode}
      flowerPulse={flowerPulse}
      ritualPulse={ritualPulse}
      incensePulse={incensePulse}
      incenseShrine={incenseShrine}
      lampPulse={lampPulse}
      lampLit={lampLit}
      skyLanternPulse={skyLanternPulse}
      action={action}
      actionPulse={pulse}
      auto={auto}
      bowSpeed={auto ? bowSpeed : 1}
      meditating={meditating}
      seat={seat}
      selfId={room?.selfId}
      participants={activeParticipants}
      onSeatSelect={n => void chooseSeat(n)}
      onLeaveSeat={leaveSeat}
      onLongPress={startAuto}
      onPositionChange={movePosition}
      onPlaceChange={setPlace}
      onContextAction={contextAction}
      onIncenseStage={stage => {
       if (stage === "begin") tone("incense");
       if (stage === "insert") tone("prayer");
       if (stage === "complete") notify("清香已安放，愿你心安。");
      }}
      onLampStage={stage => {
       if (stage === "begin") { tone("lamp"); notify("灯火逐层点亮，愿你心中常有光。"); }
       if (stage === "complete") notify("点灯仪式圆满，灯塔的暖光会继续陪伴你。");
      }}
      onMartialStage={stage => {
       if (stage === "begin") { tone("martial"); notify("马步起势、连拳、飞踢！移动即可收招。"); }
       if (stage === "cancel") audioRef.current?.stop("martial");
       if (stage === "complete") notify("一套功夫练完，抱拳收势。");
      }}
      onFishStage={(kind, stage) => { if (stage === "offer") { tone(kind === "release" ? "release" : "water"); notify(kind === "release" ? "小鱼游入池中，慢慢加入鱼群。" : "鱼群正游来，吃饱后会缓缓散开。"); } }}
      onSkyLanternStage={stage => { if (stage === "release") { tone("incense"); notify("愿这一盏灯，载着你的心愿慢慢升起。"); } }}
      onSeatedChange={value => { seatedRef.current = value; setIsSeated(value); if (!value) setPracticeOpen(false); }}
     />
    </div>

    <header className="game-header">
     <div className="game-brand"><Lotus /><div><h1>云间寺</h1><span>{place}</span></div></div>
     <div className="game-header-tools">
      <button className="hud-button menu-control" onClick={() => setMenuOpen(value => !value)} aria-label="更多选项" aria-expanded={menuOpen} aria-controls="game-menu"><MoreHorizontal size={24} /></button>
     </div>
    </header>
    <div className={`game-presence online-pill ${connection}`} role="status"><i />{connection === "online" ? `${room?.total ?? 1} 人在寺` : connection === "offline" ? "离线漫游" : "正在入寺…"}</div>
    {menuOpen && <button className="menu-dismiss" aria-label="收起更多选项" onClick={() => setMenuOpen(false)} />}
    <nav id="game-menu" className={`game-menu ${menuOpen ? "is-open" : ""}`} hidden={!menuOpen} aria-label="更多选项">
     <strong className="player-menu-name" title={selfName}>{selfName}</strong>
     <button onClick={() => { setCameraMode(mode => mode === "map" ? "third" : mode === "third" ? "first" : "map"); setMenuOpen(false); }}><Camera size={18} />{cameraMode === "map" ? "切第三人称" : cameraMode === "third" ? "切第一人称" : "拖动地图"}</button>
     <button onClick={toggleSound}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}声音{sound ? "已开启" : "已关闭"}</button>
     <SocialTemple compact incenseRequest={incenseRequest} incenseShrine={incenseShrine} selfId={account.id} onInteraction={unlockAudio} onIncense={shrine => { setIncenseShrine(shrine); setIncensePulse(count => count + 1); }} onNotice={notify} />
     <button onClick={() => { setMenuOpen(false); setLampOpen(true); }}><Sparkles size={18} />我的长明灯</button>
     <TempleLife selfId={account.id} exitRequest={exitRequest} flowerRequest={flowerRequest} ritualRequest={ritualRequest} onNotice={notify} onProfileChange={() => void sync()} onOffering={kind => {
      unlockAudio();
      tone(kind === "flower" ? "incense" : kind === "ritual" ? "meditate" : "prayer");
      if (kind === "flower") setFlowerPulse(value => value + 1);
      if (kind === "ritual") setRitualPulse(value => value + 1);
     }} onLeave={leaveTemple} />
     <button onClick={() => { setMenuOpen(false); setModal("practice"); }}><Sparkles size={18} />我的修行</button>
     <button onClick={() => { setMenuOpen(false); void share(); }}><Share2 size={18} />邀请朋友</button>
     <button onClick={() => { setMenuOpen(false); setModal("help"); }}><CircleHelp size={18} />玩法帮助</button>
     <button onClick={() => { setMenuOpen(false); setExitRequest(value => value + 1); }}><Leaf size={18} />离寺 · 留个建议</button>
    </nav>

    <button className={`woodfish-shortcut ${action === "wood" ? "is-active" : ""}`} onClick={() => doAction("wood")} disabled={auto || meditating} aria-label="敲木鱼">
     <ActionIcon kind="wood" /><span>敲木鱼</span>
    </button>
    {isSeated && !auto && <button className="practice-toggle" onClick={() => meditating ? finishMeditation() : setPracticeOpen(value => !value)}>{meditating ? "结束静坐" : practiceOpen ? "收起动作" : "修行"}</button>}
    {isSeated && <section className="game-action-dock" hidden={meditating || (!practiceOpen && !auto)} aria-label="蒲团上的修行动作">
     <button className={`bow-speed-control ${bowSpeed === 4 ? "is-active" : ""}`} disabled={meditating} aria-pressed={bowSpeed === 4} aria-label={bowSpeed === 1 ? "一键切换4倍速自动礼拜" : "恢复正常速度自动礼拜"} onClick={() => { setBowSpeed(value => value === 1 ? 4 : 1); notify(bowSpeed === 1 ? "自动礼拜已切换为4倍速，仍会完成108拜" : "已恢复正常礼拜速度"); }}>{bowSpeed === 1 ? "加速 ×4" : "恢复 ×1"}</button>
     <button className={`auto-bow-control ${auto ? "is-active" : ""}`} onClick={() => auto ? stopAuto() : startAuto()} disabled={meditating} aria-label={auto ? "暂停自动礼拜" : bowCount > 0 && bowCount < 108 ? "继续108次自动礼拜" : "开始108次自动礼拜"}>
      {auto ? <Pause size={18} /> : <Play size={18} />}
      <span>{auto ? "暂停礼拜" : bowCount > 0 && bowCount < 108 ? "继续礼拜" : "108拜"}</span>
      <strong>{bowCount}<small>/108</small></strong>
      <span className="auto-bow-progress" style={{ width: `${bowCount / 108 * 100}%` }} />
     </button>
     <div className="game-action-grid" hidden={auto}>
      {[
       { key: "prayer", name: "合掌" },
       { key: "bow", name: "跪拜" },
       { key: "beads", name: "转佛珠" },
      ].map(item => <button key={item.key} className={`game-action ${action === item.key ? "is-active" : ""}`} disabled={auto || meditating} onClick={() => doAction(item.key)} aria-label={item.name} aria-pressed={action === item.key}>
       <ActionIcon kind={item.key} /><span>{item.name}</span>
      </button>)}
      <button className="game-action" disabled={auto || meditating} onClick={leaveSeat}><Lotus /><span>起身</span></button>
      <button className={`game-action ${meditating ? "is-active" : ""}`} disabled={auto} onClick={() => meditating ? finishMeditation() : setModal("meditate")}><Wind size={28} /><span>{meditating ? "结束静坐" : "静坐"}</span></button>
     </div>
    </section>}
    {meditating && <div className="game-meditation-status" role="timer"><Wind size={18} /><strong>{clock(remaining)}</strong><span>{room?.meditatingCount ?? 1}人共修</span></div>}
   </main>

   <TempleAmbience position={ambientPosition} sound={sound} unlocked={audioUnlocked} audio={audioRef.current} />
   <TempleLanterns selfId={account.id} open={skyLanternOpen} onClose={() => setSkyLanternOpen(false)} onRelease={() => {
    if (autoRef.current) stopAuto();
    if (meditatingRef.current) finishMeditation();
    setSkyLanternPulse(value => value + 1);
    notify("心愿已安放，正前往许愿台放飞孔明灯。");
   }} />
   <TempleLamps selfId={account.id} open={lampOpen} onClose={() => setLampOpen(false)} onStatus={setLampLit}
    onLight={() => { tone("incense"); setLampPulse(value => value + 1); }}
    onViewCeremony={() => {
     unlockAudio();
     if (autoRef.current) stopAuto();
     if (meditatingRef.current) finishMeditation();
     setLampOpen(false);
     setCameraMode("third");
     setLampPulse(value => value + 1);
     notify("正前往长明灯塔，抵达后开始点灯仪式。");
    }} />
   {toast && createPortal(<div className="toast game-toast" role="status"><Leaf size={18} />{toast}</div>, document.body)}
   {modal && <div className="modal-backdrop" onClick={() => setModal(null)}>
    <section className="modal game-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={event => event.stopPropagation()}>
     <button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="关闭"><X size={24} /></button>
     <Lotus className="modal-lotus" />
     {modal === "meditate" ? <>
      <p className="eyebrow">给自己一点留白</p>
      <h2 id="modal-title">坐一会儿，就很好</h2>
      <p className="modal-description">放松肩膀，感受一呼一吸。<br />{seat === null ? "请先点右下角「坐蒲团」，再开始静坐。" : "你已坐稳，可以开始静坐了。"}</p>
      <div className="duration-picker">{[5, 10, 15].map(minutes => <button key={minutes} className={duration === minutes ? "selected" : ""} onClick={() => setDuration(minutes)}>{minutes}<small> 分钟</small></button>)}</div>
      <p className="modal-small">{connection === "online" ? `与庭院中 ${others.length} 位同修共享此刻。` : "网络连接后，可与在线同修一起静坐。"}结束时，轻轻一声钟响。</p>
      <button className="primary-button" onClick={() => void beginMeditation()}><Wind size={20} />开始静坐</button>
     </> : modal === "practice" ? <>
      <p className="eyebrow">每一念，都是好开始</p>
      <h2 id="modal-title">我的今日修行</h2>
      <div className="practice-grid">{[{ n: stats.prayer, label: "次合掌" }, { n: stats.bows, label: "次礼拜" }, { n: stats.beads, label: "次转珠" }, { n: stats.wood, label: "声木鱼" }].map(item => <div key={item.label}><strong>{item.n}</strong><span>{item.label}</span></div>)}</div>
      <div className="practice-total"><Wind size={20} />今日静坐<strong>{clock(stats.seconds)}</strong></div>
      <p className="modal-small">记录保存在本设备当前小和尚，按本地日期更新。</p>
      <button className="primary-button" onClick={() => setModal(null)}>回到庭院</button>
     </> : modal === "sutra" || modal === "breathe" ? <FloorActivity kind={modal} onSound={tone} /> : modal === "mural" ? <TempleReading kind="mural" onSound={tone} /> : <>
      <p className="eyebrow">欢迎来到云间寺</p>
      <h2 id="modal-title">慢慢走，随心坐</h2>
      <ul className="help-list">
       <li><b>漫游</b><span>左上「地图导航」选择殿堂或景点，点「到处走走」自动前往一处风景。左下摇杆行走，也可点地面前往。地图可上下左右拖动。</span></li>
       <li><b>视角</b><span>双指开合或点加减按钮缩放。右上菜单内可切换地图、第一人称和第三人称。</span></li>
       <li><b>动作</b><span>右侧「敲木鱼」随时可点。走近蒲团坐稳后，点右下「修行」展开合掌、跪拜、佛珠和静坐。</span></li>
       <li><b>殿堂</b><span>大雄宝殿向如来敬香，观音殿与文殊殿各有独立香炉。文殊殿可为学业、高考祈愿。藏经阁读经，观云阁调息。</span></li>
       <li><b>点灯</b><span>长明灯塔可写下私密心愿，每日手动点亮，漏点日期可免费补点。地图导航可前往灯塔，菜单可打开我的长明灯。</span></li>
       <li><b>放灯</b><span>去「孔明灯许愿台」写下心愿，小和尚会托灯放飞。心愿仅自己可见。</span></li>
       <li><b>早晚课</b><span>北京时间6:00、21:00各有15分钟全寺心经念诵，屏幕会显示剩余时间。每到整点、半点敲四声钟。右上菜单可统一关闭声音。</span></li>
       <li><b>钟鼓</b><span>地图导航可前往鼓楼、钟楼，走近后敲鼓或撞钟。财神庙设有独立敬香入口。</span></li>
       <li><b>礼拜</b><span>第三人称长按小和尚，或点「108拜」自动礼拜，可暂停并继续。</span></li>
       <li><b>同修</b><span>走到大殿可敬香，花园可献花，祈愿台可参加线上仪式。右上菜单可结交寺友、写日记。</span></li>
       <li><b>景观</b><span>钟亭鸣钟，莲池喂锦鲤，放生池可放鱼、投喂，塔林合掌祈愿，习武广场练拳。大雄宝殿可敬香、点莲灯、赏壁画。</span></li>
       <li><b>声音</b><span>右上菜单可开关声音。木鱼使用真实录音，其余动作各有轻响。<a href="https://freesound.org/people/jonopodmore/sounds/607215/" target="_blank" rel="noreferrer">木鱼录音由 jonopodmore 以 CC0 发布。</a></span></li>
      </ul>
      <button className="primary-button" onClick={() => setModal(null)}>回到庭院</button>
     </>}
    </section>
   </div>}
  </div>
 );
}
