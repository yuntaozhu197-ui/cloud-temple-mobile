export type ShrineId = "rulai" | "guanyin" | "wenshu";

export const SHRINES = {
  rulai: {
    name: "如来", hall: "大雄宝殿", intention: "平安 · 安定 · 感恩",
    description: "愿身心安定，愿所爱之人平安。", x: 0, z: -13.8, furnaceZ: -14.8,
  },
  guanyin: {
    name: "观音菩萨", hall: "观音殿", intention: "慈悲 · 健康 · 家人",
    description: "愿家人康宁，愿心中多一份慈悲。", x: -15, z: 31, furnaceZ: 30,
  },
  wenshu: {
    name: "文殊菩萨", hall: "文殊殿", intention: "学业 · 高考 · 智慧",
    description: "愿学子专注笃行，愿每一份努力有所收获。", x: 15, z: 31, furnaceZ: 30,
  },
} satisfies Record<ShrineId, { name: string; hall: string; intention: string; description: string; x: number; z: number; furnaceZ: number }>;
