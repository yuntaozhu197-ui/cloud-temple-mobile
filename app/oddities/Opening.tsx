import { useEffect, useState, type CSSProperties } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { ITEMS, RARITIES, type MerchantId } from "./catalog";
import type { Receipt } from "./engine";
import { OdditiesArtifactArt, OdditiesMerchantArt } from "./OdditiesArt";
import OddityItemArt from "./OddityItemArt";
import "./opening.css";

type Props = {
  merchantId: MerchantId;
  receipt: Receipt;
  onCollect: () => void | Promise<void>;
};

const dealers = {
  squirrel: { box: "古董匣", receive: "松鼠把松果抱进怀里。", find: "它踮起脚，在木箱深处翻找。", legendary: "松鼠把尾巴抱得紧紧的，小声说：「这件我藏了好多年。」" },
  koi: { box: "水纹珠匣", receive: "锦鲤绕着香火游了一圈。", find: "它潜入池底，水面升起一串气泡。", legendary: "锦鲤跃过水面，一尾金光把满池荷叶照亮了。" },
  tit: { box: "花瓣锦囊", receive: "山雀叼住碎片，抖了抖翅膀。", find: "它飞去檐角，衔来一只花瓣锦囊。", legendary: "山雀叽叽喳喳跳了三圈，又唤来一阵落花。" },
};

const particleCounts = { common: 0, rare: 9, precious: 12, legendary: 18 };
type Phase = "receive" | "find" | "sealed" | "unseal" | "reward";

export default function OddityOpening(props: Props) {
  return <OpeningSequence key={props.receipt.id} {...props} />;
}

function OpeningSequence({ merchantId, receipt, onCollect }: Props) {
  const [phase, setPhase] = useState<Phase>(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reward" : "receive");
  const [collecting, setCollecting] = useState(false);
  const [collectError, setCollectError] = useState(false);
  const dealer = dealers[merchantId];
  const item = ITEMS.find(candidate => candidate.id === receipt.itemId);
  const revealed = phase === "reward";
  const merchantMoment = phase === "receive" || phase === "find";

  useEffect(() => {
    if (phase === "reward") return;
    const next = {
      receive: ["find", 560],
      find: ["sealed", 620],
      sealed: ["unseal", 740],
      unseal: ["reward", 410],
    } as const;
    const [nextPhase, time] = next[phase];
    const clock = window.setTimeout(() => setPhase(nextPhase), time);
    return () => window.clearTimeout(clock);
  }, [phase]);

  async function collect() {
    if (collecting) return;
    setCollecting(true);
    setCollectError(false);
    try { await onCollect(); }
    catch { setCollectError(true); }
    finally { setCollecting(false); }
  }

  if (!item) {
    return <div className="odd-opening">
      <p role="status">这件旧物的资料已经变更，收藏记录仍然保留。</p>
      <button type="button" className="odd-button odd-button-primary" onClick={() => void collect()} disabled={collecting}>完成领取</button>
      {collectError && <p role="alert">暂时无法完成领取，请再试一次。</p>}
    </div>;
  }

  return <div className="odd-opening" data-merchant={merchantId} data-phase={phase} data-rarity={revealed ? item.rarity : undefined}>
    <div className="odd-opening-scene" aria-hidden="true">
      <div className="odd-opening-glow" />
      <div className="odd-opening-ground" />
      {merchantMoment ? <div className="odd-opening-dealer">
        <OdditiesMerchantArt merchant={merchantId} interacting />
      </div> : <div className="odd-opening-box">
        <div className="odd-opening-box-lid"><OdditiesArtifactArt merchant={merchantId} /></div>
        <div className="odd-opening-box-body"><OdditiesArtifactArt merchant={merchantId} /></div>
      </div>}
      {revealed && <>
        <div className="odd-opening-aura" />
        {Array.from({ length: particleCounts[item.rarity] }, (_, index) => <i
          key={index} className="odd-opening-particle"
          style={{ "--turn": `${index * 137.508}deg`, "--radius": `${47 + index % 4 * 13}px`, "--delay": `${index % 5 * 35}ms` } as CSSProperties}
        />)}
        <div className="odd-opening-prize"><OddityItemArt item={item} /></div>
      </>}
    </div>

    {revealed ? <>
      <div className="odd-opening-reward" aria-live="polite">
        <span className="odd-opening-rarity">{RARITIES[item.rarity].name}</span>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        {receipt.isNew && <span className="odd-opening-new"><Sparkles size={14} />图鉴新增</span>}
      </div>
      {item.rarity === "legendary" && <p className="odd-opening-reaction">{dealer.legendary}</p>}
      {receipt.milestone && receipt.dialogue && <p className="odd-opening-reaction">{receipt.dialogue}</p>}
      {receipt.completedCollection && <p className="odd-opening-achievement"><Sparkles size={17} aria-hidden="true" />收藏成就解锁 · 此商人的奇物已集齐</p>}
      <button type="button" className="odd-button odd-button-primary odd-opening-action" onClick={() => void collect()} disabled={collecting}><Check size={17} aria-hidden="true" />收入收藏</button>
      {collectError && <p role="alert">暂时无法完成领取，请再试一次。</p>}
    </> : <>
      <p className="odd-opening-status" role="status">
        {phase === "receive" ? dealer.receive : phase === "find" ? dealer.find : phase === "sealed" ? `${dealer.box}轻轻晃动，缝隙里透出微光。` : `${dealer.box}打开了。`}
      </p>
      <button type="button" className="odd-button odd-opening-skip" onClick={() => setPhase("reward")}>跳过动画 <ArrowRight size={15} aria-hidden="true" /></button>
    </>}
  </div>;
}
