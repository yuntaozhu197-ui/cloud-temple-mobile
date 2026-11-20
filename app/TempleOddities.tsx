import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, ArrowRight, BookOpen, ChevronRight, Compass, Flame, Gem, House,
  Nut, Settings, Sparkles, X,
} from "lucide-react";
import {
  ITEMS, ITEMS_BY_ID, MERCHANTS, MERCHANT_IDS, ODDITY_TITLE, RARITIES, RARITY_IDS, REDEMPTIONS, RESOURCES, RESOURCE_IDS,
  type Item, type MerchantId, type Rarity, type ResourceId,
} from "./oddities/catalog";
import {
  merchantDialogue, odditiesStorageKey, quoteRates, QUOTE_TIER_NAMES, readOdditiesSave, transactOddities,
  type OdditiesSave,
} from "./oddities/engine";
import { OdditiesBackdrop, OdditiesMerchantArt, OdditiesArtifactArt } from "./oddities/OdditiesArt";
import OddityItemArt from "./oddities/OddityItemArt";
import OddityOpening from "./oddities/Opening";
import "./oddities/oddities.css";

const TABS = [
  { id: "courtyard", label: "寺庙庭院", icon: House },
  { id: "explore", label: "探索收集", icon: Compass },
  { id: "catalog", label: "奇物图鉴", icon: BookOpen },
  { id: "shop", label: "灵光兑换", icon: Sparkles },
] as const;
type Tab = typeof TABS[number]["id"];
type Sheet =
  | { kind: "quote"; merchant: MerchantId; dialogue: string }
  | { kind: "item" | "redeem"; itemId: string }
  | { kind: "settings" | "reset" | "reset-final" };
type Action = Parameters<typeof transactOddities>[1];
type Event = Awaited<ReturnType<typeof transactOddities>>["event"];
type Discovery = Extract<Event, { type: "explored" }>;
type ErrorReason = Extract<Event, { type: "error" }>["reason"];

const ERROR_TEXT: Record<ErrorReason, string> = {
  pending: "有一件奇物还等着收入收藏。",
  "stale-quote": "商人更新了报价，请看新报价。",
  insufficient: "资源不够了，先去探索吧。",
  "unknown-item": "这件奇物暂时找不到。",
  "no-extra": "只有多余的奇物才能回收。",
  "not-redeemable": "这件奇物暂时不能兑换。",
  "no-pending": "收藏已经收好了。",
};
const ART_BY_RESOURCE = { pinecone: Nut, incense: Flame, shard: Gem };

