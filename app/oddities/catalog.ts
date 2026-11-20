export const ODDITY_TITLE = "寺内奇物交换";
export const MERCHANT_IDS = ["squirrel", "koi", "tit"] as const;
export const RESOURCE_IDS = ["pinecone", "incense", "shard"] as const;
export const RARITY_IDS = ["common", "rare", "precious", "legendary"] as const;

export type MerchantId = typeof MERCHANT_IDS[number];
export type ResourceId = typeof RESOURCE_IDS[number];
export type Rarity = typeof RARITY_IDS[number];
export type Milestone = 5 | 15 | 30;

export const RESOURCES = {
  pinecone: { id: "pinecone", name: "松果", unit: "个" },
  incense: { id: "incense", name: "香火", unit: "份" },
  shard: { id: "shard", name: "碎片", unit: "枚" },
} as const satisfies Record<ResourceId, { id: ResourceId; name: string; unit: string }>;

export const RARITIES = {
  common: { id: "common", name: "普通", color: "#5e645c", recycleValue: 1 },
  rare: { id: "rare", name: "稀有", color: "#2e6083", recycleValue: 3 },
  precious: { id: "precious", name: "珍贵", color: "#745080", recycleValue: 7 },
  legendary: { id: "legendary", name: "传说", color: "#805315", recycleValue: 16 },
} as const satisfies Record<Rarity, { id: Rarity; name: string; color: string; recycleValue: number }>;

type Merchant = {
  id: MerchantId;
  name: string;
  resource: ResourceId;
  place: string;
  intro: string;
  dialogues: readonly string[];
  legendaryLine: string;
  milestoneLines: Record<Milestone, string>;
};

export const MERCHANTS: Record<MerchantId, Merchant> = {
  squirrel: {
    id: "squirrel", name: "松鼠商人", resource: "pinecone", place: "庭院古松旁",
    intro: "守着小木箱的铁算盘，最爱刚从松树上掉下来的松果。",
    dialogues: [
      "嘿嘿，我的宝贝可不是随便给人的！",
      "就这几个松果？好吧，让你试试运气！",
      "木箱左边是宝贝，右边也是宝贝。那中间呢？你猜。",
      "闻到松果香了吗？交易这件事，我鼻子最灵。",
    ],
    legendaryLine: "等等！那是我藏在箱底三年，舍不得拿出来的宝贝！",
    milestoneLines: {
      5: "第五次啦。你现在可以把松果放在箱盖上，我认得你的脚步声。",
      15: "告诉你个秘密，我每天管那只漏水的旧木箱叫百宝阁。",
      30: "这箱旧物是前任守松人交给我的。以后你来，我腾半个树洞给你。",
    },
  },
  koi: {
    id: "koi", name: "锦鲤商人", resource: "incense", place: "荷花池心",
    intro: "喜欢温暖香气的金红锦鲤，常把池底拾来的石头带到水面。",
    dialogues: [
      "池水深处，藏着你想象不到的秘密。",
      "今日水波清澈，也许有好东西出现。",
      "等涟漪到池边再眨眼，看看这次带上来了什么。",
      "水面映出的是月亮。水下的光，是我攒的。",
    ],
    legendaryLine: "水底的月亮今夜浮上来了。我知道，它是在等你。",
    milestoneLines: {
      5: "你来了五回。池水已经认得你袖间的香气。",
      15: "莲叶下有条只在满月出现的小路。若听见水响，就在岸边等我。",
      30: "三十回水波还未散尽，池里的小鱼也学会了辨认你的脚步。",
    },
  },
  tit: {
    id: "tit", name: "山雀商人", resource: "shard", place: "花园木檐",
    intro: "住在檐角的圆脸山雀，说起它收藏的花瓣总会多啾两声。",
    dialogues: [
      "啾啾！快看我今天找到了什么！",
      "漂亮的花瓣，当然要和有趣的人交换！",
      "先听我说，这片花瓣是我飞过三扇窗才接到的！",
      "会发亮的碎片放这里。别松手太早，让我再看一眼！",
    ],
    legendaryLine: "啾——连山风都停住啦！这朵灵花只开给会捡碎光的人。",
    milestoneLines: {
      5: "你来了五回，我给你留了一个靠窗的树杈！",
      15: "我偷偷学会了住持早课的调子。啾，你听得出来吗？",
      30: "三十回啦！我写了首歌，开头是啾啾，结尾还是啾啾。",
    },
  },
};

