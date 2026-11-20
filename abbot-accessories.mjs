/** Shared reward catalog for earned titles, the wardrobe, and character models. */
export const ABBOT_ACCESSORY_SLOTS = Object.freeze(["chest", "leftWaist", "rightWaist"]);
export const ABBOT_ACCESSORY_SLOT_LABELS = Object.freeze({ chest: "胸前", leftWaist: "左腰", rightWaist: "右腰" });

export const ABBOT_ACCESSORIES = Object.freeze([
  { id: "heart-lotus", title: "照心行者", name: "照心莲佩", description: "白玉莲心嵌入金色花瓣，细结垂下温柔流苏。", placement: "chest", slot: "chest", color: "#b8cbb4" },
  { id: "pine-jade", title: "听松行者", name: "松影玉佩", description: "深翠玉牌刻着一枝老松，古金镶边映出山林绿意。", placement: "waist", slot: "leftWaist", color: "#527d68" },
  { id: "bamboo-sachet", title: "竹露守心人", name: "竹露香囊", description: "青绿锦囊绣着竹叶，双层编结系住细细金穗。", placement: "waist", slot: "rightWaist", color: "#819a6b" },
  { id: "ripple-fish", title: "澄波知愿客", name: "澄波双鱼佩", description: "两尾青白玉鱼环绕水纹，银金细边映着一滴蓝玉。", placement: "waist", slot: "leftWaist", color: "#7fa9ae" },
  { id: "echo-bell", title: "闻钟归心者", name: "梵音金铃", description: "小小铜铃悬着莲瓣裙边，红绳和金穗随步轻摆。", placement: "waist", slot: "rightWaist", color: "#ba9458" },
  { id: "lotus-brooch", title: "莲心护愿人", name: "瑞莲胸针", description: "粉白莲瓣层层舒展，中央镶着一颗温润玉珠。", placement: "chest", slot: "chest", color: "#d4a5a1" },
  { id: "sutra-scroll", title: "经香拾光客", name: "经香卷轴佩", description: "象牙色小卷轴配深木卷端，缀着青玉和朱色绳结。", placement: "waist", slot: "leftWaist", color: "#d6bd8f" },
  { id: "cloud-ruyi", title: "云岚同行者", name: "云岚如意坠", description: "青蓝如意云头描着金线，细小云珠和流苏相伴。", placement: "chest", slot: "chest", color: "#90b4bb" },
  { id: "home-lantern", title: "归心传灯人", name: "归心灯坠", description: "玲珑灯笼收着一团暖光，金色花窗与朱红流苏相映。", placement: "waist", slot: "rightWaist", color: "#c38c63" },
]);

export const getAbbotAccessory = id => ABBOT_ACCESSORIES.find(item => item.id === id);
export const getAccessoryForTitle = title => ABBOT_ACCESSORIES.find(item => item.title === title);

/** Keep only catalog items assigned to their matching body slots. */
export function normalizeAbbotOutfit(value) {
  const outfit = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return outfit;
  for (const slot of ABBOT_ACCESSORY_SLOTS) {
    const item = getAbbotAccessory(value[slot]);
    if (item?.slot === slot) outfit[slot] = item.id;
  }
  return outfit;
}
