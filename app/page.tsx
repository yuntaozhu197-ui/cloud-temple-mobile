"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, CircleHelp, X, Leaf, ArrowUpRight, Pause, Play, Check, Wind, Share2, ChevronRight, Sparkles } from "lucide-react";
import TempleWorld from "./TempleWorld";
import SocialTemple from "./SocialTemple";
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
 const [stats,setStats]=useState<Stats>(freshStats),[loaded,setLoaded]=useState(false),[sound,setSound]=useState(false),[toast,setToast]=useState(""),[modal,setModal]=useState<"help"|"practice"|"meditate"|null>(null);
 const [auto,setAuto]=useState(false),[bowCount,setBowCount]=useState(0),[meditating,setMeditating]=useState(false),[duration,setDuration]=useState(5),[remaining,setRemaining]=useState(0);
 const audioRef=useRef<AudioContext|null>(null),toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null),actionTimer=useRef<ReturnType<typeof setTimeout>|null>(null),positionRef=useRef({x:0,z:9,heading:0}),positionSent=useRef(0);
 const [place,setPlace]=useState("静心庭院");
 const requestSeq=useRef(0),requestQueue=useRef<Promise<unknown>>(Promise.resolve()),requestBusy=useRef(false),roomRef=useRef<Room|null>(null),preferredSeat=useRef(5),bowCountRef=useRef(0),meditationEnd=useRef(0),lastTick=useRef(0),autoRef=useRef(false),meditatingRef=useRef(false),seatRef=useRef<number|null>(null);
 const notify=useCallback((text:string)=>{setToast(text);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(""),3200)},[]);
 const add=useCallback((key:keyof Omit<Stats,"date">,amount=1)=>setStats(s=>{const base=s.date===day()?s:freshStats();return {...base,[key]:base[key]+amount}}),[]);
 const tone=useCallback((kind="wood")=>{if(!sound)return;try{const Ctx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;const ctx=audioRef.current??new Ctx();audioRef.current=ctx;void ctx.resume();const now=ctx.currentTime;(kind==="wood"?[380,760,1210]:[523.25,1046.5,1569.75]).forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.setValueAtTime(f,now);if(kind==="wood")o.frequency.exponentialRampToValueAtTime(f*.65,now+.17);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime((kind==="wood"?.23:.08)/(i+1),now+.004);g.gain.exponentialRampToValueAtTime(.0001,now+(kind==="wood"?.38:2.6));o.connect(g);g.connect(ctx.destination);o.start(now);o.stop(now+(kind==="wood"?.4:2.7))})}catch{notify("声音暂时不可用，仍可安心修行")}},[sound,notify]);
 const sync=useCallback((body?:Record<string,unknown>):Promise<Room|null>=>{
  const seq=++requestSeq.current;
  const run=async():Promise<Room|null>=>{
   // Preserve seat and meditation transitions while coalescing queued movement.
   const userTransition=Object.hasOwn(body??{},"seat")||Object.hasOwn(body??{},"meditating");
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
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("cloud-temple-stats")||"null");if(saved?.date===day()&&["bows","wood","beads","prayer","seconds"].every(k=>Number.isFinite(saved[k])&&saved[k]>=0))setStats(saved);setSound(localStorage.getItem("cloud-temple-sound")==="true")}catch{}setLoaded(true);void sync();const timer=setInterval(()=>{if(!document.hidden&&!requestBusy.current)void sync(meditatingRef.current?{meditating:true,action:"meditate"}:autoRef.current?{action:"bow"}:undefined)},3000);return()=>{clearInterval(timer);if(toastTimer.current)clearTimeout(toastTimer.current);if(actionTimer.current)clearTimeout(actionTimer.current);void audioRef.current?.close()}},[sync]);
 useEffect(()=>{if(loaded){try{localStorage.setItem("cloud-temple-stats",JSON.stringify(stats));localStorage.setItem("cloud-temple-sound",String(sound))}catch{}}},[loaded,stats,sound]);
 useEffect(()=>{autoRef.current=auto;meditatingRef.current=meditating;seatRef.current=seat},[auto,meditating,seat]);
 useEffect(()=>{const visible=()=>{if(document.hidden){if(autoRef.current){autoRef.current=false;setAuto(false);setAction("idle");void sync({action:"idle"});notify("礼拜已暂停，回来后可继续")}}else void sync(meditatingRef.current?{meditating:true,action:"meditate"}:undefined)};document.addEventListener("visibilitychange",visible);return()=>document.removeEventListener("visibilitychange",visible)},[sync,notify]);
 const doAction=useCallback((kind:string)=>{if(meditatingRef.current||autoRef.current)return;setAction(kind);setPulse(p=>p+1);const key=({prayer:"prayer",bow:"bows",beads:"beads",wood:"wood"} as const)[kind as "prayer"|"bow"|"beads"|"wood"];if(key)add(key);if(kind==="wood")tone();void sync({action:kind});if(actionTimer.current)clearTimeout(actionTimer.current);actionTimer.current=setTimeout(()=>{setAction("idle");void sync({action:"idle"})},1050)},[add,tone,sync]);
 const startAuto=()=>{if(autoRef.current)return;if(meditatingRef.current){notify("先结束静坐，再开始礼拜吧");return}if(actionTimer.current)clearTimeout(actionTimer.current);if(bowCountRef.current>=108){bowCountRef.current=0;setBowCount(0)}autoRef.current=true;setAuto(true);setAction("idle");notify(bowCountRef.current>0?"继续礼拜，慢慢来":"已开始 108 次礼拜，可随时暂停")};
 useEffect(()=>{if(!auto)return;const timer=setInterval(()=>{if(!autoRef.current||bowCountRef.current>=108)return;bowCountRef.current+=1;setBowCount(bowCountRef.current);add("bows");setAction("bow");setPulse(p=>p+1)},1250);void sync({action:"bow"});return()=>clearInterval(timer)},[auto,add,sync]);
 useEffect(()=>{if(auto&&bowCount>=108){autoRef.current=false;setAuto(false);setAction("prayer");tone("bell");notify("108 次礼拜圆满。愿你心生欢喜。");void sync({action:"prayer"})}},[bowCount,auto,tone,notify,sync]);
 const stopAuto=()=>{autoRef.current=false;setAuto(false);setAction("idle");void sync({action:"idle"})};
 const finishMeditation=useCallback((completed=false)=>{setMeditating(false);meditatingRef.current=false;setRemaining(0);setAction("idle");void sync({meditating:false,action:"idle"});tone("bell");notify(completed?"静坐圆满，带着这份平静继续生活吧":"已结束静坐，愿此刻的安静陪着你")},[sync,tone,notify]);
 useEffect(()=>{if(!meditating)return;const timer=setInterval(()=>{const now=Date.now(),left=Math.max(0,Math.ceil((meditationEnd.current-now)/1000)),elapsed=Math.max(0,Math.floor((Math.min(now,meditationEnd.current)-lastTick.current)/1000));if(elapsed>0){add("seconds",elapsed);lastTick.current+=elapsed*1000}setRemaining(left);if(left===0)finishMeditation(true)},1000);return()=>clearInterval(timer)},[meditating,add,finishMeditation]);
 const beginMeditation=async()=>{if(meditatingRef.current)return;if(seatRef.current===null){notify("先在庭院里选一个空蒲团吧");setModal(null);return}if(autoRef.current)stopAuto();if(actionTimer.current)clearTimeout(actionTimer.current);setModal(null);meditationEnd.current=Date.now()+duration*60000;lastTick.current=Date.now();setRemaining(duration*60);setMeditating(true);meditatingRef.current=true;setAction("meditate");tone("bell");const data=await sync({meditating:true,action:"meditate"});if(meditatingRef.current)notify(data?"已加入静坐。吸气，呼气，回到此刻。":"正在独自静坐；网络恢复后将重新连接")};
 const chooseSeat=async(n:number)=>{if(autoRef.current){notify("暂停礼拜后，就可以换蒲团了");return}if(connection==="online"&&room?.participants.some(p=>p.seat===n&&p.id!==room.selfId)){notify("这个蒲团已有同修，请选另一个");return}preferredSeat.current=n;const body={seat:n,...(meditatingRef.current?{meditating:true,action:"meditate"}:{})};if(connection!=="online"){seatRef.current=n;setSeat(n);notify("已在这里坐下，正在等待网络恢复");void sync(body);return}const data=await sync(body);if(data)notify("坐稳啦，把心慢慢放下来")};
 const sitNearby=()=>{const available=seats.map((p,n)=>({...p,n})).filter(p=>connection!=="online"||!room?.participants.some(v=>v.id!==room.selfId&&v.seat===p.n)).sort((a,b)=>Math.hypot(a.x-positionRef.current.x,a.z-positionRef.current.z)-Math.hypot(b.x-positionRef.current.x,b.z-positionRef.current.z));if(available[0])void chooseSeat(available[0].n);else notify("蒲团暂时坐满了，先在寺里走走吧")};
 const leaveSeat=()=>{if(autoRef.current||meditatingRef.current)return;seatRef.current=null;setSeat(null);setAction("idle");void sync({seat:null,action:"idle"})};
 const movePosition=useCallback((p:{x:number,z:number,heading:number})=>{positionRef.current=p;if(Date.now()-positionSent.current>1200){positionSent.current=Date.now();void sync({...p})}},[sync]);
 const activeParticipants=connection==="online"?(room?.participants??[]):[];
 const others=activeParticipants.filter(v=>v.id!==room?.selfId),selfName=room?.participants.find(v=>v.id===room.selfId)?.name??"小知";
 const share=async()=>{try{const data={title:"云间寺 · 给心放个假",text:"来云间寺，和我一起静坐一会儿。",url:window.location.href};if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);notify("寺庙链接已复制，邀朋友来坐坐吧")}}catch(e){if((e as Error).name!=="AbortError")notify("可复制浏览器地址，邀朋友一起静坐")}};
 return <div className="site-shell"><header className="site-header"><a href="/" className="brand" aria-label="云间寺首页"><span className="brand-mark"><Lotus/></span><span><strong>云间寺</strong><small>A LITTLE PEACE</small></span></a><nav aria-label="主导航"><button className="nav-active" onClick={()=>setModal(null)}>寺庙庭院</button><button onClick={()=>setModal("practice")}>我的修行</button><button onClick={()=>setModal("help")}>关于这里</button></nav><div className="header-tools"><button className={`sound-toggle ${sound?"on":""}`} onClick={()=>{setSound(!sound);notify(sound?"声音已关闭":"声音已开启，试着敲一下木鱼")}} aria-label={sound?"关闭声音":"开启声音"}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>声音{sound?"已开":"已关"}</span></button><button className="icon-button help-button" onClick={()=>setModal("help")} aria-label="玩法帮助"><CircleHelp size={20}/></button></div></header>
 <main className="main-content"><section className="welcome"><div><p className="eyebrow"><span/> 一方小院，一念清宁</p><h1>忙碌之外，留一隅清净<span>。</span></h1><p className="welcome-sub">走进山间小寺，随意走走。找一只蒲团，让心慢慢安静下来。</p></div><button className="invite" onClick={share}><Share2 size={15}/> 邀朋友来坐坐 <ArrowUpRight size={15}/></button></section>
 <div className="temple-layout"><section className="play-area" aria-label="寺庙互动区"><div className="courtyard world-courtyard"><TempleWorld incensePulse={incensePulse} action={action} actionPulse={pulse} auto={auto} meditating={meditating} seat={seat} selfId={room?.selfId} participants={activeParticipants} onSeatSelect={n=>void chooseSeat(n)} onLeaveSeat={leaveSeat} onLongPress={startAuto} onPositionChange={movePosition} onPlaceChange={setPlace}/><div className="scene-top"><span className="place-label"><span className="tiny-lotus">✳</span> 云间寺 <span className="place-separator">/</span> {place}</span><span className={`online-pill ${connection}`}><i/>{connection==="online"?`${room?.total??1} 人在这里`:connection==="offline"?"离线漫游":"正在入寺…"}</span></div><div className="world-name"><i/> {selfName} · 你</div></div><div className="world-instructions"><span><Wind size={14}/>{meditating?"吸气，呼气，回到此刻。":auto?"一拜一念，慢慢放下。":"摇杆行走 · 点击地面前往 · 拖动画面转动视角"}</span><div className="world-tools"><button className="sit-nearby" disabled={auto||meditating} onClick={()=>seat===null?sitNearby():leaveSeat()}>{seat===null?"找个蒲团坐下":"起身走走"} <ChevronRight size={13}/></button><button onClick={()=>setModal("help")} aria-label="漫游指南"><CircleHelp size={15}/></button></div></div>

 <div className="actions-section"><div className="section-label"><span>随心修行</span><a className="community-shortcut" href="#temple-social">结缘 · 敬香 <ChevronRight size={13}/></a><small>每一个小动作，都让心安定一点</small></div><div className="action-grid">{[{key:"prayer",name:"合掌",sub:"心怀善意"},{key:"bow",name:"跪拜",sub:"放下一念"},{key:"beads",name:"转佛珠",sub:"一珠一清净"},{key:"wood",name:"敲木鱼",sub:"笃，烦恼散去"}].map(item=><button key={item.key} className={`action-button ${action===item.key?"is-active":""}`} disabled={auto||meditating} onClick={()=>doAction(item.key)}><ActionIcon kind={item.key}/><span><strong>{item.name}</strong><small>{item.sub}</small></span></button>)}</div></div>
 <div className="bow-bar"><span className="bow-bar-icon"><Sparkles size={17}/></span><div><strong>{auto?"正在自动礼拜":bowCount===108?"108 次礼拜圆满":"一念虔诚，108 次礼拜"}</strong><small>{auto?"不必一直按住，安心跟随此刻":bowCount>0&&bowCount<108?"已为你记住进度，随时继续":"长按庭院里的小和尚，即可自动开始"}</small></div><span className="bow-number">{bowCount}<small>/108</small></span><button className={auto?"pause-bow":"start-bow"} onClick={()=>auto?stopAuto():startAuto()} disabled={meditating}>{auto?<Pause size={15}/>:bowCount===108?<Check size={15}/>:<Play size={14}/>}<span>{auto?"暂停":bowCount>0&&bowCount<108?"继续":bowCount===108?"再来一轮":"开始"}</span></button><div className="bow-progress" style={{width:`${bowCount/108*100}%`}}/></div></section>
 <aside className="side-panel"><section className="meditation-card"><div className="card-overline"><span className="live-dot"/> 同在此刻</div><Lotus className="meditation-lotus"/><h2>一起，安静一会儿</h2><p>天南海北的我们，<br/>在同一片屋檐下，暂歇片刻。</p><div className="fellow-row">{others.length>0?<><div className="fellow-avatars">{others.slice(0,3).map(p=><span key={p.id}><Lotus/></span>)}</div><span>{room?.meditatingCount??0} 位同修正在静坐</span></>:<><span className="empty-leaf"><Leaf size={17}/></span><span>{connection==="online"?"此刻清静，等一位有缘人":connection==="offline"?"独处，也是一种安静":"正在轻轻推开寺门"}</span></>}</div>{meditating?<div className="active-meditation"><div className="meditation-time">{clock(remaining)}</div><span>一呼一吸，回到当下</span><button className="primary-button" onClick={()=>finishMeditation()}>结束静坐</button></div>:<button className="primary-button" onClick={()=>setModal("meditate")}><Wind size={17}/> 加入静坐 <ArrowUpRight size={16}/></button>}<small className="no-rush">{meditating?"时间会替你轻轻记着":"无需交流，陪伴已在"}</small></section>
 <section className="today-card"><div className="today-title"><h2>今日小修行</h2><span>日积 · 心安</span></div><div className="today-stat"><span><span className="stat-symbol">◌</span> 虔诚礼拜</span><strong>{loaded?stats.bows:0}<small> 次</small></strong></div><div className="today-stat"><span><span className="stat-symbol">♧</span> 木鱼轻响</span><strong>{loaded?stats.wood:0}<small> 声</small></strong></div><div className="today-stat"><span><Wind size={16}/> 安心静坐</span><strong>{loaded?Math.floor(stats.seconds/60):0}<small> 分钟</small></strong></div><button className="practice-link" onClick={()=>setModal("practice")}>看看我的修行 <ChevronRight size={14}/></button></section><section className="daily-note"><span className="quote-mark">“</span><p>心若安住，<br/>处处皆是好风景。</p><span className="note-line"/><small>今日一念</small><Leaf className="note-leaf" size={41}/></section></aside></div>
 <div id="temple-social"><SocialTemple selfId={room?.selfId} onIncense={()=>setIncensePulse(count=>count+1)} onNotice={notify}/></div>
 <footer><span><Lotus/> 云间寺 · 给心放个假</span><span>不争朝夕，只在此刻 <i>·</i> 愿你自在</span></footer></main>
 {toast&&<div className="toast" role="status"><Leaf size={16}/>{toast}</div>}{modal&&<div className="modal-backdrop" onClick={()=>setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" onClick={()=>setModal(null)} aria-label="关闭"><X size={21}/></button><Lotus className="modal-lotus"/>{modal==="meditate"?<><p className="eyebrow">给自己一点留白</p><h2 id="modal-title">坐一会儿，就很好</h2><p className="modal-description">找一个舒服的姿势，放松肩膀。<br/>不必清空念头，只需觉察一呼一吸。</p><div className="duration-picker">{[5,10,15].map(d=><button key={d} className={duration===d?"selected":""} onClick={()=>setDuration(d)}>{d}<small> 分钟</small></button>)}</div><p className="modal-small">{connection==="online"?`与庭院中 ${others.length} 位同修共享此刻。`:"网络连接后，可与在线同修一起静坐。"}结束时，轻轻一声钟响。</p><button className="primary-button" onClick={()=>void beginMeditation()}><Wind size={17}/> 开始静坐</button></>:modal==="practice"?<><p className="eyebrow">每一念，都是好开始</p><h2 id="modal-title">我的今日修行</h2><p className="modal-description">修行不在多少，在每一次回到当下。</p><div className="practice-grid">{[{n:stats.prayer,l:"次合掌"},{n:stats.bows,l:"次礼拜"},{n:stats.beads,l:"次转珠"},{n:stats.wood,l:"声木鱼"}].map(s=><div key={s.l}><strong>{s.n}</strong><span>{s.l}</span></div>)}</div><div className="practice-total"><Wind size={18}/> 今日静坐 <strong>{clock(stats.seconds)}</strong></div><p className="modal-small">记录保存在当前浏览器，按本地日期更新。</p><button className="primary-button" onClick={()=>setModal(null)}>回到庭院</button></>:<><p className="eyebrow">欢迎来到云间寺</p><h2 id="modal-title">给心，放个小假</h2><p className="modal-description">一座随时可以抵达的小寺庙。<br/>没有任务，也不必追赶什么。</p><ul className="help-list"><li><b>漫游</b><span>手机拖动左下摇杆，或点地面行走；拖动画面转动视角。电脑也可使用 WASD 或方向键。可探索大殿、竹林、莲池与钟亭。</span></li><li><b>入座</b><span>在三维庭院里走近蒲团，轻点蒲团坐下。拖动摇杆即可起身。</span></li><li><b>随心</b><span>合掌、跪拜、转佛珠，或敲一声木鱼。</span></li><li><b>礼拜</b><span>长按小和尚，或点「开始」，自动礼拜 108 次。随时可暂停。</span></li><li><b>同修</b><span>加入静坐，和真实在线的同修相伴。连接状态会显示在庭院右上角。</span></li><li><b>有声</b><span>开启右上角声音，听木鱼与静坐钟声。</span></li></ul><button className="primary-button" onClick={()=>setModal(null)}>推门入寺</button></>}</section></div>}</div>
}