export type Item = {
  id: string;
  name: string;
  description: string;
  merchant: MerchantId;
  rarity: Rarity;
  art: string;
  color: string;
  accent: string;
};

export type OddityItem = Item;

type ItemEntry = [art: string, rarity: Rarity, name: string, description: string, color: string, accent: string];

const squirrelItems: readonly ItemEntry[] = [
  ["leaf", "common", "被风吹来的落叶", "松鼠坚持说它值钱，因为这是秋天第一片飞进木箱的叶子。", "#ae6943", "#e2a366"],
  ["seed", "common", "旧袍里的栗壳", "从一件晾了许多年的旧袍中掉下来，留着淡淡的松烟味。", "#855736", "#d19b65"],
  ["bead", "common", "温手槐木珠", "被无数双手摩挲得发亮，穿绳的小孔早已磨成椭圆。", "#aa7961", "#edc0a1"],
  ["comb", "rare", "半柄桃木梳", "檐下老翁遗落的断梳，漂亮的桃花刻纹还鲜亮如新。", "#ab5b4c", "#efbd8c"],
  ["carving", "rare", "巴掌大的卧鹿", "旧雕工用一截松枝刻成，连耳朵尖上的缺口都特意留着。", "#a57249", "#e8bd89"],
  ["bell", "rare", "松鼠珍藏的旧铜铃", "贴近耳边摇一下，细响就像隔着墙听见一场小雨。", "#ac7c3d", "#f4ce74"],
  ["pendant", "precious", "青绳古玉挂饰", "玉面雕了一道流云，传说摸到云尾能听见很远的风。", "#579c83", "#bfe3ae"],
  ["amber", "precious", "百年古树的琥珀", "琥珀里留着一根未燃尽的松针，看久了像看见黄昏山道。", "#be6d30", "#ffd381"],
  ["seal", "precious", "石门朱砂印", "印底刻着一个古旧的「静」字，背面留有不知何人的指纹。", "#b65149", "#e4a083"],
  ["censer", "precious", "回纹袖珍香炉", "半枚松果就能盖住的小香炉，三只脚却都雕出了卷云。", "#847a49", "#d3c489"],
  ["talisman", "legendary", "千年松心符", "住持说符中封着古松的第一道年轮，耳贴上去能听见山雨。", "#a6562e", "#ffd779"],
  ["diadem", "legendary", "衔月小金冠", "据说是鸟雀给月亮做的冠冕，只有松鼠能戴得正。", "#ad7736", "#ffdf8e"],
];

const koiItems: readonly ItemEntry[] = [
  ["pebble", "common", "被水磨圆的石子", "锦鲤一路推着它游到浅水，温润得让人想带回枕边。", "#899387", "#c7d1bb"],
  ["glass", "common", "青瓷碎晶", "原是一只沉进水底的茶盏，断边被软水打磨了几十年。", "#69a298", "#b8d7bb"],
  ["pearl", "common", "露心蚌珠", "只有一粒草籽那么大，沾湿时却能照见完整的天空。", "#a9c1bf", "#fff3d9"],
  ["crystal", "rare", "檐滴水晶", "六面都照得见水纹，它像一滴落在空中就忘记下落的雨。", "#578fb1", "#b8e9ea"],
  ["agate", "rare", "水云红玛瑙", "一圈圈暖红纹理，绕着一颗像朱砂鱼眼的深色斑点。", "#bc664d", "#f2aa87"],
  ["amethyst", "rare", "枕莲紫晶", "晶尖细小却明亮，锦鲤说它只在荷叶翻身时闪一下。", "#88649e", "#d6a8ed"],
  ["opal", "precious", "折虹蛋白石", "转一转，乳白深处便有春绿和晚霞交替浮过。", "#859d92", "#edbba8"],
  ["jade", "precious", "双鲤青玉", "谷雨前出水的青玉，纹心正好围成两条追尾的鱼。", "#499882", "#b7d4a1"],
  ["fluorite", "precious", "叠雾萤石", "青紫相间的石层，看上去像入夜前重叠的几座山。", "#568e93", "#b799d8"],
  ["moonstone", "precious", "锦鲤吐出的月华宝石", "天色越暗，越能看见石心泛起的一线蓝光。", "#668cac", "#def2f1"],
  ["prism", "legendary", "七彩琉璃棱", "锦鲤说，晨光一照，就能把同一池水分成七种颜色。", "#618ca4", "#ffd179"],
  ["lotusGem", "legendary", "莲心藏星", "清澈得像从来没沉过泥的莲瓣，中央漂着一束小星光。", "#a2639e", "#ffddb5"],
];

