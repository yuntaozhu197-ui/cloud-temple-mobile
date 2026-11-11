import { useState } from "react";
import type { TempleSound } from "./audio";

const passages = [
 { text: "观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空，度一切苦厄。", note: "慢慢读完这一句，再把注意力放回此刻的呼吸。" },
 { text: "舍利子，色不异空，空不异色，色即是空，空即是色。受想行识，亦复如是。", note: "留意“色”与“空”在句中的往复，可以停下来多读一遍。" },
 { text: "是故空中无色，无受想行识。无眼耳鼻舌身意，无色声香味触法。", note: "眼、耳、鼻、舌、身、意，与色、声、香、味、触、法相互对应。试着分句诵读。" },
 { text: "菩提萨埵，依般若波罗蜜多故，心无罣碍。无罣碍故，无有恐怖，远离颠倒梦想，究竟涅槃。", note: "“罣碍”也常写作“挂碍”。读到这里，让肩膀放松片刻。" },
];

const images = {
 mural: {
  src: "/art/dunhuang-mural.jpg",
  alt: "敦煌莫高窟第220窟南壁西方净土变，佛与菩萨、莲池、楼阁和舞乐相映",
  title: "莫高窟第220窟南壁 · 初唐",
  description: "这幅《西方净土变》以佛与菩萨为中心，把莲池、楼阁和舞乐场面组织在同一画面中。先看中央人物，再寻找池水、建筑与两侧的乐舞细节。",
  source: "https://commons.wikimedia.org/wiki/File:Western_Pure_Land_Illustration,_Cave_220,_Mogao_Caves.jpg",
  credit: "唐代壁画 · 公有领域复制图，来源 Wikimedia Commons",
 },
 original: {
  src: "/art/lotus-paradise-mural.jpg",
  alt: "云间寺原创莲池云山壁画，莲花、仙鹤、山水与流云交织",
  title: "云间寺 · 莲池云山",
  description: "莲花舒展，流云绕山，仙鹤掠过水面。寺内这幅原创壁画借青绿山水与莲花纹样，画出一方安静的天地。",
  source: "",
  credit: "云间寺原创壁画",
 },
};

type Props = {
 kind: "mural" | "sutra";
 onSound: (kind: TempleSound) => void;
};

export default function TempleReading({ kind, onSound }: Props) {
 const [passage, setPassage] = useState(0);
 const [mural, setMural] = useState<"mural" | "original">("mural");
 const image = images[mural];

 if (kind === "mural") return <>
  <p className="eyebrow">大雄宝殿 · 壁画长廊</p>
  <h2 id="modal-title">在壁画里看见寺院</h2>
  <div className="reading-tabs" role="group" aria-label="选择壁画">
   <button className={mural === "mural" ? "is-selected" : ""} aria-pressed={mural === "mural"} onClick={() => setMural("mural")}>敦煌古画</button>
   <button className={mural === "original" ? "is-selected" : ""} aria-pressed={mural === "original"} onClick={() => setMural("original")}>云间寺壁画</button>
  </div>
  <figure className="reading-figure">
   <a href={image.src} target="_blank" rel="noreferrer" aria-label="打开完整壁画图片，可放大查看"><img src={image.src} alt={image.alt} className="reading-image" /></a>
   <figcaption>{image.title}<span>点图片可放大观看</span></figcaption>
  </figure>
  <p className="reading-description">{image.description}</p>
  {mural === "mural" && <div className="reading-note"><strong>再看一眼</strong><p>试着从人物的手势、乐器与衣带读起，再沿着莲池和楼阁看向远处。静止的壁面里，也藏着热闹的舞乐场面。</p></div>}
  <p className="reading-source">{image.source ? <a href={image.source} target="_blank" rel="noreferrer">{image.credit}</a> : image.credit}</p>
  {mural === "mural" && <p className="reading-source"><a href="https://www.e-dunhuang.com/cave/10.0001/0001.0001.0220" target="_blank" rel="noreferrer">洞窟与画面介绍参考敦煌研究院「数字敦煌」</a></p>}
 </>;

 return <>
  <p className="eyebrow">藏经阁 · 经卷选读</p>
  <h2 id="modal-title">诵读心经选段</h2>
  <figure className="reading-figure reading-manuscript">
   <a href="/art/heart-sutra-manuscript.jpg" target="_blank" rel="noreferrer" aria-label="放大查看集王圣教序所附心经拓片"><img src="/art/heart-sutra-manuscript.jpg" alt="集王圣教序所附心经的古代书法拓片" className="reading-image" /></a>
   <figcaption>唐怀仁集王羲之书 ·《集王圣教序》附《心经》<span>672年立碑，原碑现藏西安碑林。左右滑动碑帖，点图可放大。</span></figcaption>
  </figure>
  <div className="sutra-reading" aria-live="polite">
   <p className="sutra-passage">{passages[passage].text}</p>
   <p className="reading-description">{passages[passage].note}</p>
  </div>
  <div className="reading-pagination">
   <button disabled={passage === 0} onClick={() => { setPassage(value => value - 1); onSound("beads"); }}>上一段</button>
   <span>{passage + 1} / {passages.length}</span>
   <button onClick={() => { setPassage(value => (value + 1) % passages.length); onSound("beads"); }}>{passage === passages.length - 1 ? "再读一遍" : "下一段"}</button>
  </div>
  <p className="reading-source">玄奘译本选段，简体转写。<a href="https://cbetaonline.dila.edu.tw/zh/T0251_001" target="_blank" rel="noreferrer">参阅 CBETA T0251 经文</a></p>
  <p className="reading-source"><a href="https://commons.wikimedia.org/wiki/File:Xinjing_shengjiaoxu_wangxizhi.png" target="_blank" rel="noreferrer">公有领域碑帖复制图，来源 Wikimedia Commons</a></p>
 </>;
}