function ResourceIcon({ id, size = 18 }: { id: ResourceId; size?: number }) {
  const Art = ART_BY_RESOURCE[id];
  return <Art size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function SmoothCount({ value, from = value }: { value: number; from?: number }) {
  const [display, setDisplay] = useState(from);
  const shown = useRef(from);
  useEffect(() => {
    const initial = shown.current;
    if (initial === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.current = value;
      setDisplay(value);
      return;
    }
    const began = performance.now();
    let frame = 0;
    function tick(now: number) {
      const progress = Math.min(1, (now - began) / 290);
      const next = Math.round(initial + (value - initial) * (1 - (1 - progress) ** 3));
      if (next !== shown.current) {
        shown.current = next;
        setDisplay(next);
      }
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <strong aria-hidden="true">{display}</strong>;
}

function Ledger({ save }: { save: OdditiesSave }) {
  return <div className="odd-ledger" aria-label="当前资源">
    {RESOURCE_IDS.map(id => <div role="group" key={id} className="odd-balance" data-resource={id} aria-label={`${RESOURCES[id].name} ${save.resources[id]}`}>
      <span className="odd-balance-icon"><ResourceIcon id={id} /></span>
      <span className="odd-balance-text" aria-hidden="true"><span>{RESOURCES[id].name}</span><SmoothCount value={save.resources[id]} /></span>
    </div>)}
    <div role="group" className="odd-balance" data-resource="glow" aria-label={`奇物灵光 ${save.glow}`}>
      <span className="odd-balance-icon"><Sparkles size={18} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className="odd-balance-text" aria-hidden="true"><span>奇物灵光</span><SmoothCount value={save.glow} /></span>
    </div>
  </div>;
}

function CollectionTile({ item, unlocked, count, onSelect }: { item: Item; unlocked: boolean; count: number; onSelect: () => void }) {
  const children = <>
    <div className="odd-item-figure">
      <OddityItemArt item={item} locked={!unlocked} />
      {unlocked && <span className="odd-inventory-count">×{count}</span>}
    </div>
    <div className="odd-item-info">
      <span className="odd-rarity">{RARITIES[item.rarity].name}</span>
      <strong>{unlocked ? item.name : "尚未发现"}</strong>
    </div>
  </>;
  return unlocked
    ? <button className="odd-item-tile" type="button" data-rarity={item.rarity} onClick={onSelect}>{children}</button>
    : <div className="odd-item-tile is-locked" data-rarity={item.rarity}>{children}</div>;
}

function OfferSheet({ save, merchantId, dialogue, busy, onExchange, onCancel }: {
  save: OdditiesSave; merchantId: MerchantId; dialogue: string; busy: boolean; onExchange: (quoteId: string) => void; onCancel: () => void;
}) {
  const merchant = MERCHANTS[merchantId];
  const progress = save.merchants[merchantId];
  const quote = progress.quote;
  const resource = RESOURCES[merchant.resource];
  const held = save.resources[merchant.resource];
  const missing = Math.max(0, quote.cost - held);
  const pity = progress.commonStreak >= 3;
  const rates = quoteRates(quote.cost, pity);
  return <>
    <div className="odd-offer-story" data-merchant={merchantId}>
      <OdditiesMerchantArt merchant={merchantId} interacting />
      <p>{dialogue}</p>
    </div>
    <div className="odd-offer-price">
      <OdditiesArtifactArt merchant={merchantId} />
      <div className="odd-offer-cost"><span>{QUOTE_TIER_NAMES[quote.tier]}</span><strong><ResourceIcon id={merchant.resource} />{quote.cost} {resource.unit}{resource.name}</strong><small>持有 {held} {resource.unit}</small></div>
    </div>
    <div className="odd-rates">
      <div className="odd-rates-heading"><h3>本次获得概率</h3><span className={pity ? "odd-pity-active" : ""}>{pity ? "保底生效" : `普通累计 ${progress.commonStreak}/3`}</span></div>
      <dl>{RARITY_IDS.map(rarity => <div key={rarity} data-rarity={rarity}><dt>{RARITIES[rarity].name}</dt><dd>{rates[rarity]}%</dd></div>)}</dl>
      <p>{pity ? "这次至少换到稀有奇物。" : "连续三次普通后，下次至少换到稀有奇物。"}</p>
    </div>
    {missing > 0 && <p className="odd-warning" role="status">还缺 {missing} {resource.unit}{resource.name}</p>}
    <div className="odd-actions">
      <button className="odd-button" type="button" onClick={onCancel} disabled={busy}>暂不交换</button>
      <button className="odd-button odd-button-primary" type="button" disabled={busy || missing > 0} onClick={() => onExchange(quote.id)}>交换一次</button>
    </div>
  </>;
}

function DetailSheet({ item, count, busy, onRecycle }: { item: Item; count: number; busy: boolean; onRecycle: () => void }) {
  const tradeValue = RARITIES[item.rarity].recycleValue;
  return <>
    <div className="odd-detail-art" data-rarity={item.rarity}><OddityItemArt item={item} /></div>
    <div className="odd-detail-copy" data-rarity={item.rarity}>
      <p className="odd-detail-meta"><span className="odd-rarity">{RARITIES[item.rarity].name}</span>{MERCHANTS[item.merchant].name}<span>持有 {count} 件</span></p>
      <p>{item.description}</p>
    </div>
    <button className="odd-button odd-button-primary" type="button" disabled={busy || count < 2} onClick={onRecycle}>回收一件 · +{tradeValue} 灵光</button>
    <p className="odd-supplement">可回收多余的奇物，每种至少保留一件。</p>
  </>;
}

export default function TempleOddities({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const [save, setSave] = useState(() => readOdditiesSave(playerId));
  const [tab, setTab] = useState<Tab>("courtyard");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(Boolean(save.pending));
  const [justPaid, setJustPaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [merchantFilter, setMerchantFilter] = useState<MerchantId | "all">("all");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "all">("all");
  const [notice, setNotice] = useState("");
  const [dialogNotice, setDialogNotice] = useState("");
  const [sessionOnly, setSessionOnly] = useState(false);
  const pendingOperation = useRef(false);
  const lastDialogue = useRef<Partial<Record<MerchantId, string>>>({});
  const alive = useRef(true);
  const exploreTimer = useRef<number | undefined>(undefined);
  const dialog = useRef<HTMLElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const visibleReceipt = receiptOpen ? save.pending : null;
  const hasSheet = Boolean(sheet || visibleReceipt);
  const sheetKey = visibleReceipt?.id ?? sheet?.kind ?? "";

  useEffect(() => {
    alive.current = true;
    const earlier = document.activeElement;
    return () => {
      alive.current = false;
      window.clearTimeout(exploreTimer.current);
      if (earlier instanceof HTMLElement && earlier.isConnected) earlier.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (hasSheet) dialog.current?.focus({ preventScroll: true });
    else if (restoreFocus.current?.isConnected) restoreFocus.current.focus({ preventScroll: true });
    else shell.current?.querySelector<HTMLElement>(".oddities-return")?.focus({ preventScroll: true });
  }, [hasSheet, sheetKey]);

  useEffect(() => { scroll.current?.scrollTo(0, 0); }, [tab]);

  useEffect(() => {
    const storageKey = odditiesStorageKey(playerId);
    function syncSave(event: StorageEvent) {
      if (!pendingOperation.current && event.key === storageKey) setSave(readOdditiesSave(playerId));
    }
    window.addEventListener("storage", syncSave);
    return () => window.removeEventListener("storage", syncSave);
  }, [playerId]);

  function openSheet(next: Sheet) {
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setNotice("");
    setDialogNotice("");
    setSheet(next);
  }

  function openReceipt() {
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSheet(null);
    setDialogNotice("");
    setReceiptOpen(true);
  }

  function selectMerchant(merchant: MerchantId) {
    if (save.pending) {
      openReceipt();
      return;
    }
    const dialogue = merchantDialogue(merchant, save.merchants[merchant].exchanges, Math.random, lastDialogue.current[merchant]);
    lastDialogue.current[merchant] = dialogue;
    openSheet({ kind: "quote", merchant, dialogue });
  }

  function closeSheet() {
    if (pendingOperation.current) return;
    setDialogNotice("");
    if (visibleReceipt) {
      setReceiptOpen(false);
      setJustPaid(null);
    }
    else if (sheet?.kind === "reset-final") setSheet({ kind: "reset" });
    else if (sheet?.kind === "reset") setSheet({ kind: "settings" });
    else setSheet(null);
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (hasSheet) closeSheet();
      else if (!pendingOperation.current) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const boundary = hasSheet ? dialog.current : shell.current;
    const focusables = boundary?.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), a[href]");
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === boundary)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function run(action: Action) {
    if (pendingOperation.current) return null;
    pendingOperation.current = true;
    setBusy(true);
    setNotice("");
    setDialogNotice("");
    try {
      const { save: updated, event, persisted } = await transactOddities(playerId, action);
      if (!alive.current) return null;
      setSave(updated);
      setSessionOnly(!persisted);
      if (event.type === "error") {
        if (event.reason === "pending" && updated.pending) openReceipt();
        else {
          const message = ERROR_TEXT[event.reason];
          if (hasSheet) setDialogNotice(message);
          else setNotice(message);
        }
        return null;
      }
      return event;
    } catch {
      if (alive.current) {
        const message = "暂时无法保存这次操作，请检查浏览器存储后重试。";
        if (hasSheet) setDialogNotice(message);
        else setNotice(message);
      }
      return null;
    } finally {
      pendingOperation.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function explore() {
    if (pendingOperation.current || exploring) return;
    setExploring(true);
    const event = await run({ type: "explore" });
    if (!alive.current) return;
    if (event?.type !== "explored") {
      setExploring(false);
      return;
    }
    exploreTimer.current = window.setTimeout(() => {
      setDiscovery(event);
      setExploring(false);
    }, 470);
  }

  async function exchange(merchant: MerchantId, quoteId: string) {
    const event = await run({ type: "exchange", merchant, quoteId });
    if (event?.type === "exchanged") {
      setSheet(null);
      setJustPaid(event.receipt.id);
      setReceiptOpen(true);
    }
  }

  async function collect() {
    if (!visibleReceipt) return;
    const event = await run({ type: "collect", receiptId: visibleReceipt.id });
    if (event?.type === "collected") {
      setReceiptOpen(false);
      setJustPaid(null);
      setNotice("奇物已收入收藏。");
    }
  }

  async function recycle(itemId: string) {
    const event = await run({ type: "recycle", itemId });
    if (event?.type === "recycled") setDialogNotice(`回收完成，获得 ${event.glow} 点奇物灵光。`);
  }

  async function redeem(item: Item) {
    const event = await run({ type: "redeem", itemId: item.id });
    if (event?.type === "redeemed") {
      setSheet(null);
      setNotice(`${event.isNew ? "图鉴新增 · " : ""}${item.name}已收入收藏。${event.completedCollection ? `集齐了${MERCHANTS[item.merchant].name}的收藏！` : ""}`);
    }
  }

  async function reset() {
    const event = await run({ type: "reset" });
    if (event?.type === "reset") {
      window.clearTimeout(exploreTimer.current);
      setDiscovery(null);
      setExploring(false);
      setReceiptOpen(false);
      setJustPaid(null);
      setSheet(null);
      setTab("courtyard");
      setMerchantFilter("all");
      setRarityFilter("all");
      lastDialogue.current = {};
      setNotice("已重新开始。");
    }
  }

  const cards = ITEMS.filter(item => (merchantFilter === "all" || item.merchant === merchantFilter) && (rarityFilter === "all" || item.rarity === rarityFilter));
  const unlocked = new Set(save.unlocked);
  const selectedItem = sheet && "itemId" in sheet ? ITEMS_BY_ID[sheet.itemId] : undefined;
  const openingResource = visibleReceipt ? MERCHANTS[visibleReceipt.merchant].resource : null;
  let title = "";
  let sheetBody: ReactNode;
  if (visibleReceipt) {
    title = "开启奇物";
    sheetBody = <OddityOpening key={visibleReceipt.id} merchantId={visibleReceipt.merchant} receipt={visibleReceipt} onCollect={collect} />;
  } else if (sheet?.kind === "quote") {
    const { merchant, dialogue } = sheet;
    title = MERCHANTS[merchant].name;
    sheetBody = <OfferSheet save={save} merchantId={merchant} dialogue={dialogue} busy={busy} onCancel={closeSheet} onExchange={quoteId => void exchange(merchant, quoteId)} />;
  } else if (sheet?.kind === "item" && selectedItem) {
    title = selectedItem.name;
    sheetBody = <DetailSheet item={selectedItem} count={save.inventory[selectedItem.id] ?? 0} busy={busy} onRecycle={() => void recycle(selectedItem.id)} />;
  } else if (sheet?.kind === "redeem" && selectedItem) {
    const price = REDEMPTIONS.find(offer => offer.itemId === selectedItem.id)?.price ?? 0;
    title = selectedItem.name;
    sheetBody = <>
      <div className="odd-detail-art" data-rarity={selectedItem.rarity}><OddityItemArt item={selectedItem} /></div>
      <p>用 {price} 点奇物灵光兑换，当前持有 {save.glow} 点。</p>
      {price > save.glow && <p className="odd-warning">还缺 {price - save.glow} 点奇物灵光。</p>}
      <div className="odd-actions">
        <button type="button" className="odd-button" onClick={closeSheet} disabled={busy}>暂不兑换</button>
        <button type="button" className="odd-button odd-button-primary" disabled={busy || price > save.glow} onClick={() => void redeem(selectedItem)}>确认兑换</button>
      </div>
    </>;
  } else if (sheet?.kind === "settings") {
    title = "存档设置";
    sheetBody = <>
      <p>资源、交换记录和图鉴会自动保存在这个浏览器。</p>
      <button type="button" className="odd-button odd-button-danger" onClick={() => setSheet({ kind: "reset" })}>重新开始游戏</button>
    </>;
  } else if (sheet?.kind === "reset" || sheet?.kind === "reset-final") {
    const final = sheet.kind === "reset-final";
    title = final ? "确认清空存档？" : "重新开始游戏？";
    sheetBody = <>
      <p>{final ? "清空后无法恢复。确认要从头开始吗？" : "这会清空这台设备上的奇物、图鉴和资源记录。"}</p>
      <div className="odd-actions">
        <button type="button" className="odd-button" onClick={() => setSheet(null)} disabled={busy}>保留存档</button>
        <button type="button" className="odd-button odd-button-danger" disabled={busy} onClick={final ? () => void reset() : () => setSheet({ kind: "reset-final" })}>{final ? "确认清空" : "继续"}</button>
      </div>
    </>;
  }

  return createPortal(<div className="oddities-overlay" role={!hasSheet ? "dialog" : undefined} aria-modal={!hasSheet || undefined} aria-labelledby={!hasSheet ? "oddities-title" : undefined} onKeyDown={handleKeys}>
    <div className="oddities-shell" ref={shell} inert={hasSheet}>
      <header className="oddities-header">
        <div className="odd-masthead">
          <button type="button" className="oddities-return odd-icon-button" onClick={onClose} disabled={busy} aria-label="返回云间寺"><ArrowLeft size={21} aria-hidden="true" /><span>云间寺</span></button>
          <h1 id="oddities-title">{ODDITY_TITLE}</h1>
          <button type="button" className="odd-icon-button odd-settings-button" aria-label="存档设置" onClick={() => openSheet({ kind: "settings" })} disabled={busy}><Settings size={20} aria-hidden="true" /></button>
        </div>
        <Ledger save={save} />
        {sessionOnly && <p className="odd-storage-note" role="status">浏览器存储受限，本次进度暂存在当前页面。</p>}
      </header>

      <div className="odd-view" data-tab={tab} ref={scroll}>
        {notice && <p className="odd-notice" role="status">{notice}</p>}
        {save.pending && !receiptOpen && <button className="odd-pending" type="button" onClick={openReceipt}><Sparkles size={17} aria-hidden="true" />查看待领取的奇物<ChevronRight size={17} aria-hidden="true" /></button>}

        {tab === "courtyard" && <section className="odd-courtyard" aria-label="寺庙庭院">
          <OdditiesBackdrop />
          <div className="odd-courtyard-intro"><h2>全寺的小动物都是商人！</h2><p>点一只小动物，听听它的报价。</p></div>
          {MERCHANT_IDS.map(merchant => <button type="button" key={merchant} className={`odd-merchant odd-merchant-${merchant}`} onClick={() => selectMerchant(merchant)} disabled={busy}>
            <OdditiesMerchantArt merchant={merchant} />
            <span className="odd-merchant-sign"><span>{MERCHANTS[merchant].name}</span><ChevronRight size={13} aria-hidden="true" /></span>
          </button>)}
        </section>}

        {tab === "explore" && <section className="odd-view-content odd-explore" aria-labelledby="odd-explore-title">
          <div className="odd-explore-map" data-searching={exploring}>
            <OdditiesBackdrop />
            <div className="odd-explore-sweep" aria-hidden="true">
              {RESOURCE_IDS.map(id => <span key={id} data-resource={id}><ResourceIcon id={id} size={25} /></span>)}
            </div>
          </div>
          <div className="odd-explore-content">
            <h2 id="odd-explore-title">探索收集</h2>
            <p>沿古树、香炉和石阶走走，找找商人喜欢的东西。</p>
            <div className="odd-explore-result" role="status">
              {exploring ? "正在寻找…" : discovery ? <><span className="odd-discovery-icon" data-resource={discovery.resource}><ResourceIcon id={discovery.resource} size={20} /></span><span>{discovery.text}</span></> : "每次探索都会带回一份新发现。"}
            </div>
            <button type="button" className="odd-button odd-button-primary" disabled={busy || exploring} onClick={() => void explore()}><Compass size={19} aria-hidden="true" />{exploring ? "探索中…" : "探索寺庙"}</button>
          </div>
        </section>}

        {tab === "catalog" && <section className="odd-view-content" aria-labelledby="odd-catalog-title">
          <header className="odd-section-heading">
            <h2 id="odd-catalog-title">奇物收藏册</h2>
            <p>已收集 <strong>{unlocked.size}/{ITEMS.length}</strong></p>
          </header>
          <progress className="odd-progress" value={unlocked.size} max={ITEMS.length} aria-label="奇物图鉴收集进度" />
          {MERCHANT_IDS.filter(id => save.achievements.includes(`merchant:${id}`)).map(id => <p className="odd-achievement" key={id}><Sparkles size={15} aria-hidden="true" />已集齐{MERCHANTS[id].name}的收藏</p>)}
          <div className="odd-filters">
            <label>动物
              <select value={merchantFilter} onChange={event => setMerchantFilter(event.currentTarget.value as MerchantId | "all")}>
                <option value="all">全部动物</option>{MERCHANT_IDS.map(id => <option key={id} value={id}>{MERCHANTS[id].name}</option>)}
              </select>
            </label>
            <label>稀有度
              <select value={rarityFilter} onChange={event => setRarityFilter(event.currentTarget.value as Rarity | "all")}>
                <option value="all">全部稀有度</option>{RARITY_IDS.map(id => <option key={id} value={id}>{RARITIES[id].name}</option>)}
              </select>
            </label>
          </div>
          <div className="odd-catalog-grid">
            {cards.map(item => <CollectionTile key={item.id} item={item} unlocked={unlocked.has(item.id)} count={save.inventory[item.id] ?? 0} onSelect={() => openSheet({ kind: "item", itemId: item.id })} />)}
          </div>
        </section>}

        {tab === "shop" && <section className="odd-view-content" aria-labelledby="odd-shop-title">
          <header className="odd-section-heading"><h2 id="odd-shop-title">灵光兑换</h2><p><Sparkles size={16} aria-hidden="true" /> {save.glow} 点</p></header>
          <p className="odd-shop-guide">在图鉴里回收多余的奇物，就能用灵光兑换指定收藏。</p>
          <div className="odd-shop-grid">
            {REDEMPTIONS.map(({ itemId, price }) => {
              const item = ITEMS_BY_ID[itemId];
              if (!item) return null;
              return <article key={itemId} className="odd-shop-card" data-rarity={item.rarity}>
                <div className="odd-shop-art"><OddityItemArt item={item} /></div>
                <div><span className="odd-rarity">{RARITIES[item.rarity].name}</span><h3>{item.name}</h3><p>{price} 点奇物灵光{unlocked.has(item.id) ? " · 已收录" : ""}</p></div>
                <button type="button" className="odd-button" onClick={() => openSheet({ kind: "redeem", itemId })} aria-label={`兑换${item.name}`} disabled={busy}>兑换<ArrowRight size={16} aria-hidden="true" /></button>
              </article>;
            })}
          </div>
        </section>}
      </div>

      <nav className="oddities-nav" aria-label="奇物交换功能">
        {TABS.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setNotice(""); setTab(id); }}>
          <Icon size={21} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
        </button>)}
      </nav>
    </div>

    {hasSheet && <div className="odd-sheet-shade" onPointerDown={event => { if (event.target === event.currentTarget) closeSheet(); }}>
      <section ref={dialog} tabIndex={-1} className="odd-sheet" data-sheet={visibleReceipt ? "opening" : sheet?.kind} role="dialog" aria-modal="true" aria-labelledby="odd-sheet-title">
        <header className="odd-sheet-header">
          <h2 id="odd-sheet-title">{title}</h2>
          {visibleReceipt && openingResource && <span className="odd-opening-balance" role="group" aria-label={`${RESOURCES[openingResource].name}余额 ${save.resources[openingResource]}`}>
            <ResourceIcon id={openingResource} size={16} /><span aria-hidden="true">{RESOURCES[openingResource].name}</span>
            <SmoothCount key={visibleReceipt.id} value={save.resources[openingResource]} from={save.resources[openingResource] + (justPaid === visibleReceipt.id ? visibleReceipt.cost : 0)} />
          </span>}
          <button type="button" className="odd-icon-button" aria-label={visibleReceipt ? "稍后领取" : "关闭弹窗"} disabled={busy} onClick={closeSheet}><X size={21} aria-hidden="true" /></button>
        </header>
        {sheetBody}
        {dialogNotice && <p className="odd-dialog-notice" role="status">{dialogNotice}</p>}
      </section>
    </div>}
  </div>, document.body);
}