const titItems: readonly ItemEntry[] = [
  ["petal", "common", "檐风捎来的花瓣", "山雀从两根椽之间衔来的小花瓣，尖端还卷着。", "#d78e87", "#f8bcb1"],
  ["bud", "common", "不肯开的麦芽苞", "干花苞抱得很紧，山雀每天都要提醒它该起床了。", "#c48e66", "#f3c382"],
  ["blossom", "common", "梨花书签", "小和尚拿经书压过的一瓣梨花，还留着一点墨香。", "#d1bca8", "#fff3dc"],
  ["sprig", "rare", "露洗薄荷枝", "刚好够藏进袖口的两片嫩叶，碰一下就有清香。", "#659b75", "#b9d691"],
  ["feather", "rare", "多话的彩尾羽", "最细的羽脉带一点蓝，风吹过去会沙沙地响。", "#7d8db6", "#e5ab9d"],
  ["rose", "rare", "晚霞五色蔷薇", "内瓣红、外瓣粉，难得同一朵花上能看见两种晚霞。", "#c2667c", "#f5b09b"],
  ["camellia", "precious", "朱砂重瓣山茶", "重瓣叠过四层，山雀只能用两脚抱着它跳。", "#b75761", "#efab91"],
  ["orchid", "precious", "夜萤小兰", "花边在暮色中微微发亮。山雀说这朵花还没学会熄灯。", "#8473b2", "#b8e2b7"],
  ["maple", "precious", "四季回纹花瓣", "一片花瓣上有春青夏红、秋金冬灰四道回纹。", "#bd7659", "#e7c879"],
  ["goldPetal", "precious", "山雀叼来的金纹花瓣", "金线细得看不见起笔，细看是山雀飞过的每一道弯。", "#c49342", "#f8d58a"],
  ["flowerMoon", "legendary", "望月银瓣", "只在月亮升到瓦脊时展开，闭合前会落下一点银粉。", "#8d9dbb", "#fff1c4"],
  ["spiritFlower", "legendary", "三更灯下灵花", "寺灯齐熄后的那一刹那开花，花芯里藏着三粒暖光。", "#bb647a", "#ffe39c"],
];

const itemEntries: Record<MerchantId, readonly ItemEntry[]> = { squirrel: squirrelItems, koi: koiItems, tit: titItems };

export const ITEMS: Item[] = MERCHANT_IDS.flatMap(merchant =>
  itemEntries[merchant].map(([art, rarity, name, description, color, accent]) => ({
    id: `${merchant}-${art}`, name, description, merchant, rarity, art, color, accent,
  })),
);

const itemIndex: Record<string, Item> = Object.create(null);
for (const item of ITEMS) itemIndex[item.id] = item;
export const ITEMS_BY_ID: Readonly<Record<string, Item | undefined>> = itemIndex;

export const REDEMPTIONS: readonly { itemId: string; price: number }[] = [
  { itemId: "squirrel-bell", price: 6 },
  { itemId: "squirrel-pendant", price: 14 },
  { itemId: "koi-agate", price: 6 },
  { itemId: "koi-moonstone", price: 14 },
  { itemId: "tit-rose", price: 6 },
  { itemId: "tit-goldPetal", price: 14 },
];
