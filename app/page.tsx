"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, CircleHelp, X, Leaf, Pause, Play, Wind, Share2, Sparkles, Camera, MoreHorizontal } from "lucide-react";
import TempleWorld from "./TempleWorld";
import SocialTemple from "./SocialTemple";
import TempleLife from "./TempleLife";
import { createTempleAudio, type TempleSound } from "./audio";
type Visitor = { id: string; name: string; seat: number | null; action: string; meditating: boolean; joinedAt: number; x: number; z: number; heading: number };
type Room = { selfId: string; now: number; participants: Visitor[]; total: number; meditatingCount: number };
type Stats = { date: string; bows: number; wood: number; beads: number; prayer: number; seconds: number };
const seats = [{x:-3,z:1},{x:-1,z:1},{x:1,z:1},{x:3,z:1},{x:-3,z:4},{x:-1,z:4},{x:1,z:4},{x:3,z:4}];
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
export default function Home(){
 const [incensePulse, setIncensePulse] = useState(0);
 const [room,setRoom]=useState<Room|null>(null),[connection,setConnection]=useState("connecting"),[seat,setSeat]=useState<number|null>(null),[action,setAction]=useState("idle"),[pulse,setPulse]=useState(0);
 const [stats,setStats]=useState<Stats>(freshStats),[loaded,setLoaded]=useState(false),[sound,setSound]=useState(true),[toast,setToast]=useState(""),[modal,setModal]=useState<"help"|"practice"|"meditate"|null>(null);
 const [auto,setAuto]=useState(false),[bowCount,setBowCount]=useState(0),[meditating,setMeditating]=useState(false),[duration,setDuration]=useState(5),[remaining,setRemaining]=useState(0);
 const audioRef=useRef<ReturnType<typeof createTempleAudio>|null>(null),toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null),actionTimer=useRef<ReturnType<typeof setTimeout>|null>(null),positionRef=useRef({x:0,z:9,heading:0}),positionSent=useRef(0);
 const [place,setPlace]=useState("静心庭院");
 const [cameraMode, setCameraMode] = useState<"first" | "third">("third");
 const [menuOpen, setMenuOpen] = useState(false);
 const [flowerPulse, setFlowerPulse] = useState(0);
 const [ritualPulse, setRitualPulse] = useState(0);
 const [exitRequest, setExitRequest] = useState(0);
 const [departed, setDeparted] = useState(false);
 const departedRef = useRef(false);
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
  void audio.unlock();
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
  if (enabled) void audio.unlock();
  setSound(enabled);
  notify(enabled ? "声音已开启，每个动作都有自己的轻响" : "声音已关闭");
 };
 useEffect(() => { audioRef.current?.setEnabled(sound); }, [sound]);
 const sync=useCallback((body?:Record<string,unknown>):Promise<Room|null>=>{
  const seq=++requestSeq.current;
  const run=async():Promise<Room|null>=>{
   if (departedRef.current && body?.leave !== true) return null;
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
      res=await fetch("/api/room",{method:payload?"POST":"GET",headers:payload?{"Content-Type":"application/json"}:undefined,body:payload?JSON.stringify(payload):undefined,cache:"no-store",signal:controller.signal});
     }finally{clearTimeout(timeout)}
     if(!res.ok&&res.status!==409)throw new Error("room");
     const data=await res.json() as Room;
     // Completed requests are already ordered by the queue, including on slow networks.
     const self=data.participants.find(v=>v.id===data.selfId);
     if(self?.seat===null&&meditatingRef.current&&attempt<seats.length){
      const available=[preferredSeat.current,5,6,1,2,0,3,4,7].find(n=>!data.participants.some(p=>p.seat===n));
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
 },[notify]);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("cloud-temple-stats")||"null");if(saved?.date===day()&&["bows","wood","beads","prayer","seconds"].every(k=>Number.isFinite(saved[k])&&saved[k]>=0))setStats(saved);setSound(localStorage.getItem("cloud-temple-sound")!=="false")}catch{}setLoaded(true);void sync();const timer=setInterval(()=>{if(!document.hidden&&!requestBusy.current)void sync(meditatingRef.current?{meditating:true,action:"meditate"}:autoRef.current?{action:"bow"}:undefined)},3000);return()=>{clearInterval(timer);if(toastTimer.current)clearTimeout(toastTimer.current);if(actionTimer.current)clearTimeout(actionTimer.current);audioRef.current?.dispose()}},[sync]);
 useEffect(()=>{if(loaded){try{localStorage.setItem("cloud-temple-stats",JSON.stringify(stats));localStorage.setItem("cloud-temple-sound",String(sound))}catch{}}},[loaded,stats,sound]);
 useEffect(()=>{autoRef.current=auto;meditatingRef.current=meditating;seatRef.current=seat},[auto,meditating,seat]);
 useEffect(()=>{const visible=()=>{if(document.hidden){if(autoRef.current){autoRef.current=false;setAuto(false);setAction("idle");void sync({action:"idle"});notify("礼拜已暂停，回来后可继续")}}else void sync(meditatingRef.current?{meditating:true,action:"meditate"}:undefined)};document.addEventListener("visibilitychange",visible);return()=>document.removeEventListener("visibilitychange",visible)},[sync,notify]);
 const doAction=useCallback((kind:string)=>{if(meditatingRef.current||autoRef.current)return;setAction(kind);setPulse(p=>p+1);const key=({prayer:"prayer",bow:"bows",beads:"beads",wood:"wood"} as const)[kind as "prayer"|"bow"|"beads"|"wood"];if(key)add(key);tone(kind as TempleSound);void sync({action:kind});if(actionTimer.current)clearTimeout(actionTimer.current);actionTimer.current=setTimeout(()=>{setAction("idle");void sync({action:"idle"})},1050)},[add,tone,sync]);
 const startAuto=()=>{unlockAudio();if(autoRef.current)return;if(meditatingRef.current){notify("先结束静坐，再开始礼拜吧");return}if(actionTimer.current)clearTimeout(actionTimer.current);if(bowCountRef.current>=108){bowCountRef.current=0;setBowCount(0)}autoRef.current=true;setAuto(true);setAction("idle");notify(bowCountRef.current>0?"继续礼拜，慢慢来":"已开始 108 次礼拜，可随时暂停")};
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
   }, 1050);
  };
  bow();
  const timer = setInterval(bow, 1250);
  void sync({ action: "bow" });
  return () => { clearInterval(timer); clearTimeout(completedBow); };
 }, [auto, add, sync, tone]);
 useEffect(()=>{if(auto&&bowCount>=108){autoRef.current=false;setAuto(false);setAction("prayer");tone("bell");notify("108 次礼拜圆满。愿你心生欢喜。");void sync({action:"prayer"})}},[bowCount,auto,tone,notify,sync]);
 const stopAuto=()=>{autoRef.current=false;setAuto(false);setAction("idle");void sync({action:"idle"})};
 const finishMeditation=useCallback((completed=false)=>{setMeditating(false);meditatingRef.current=false;setRemaining(0);setAction("idle");void sync({meditating:false,action:"idle"});tone("bell");notify(completed?"静坐圆满，带着这份平静继续生活吧":"已结束静坐，愿此刻的安静陪着你")},[sync,tone,notify]);
 useEffect(()=>{if(!meditating)return;const timer=setInterval(()=>{const now=Date.now(),left=Math.max(0,Math.ceil((meditationEnd.current-now)/1000)),elapsed=Math.max(0,Math.floor((Math.min(now,meditationEnd.current)-lastTick.current)/1000));if(elapsed>0){add("seconds",elapsed);lastTick.current+=elapsed*1000}setRemaining(left);if(left===0)finishMeditation(true)},1000);return()=>clearInterval(timer)},[meditating,add,finishMeditation]);
 const beginMeditation=async()=>{unlockAudio();if(meditatingRef.current)return;if(seatRef.current===null){notify("先在庭院里选一个空蒲团吧");setModal(null);return}if(autoRef.current)stopAuto();if(actionTimer.current)clearTimeout(actionTimer.current);setModal(null);meditationEnd.current=Date.now()+duration*60000;lastTick.current=Date.now();setRemaining(duration*60);setMeditating(true);meditatingRef.current=true;setAction("meditate");tone("meditate");const data=await sync({meditating:true,action:"meditate"});if(meditatingRef.current)notify(data?"已加入静坐。吸气，呼气，回到此刻。":"正在独自静坐；网络恢复后将重新连接")};
 const chooseSeat=async(n:number)=>{if(autoRef.current){notify("暂停礼拜后，就可以换蒲团了");return}if(connection==="online"&&room?.participants.some(p=>p.seat===n&&p.id!==room.selfId)){notify("这个蒲团已有同修，请选另一个");return}preferredSeat.current=n;const body={seat:n,...(meditatingRef.current?{meditating:true,action:"meditate"}:{})};if(connection!=="online"){seatRef.current=n;setSeat(n);notify("已在这里坐下，正在等待网络恢复");void sync(body);return}const data=await sync(body);if(data)notify("坐稳啦，把心慢慢放下来")};
 const sitNearby=()=>{const available=seats.map((p,n)=>({...p,n})).filter(p=>connection!=="online"||!room?.participants.some(v=>v.id!==room.selfId&&v.seat===p.n)).sort((a,b)=>Math.hypot(a.x-positionRef.current.x,a.z-positionRef.current.z)-Math.hypot(b.x-positionRef.current.x,b.z-positionRef.current.z));if(available[0])void chooseSeat(available[0].n);else notify("蒲团暂时坐满了，先在寺里走走吧")};
 const leaveSeat=()=>{if(autoRef.current||meditatingRef.current)return;seatRef.current=null;setSeat(null);setAction("idle");void sync({seat:null,action:"idle"})};
 const movePosition=useCallback((p:{x:number,z:number,heading:number})=>{positionRef.current=p;if(Date.now()-positionSent.current>1200){positionSent.current=Date.now();void sync({...p})}},[sync]);
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
 if (departed) return <div className="site-shell temple-game temple-departure"><Lotus /><h1>愿你带着平静，回到生活</h1><p>谢谢你来坐坐，我们下次再见。</p><button className="primary-button" onClick={() => window.location.reload()}>再回寺里走走</button></div>;
 return (
  <div className="site-shell temple-game" onKeyDownCapture={unlockAudio}>
   <main className="temple-stage" aria-label="云间寺三维庭院" onPointerDownCapture={unlockAudio}>
    <div className="courtyard world-courtyard">
     <TempleWorld
      cameraMode={cameraMode}
      flowerPulse={flowerPulse}
      ritualPulse={ritualPulse}
      incensePulse={incensePulse}
      action={action}
      actionPulse={pulse}
      auto={auto}
      meditating={meditating}
      seat={seat}
      selfId={room?.selfId}
      participants={activeParticipants}
      onSeatSelect={n => void chooseSeat(n)}
      onLeaveSeat={leaveSeat}
      onLongPress={startAuto}
      onPositionChange={movePosition}
      onPlaceChange={setPlace}
     />
    </div>

    <header className="game-header">
     <div className="game-brand"><Lotus /><div><h1>云间寺</h1><span>{place}</span></div></div>
     <div className="game-header-tools">
      <button className={`hud-button sound-control ${sound ? "is-on" : ""}`} onClick={toggleSound} aria-label={sound ? "关闭声音" : "开启声音"} aria-pressed={sound}>
       {sound ? <Volume2 size={21} /> : <VolumeX size={21} />}<span>声音{sound ? "开" : "关"}</span>
      </button>
      <button className="hud-button menu-control" onClick={() => setMenuOpen(value => !value)} aria-label="更多选项" aria-expanded={menuOpen} aria-controls="game-menu"><MoreHorizontal size={24} /></button>
     </div>
    </header>
    <div className={`game-presence online-pill ${connection}`} role="status"><i />{connection === "online" ? `${room?.total ?? 1} 人在寺` : connection === "offline" ? "离线漫游" : "正在入寺…"}</div>
    <button className="hud-button view-toggle" onClick={() => setCameraMode(mode => mode === "third" ? "first" : "third")} aria-label={`切换到${cameraMode === "third" ? "第一" : "第三"}人称视角`}><Camera size={20} /><span>{cameraMode === "third" ? "第三人称" : "第一人称"}</span></button>

    {menuOpen && <>
     <button className="menu-dismiss" aria-label="收起更多选项" onClick={() => setMenuOpen(false)} />
     <nav id="game-menu" className="game-menu" aria-label="更多选项">
      <strong>{selfName} · 你的小和尚</strong>
      <button onClick={() => { setMenuOpen(false); setModal("practice"); }}><Sparkles size={20} />我的修行</button>
      <button onClick={() => { setMenuOpen(false); void share(); }}><Share2 size={20} />邀请朋友</button>
      <button onClick={() => { setMenuOpen(false); setModal("help"); }}><CircleHelp size={20} />玩法帮助</button>
      <button onClick={() => { setMenuOpen(false); setExitRequest(value => value + 1); }}><Leaf size={20} />离寺 · 留个建议</button>
     </nav>
    </>}

    <SocialTemple
     compact
     selfId={room?.selfId}
     onInteraction={unlockAudio}
     onIncense={() => { setIncensePulse(count => count + 1); tone("incense"); }}
     onNotice={notify}
    />
    <TempleLife
     selfId={room?.selfId}
     exitRequest={exitRequest}
     onNotice={notify}
     onProfileChange={() => void sync()}
     onOffering={kind => {
      unlockAudio();
      tone(kind === "flower" ? "incense" : kind === "ritual" ? "meditate" : "prayer");
      if (kind === "flower") setFlowerPulse(value => value + 1);
      if (kind === "ritual") setRitualPulse(value => value + 1);
     }}
     onLeave={leaveTemple}
    />

    <section className="game-action-dock" aria-label="随心修行动作">
     <button className={`auto-bow-control ${auto ? "is-active" : ""}`} onClick={() => auto ? stopAuto() : startAuto()} disabled={meditating} aria-label={auto ? "暂停自动礼拜" : bowCount > 0 && bowCount < 108 ? "继续108次自动礼拜" : "开始108次自动礼拜"}>
      {auto ? <Pause size={18} /> : <Play size={18} />}
      <span>{auto ? "暂停礼拜" : bowCount > 0 && bowCount < 108 ? "继续礼拜" : "108拜"}</span>
      <strong>{bowCount}<small>/108</small></strong>
      <span className="auto-bow-progress" style={{ width: `${bowCount / 108 * 100}%` }} />
     </button>
     <div className="game-action-grid">
      {[
       { key: "prayer", name: "合掌" },
       { key: "bow", name: "跪拜" },
       { key: "beads", name: "转佛珠" },
       { key: "wood", name: "敲木鱼" },
      ].map(item => <button key={item.key} className={`game-action ${action === item.key ? "is-active" : ""}`} disabled={auto || meditating} onClick={() => doAction(item.key)} aria-label={item.name} aria-pressed={action === item.key}>
       <ActionIcon kind={item.key} /><span>{item.name}</span>
      </button>)}
      <button className="game-action" disabled={auto || meditating} onClick={() => seat === null ? sitNearby() : leaveSeat()}><Lotus /><span>{seat === null ? "坐蒲团" : "起身"}</span></button>
      <button className={`game-action ${meditating ? "is-active" : ""}`} disabled={auto} onClick={() => meditating ? finishMeditation() : setModal("meditate")}><Wind size={28} /><span>{meditating ? "结束静坐" : "静坐"}</span></button>
     </div>
    </section>
    {meditating && <div className="game-meditation-status" role="timer"><Wind size={18} /><strong>{clock(remaining)}</strong><span>{room?.meditatingCount ?? 1}人共修</span></div>}
   </main>

   {toast && <div className="toast" role="status"><Leaf size={18} />{toast}</div>}
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
      <p className="modal-small">记录保存在当前浏览器，按本地日期更新。</p>
      <button className="primary-button" onClick={() => setModal(null)}>回到庭院</button>
     </> : <>
      <p className="eyebrow">欢迎来到云间寺</p>
      <h2 id="modal-title">慢慢走，随心坐</h2>
      <ul className="help-list">
       <li><b>漫游</b><span>左下摇杆行走，点地面前往。拖动画面环顾四周，电脑也可用 WASD 或方向键。寺墙处会停下。</span></li>
       <li><b>视角</b><span>点右上「第一人称 / 第三人称」切换视角。</span></li>
       <li><b>动作</b><span>右下可合掌、跪拜、转佛珠、敲木鱼和坐蒲团，点按钮时也能一直看着庭院。</span></li>
       <li><b>礼拜</b><span>第三人称长按小和尚，或点「108拜」自动礼拜，可暂停并继续。</span></li>
       <li><b>同修</b><span>坐下后选择静坐时长，和在线同修安静相伴。右上可敬香、结交寺友。</span></li>
       <li><b>声音</b><span>上方可开关声音。合掌、跪拜、佛珠、木鱼、静坐与敬香各有轻响。</span></li>
      </ul>
      <button className="primary-button" onClick={() => setModal(null)}>回到庭院</button>
     </>}
    </section>
   </div>}
  </div>
 );
}
