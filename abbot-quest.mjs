const CYCLE_MS = 12 * 60_000;
const VISIBLE_MS = 8 * 60_000;

export const ABBOT_LOCATIONS = [
  { name: "庭院老松旁", x: -11, z: 17 },
  { name: "大殿西廊", x: -15, z: -9 },
  { name: "藏经阁前", x: 14, z: -24 },
  { name: "放生池东岸", x: -19, z: 19 },
  { name: "习武广场边", x: 27, z: 18 },
];
const objectives = [
  { kind: "prayer", label: "合掌静心", description: "在蒲团上完整做一次合掌，让纷乱的念头落定。" },
  { kind: "flower", label: "供一枝鲜花", description: "在大殿前完成一次免费供花，将温柔留在山里。" },
  { kind: "beads", label: "转珠听心", description: "在蒲团上完整转一次佛珠，慢慢听见自己的呼吸。" },
  { kind: "wood", label: "木鱼一声", description: "亲手敲响一次木鱼，将专注落在这一声里。" },
  { kind: "incense", label: "清香寄愿", description: "在任意殿堂完成一次上香仪式，安放一份心愿。" },
  { kind: "fish", label: "池畔施食", description: "在莲池或放生池完成一次喂鱼，让小生灵安心靠近。" },
  { kind: "bell", label: "听钟观心", description: "亲手敲响一次钟亭或钟楼的钟，听它的余韵远去。" },
  { kind: "sutra", label: "藏经寻句", description: "到藏经阁完成一次读经动作，留意眼前的一句经文。" },
  { kind: "martial", label: "习武舒身", description: "在习武广场完整练一套拳，让身体与心一同舒展。" },
  { kind: "skyLantern", label: "放灯寄远", description: "在许愿台完成一次孔明灯放飞，将祝愿交给晚风。" },
];
const stories = [
  { title: "松影里的旧灯", intro: "“老松年年换新叶，我也年年在这里等一段新的因缘。小师父，陪我寻回灯里的那点光吧。”", teaching: "“光常藏在平常事里。把眼前的两三件小事认真做完，便知道它在哪里。”", completion: "“你看，灯里已经有了松影。原来你一路留下的专注，都照在这里。”", reward: { title: "听松行者", lanternName: "松影莲灯" } },
  { title: "竹露未干时", intro: "“清早的竹叶上挂着一滴露水，它问我，怎样才能记住这座山的温柔。”", teaching: "“不必留住露水。用自己的双手，为山里的这一刻做些什么吧。”", completion: "“露水会散，善意留下了。让这盏竹露灯，替你记住今天。”", reward: { title: "竹露守心人", lanternName: "竹露莲灯" } },
  { title: "一池春水的回信", intro: "“池水送来一封没有字的信。它说，有人把烦恼带来，又把宁静留在了岸边。”", teaching: "“你也去走走。等心里的涟漪慢下来，再回来告诉我，信里写了什么。”", completion: "“你没有开口，澄澈的眼神已经是回信。愿这点水光陪你走远。”", reward: { title: "澄波知愿客", lanternName: "澄波莲灯" } },
  { title: "钟声走过长廊", intro: "“方才有一声钟走过长廊，找不到愿意停下来听它的人。小师父，你可愿陪它一程？”", teaching: "“先把脚步放慢。山里的每件小事，都有它自己的回声。”", completion: "“回声到了心里，便有了归处。这盏灯中的暖光，是它留给你的谢礼。”", reward: { title: "闻钟归心者", lanternName: "梵音莲灯" } },
  { title: "莲花的第二片叶", intro: "“这朵莲花只开了一片叶，另一片，说是要等一个肯认真待人的小师父。”", teaching: "“去完成眼前的小愿吧。花开不问快慢，只看你是否真心来过。”", completion: "“第二片叶已经舒展了。原来温柔也能让一朵花，记住一个人。”", reward: { title: "莲心护愿人", lanternName: "瑞莲心灯" } },
  { title: "经页间的山路", intro: "“翻开旧经书，里面落出一片小小的山影。它说，真正的山路还在脚下。”", teaching: "“读过的道理，要交给双手和脚步。去把这一页，轻轻写在今天里。”", completion: "“你回来时，空白的经页有了颜色。这盏灯，便送给认真走过山路的你。”", reward: { title: "经香拾光客", lanternName: "经香莲灯" } },
  { title: "云停在门前", intro: "“一朵云在寺门前停了许久，想讨一段山里的故事。我想，你或许可以替它写一段。”", teaching: "“故事不必惊天动地。把这两三件小事做好，便有了云愿意听的温柔。”", completion: "“云听完故事，已经散成了晴光。它托我把这盏灯，交到你手里。”", reward: { title: "云岚同行者", lanternName: "云岚莲灯" } },
  { title: "归山人的一束光", intro: "“有人离寺时，把一束光忘在了石阶上。它说，若有人愿意继续传递善意，就送给那个人。”", teaching: "“去看看池水、殿堂与庭院。让这束光，先在你的行动里走一程。”", completion: "“这束光已经认得你了。带着它回到生活里，也替山里的我们照亮一小段路。”", reward: { title: "归心传灯人", lanternName: "归心莲灯" } },
];
const legacyStory = { title: "一盏照心灯", intro: "老和尚停下木杖，银眉下藏着笑意。“小师父，山路上的风，可曾把你的心吹乱了？”", teaching: "“先合掌，让纷乱的念头落定。再供一枝花，将温柔留在这座山上。”", completion: "“你已为这座山留下一点光。往后的路，就让它陪你慢慢走。”", reward: { title: "照心行者", lanternName: "云隐莲灯" } };
const combinations = count => {
  const result = [];
  const add = (from, selected) => {
    if (selected.length === count) { result.push(selected); return; }
    for (let index = from; index < objectives.length; index++) add(index + 1, [...selected, index]);
  };
  add(0, []);
  return result;
};
const objectiveSets = { 2: combinations(2), 3: combinations(3) };
function hashCycle(cycle) {
  let hash = Math.imul(cycle ^ 0x6d2b79f5, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return hash >>> 0;
}

export function getAbbotEncounter(timestamp = Date.now()) {
  const cycle = Math.floor(timestamp / CYCLE_MS);
  const appearsAt = cycle * CYCLE_MS;
  return {
    id: `abbot-${cycle}`, active: timestamp >= appearsAt && timestamp < appearsAt + VISIBLE_MS,
    location: ABBOT_LOCATIONS[hashCycle(cycle) % ABBOT_LOCATIONS.length],
    appearsAt, leavesAt: appearsAt + VISIBLE_MS, nextAppearsAt: appearsAt + CYCLE_MS,
  };
}

export function getAbbotQuest(questId) {
  if (questId === "legacy") return { id: questId, ...legacyStory, objectives: objectives.slice(0, 2).map(item => ({ ...item, id: `legacy-${item.kind}` })), ceremony: 0 };
  const match = /^abbot-(\d{1,12})$/.exec(questId);
  if (!match) return null;
  const cycle = Number(match[1]);
  const hash = hashCycle(cycle);
  const count = 2 + (hash % 2);
  const sets = objectiveSets[count];
  const indices = [...sets[(cycle * 37 + 131) % sets.length]];
  if (hash & 2) indices.reverse();
  return { id: questId, ...stories[cycle % stories.length], objectives: indices.map(index => ({ ...objectives[index], id: `${questId}-${objectives[index].kind}` })), ceremony: cycle % 4 };
}

const emptyLegacy = () => ({ acceptedAt: null, prayerAt: null, flowerAt: null, rewardedAt: null });
const invalid = (message, status = 400) => ({ error: "invalid_abbot_action", status, message });
const validTime = (value, timestamp) => value === null || (Number.isSafeInteger(value) && value >= 0 && value <= timestamp);
function validLegacy(archive, timestamp) {
  if (!archive || typeof archive !== "object" || Array.isArray(archive)) return false;
  const values = [archive.acceptedAt, archive.prayerAt, archive.flowerAt, archive.rewardedAt];
  if (!values.every(value => validTime(value, timestamp))) return false;
  if (archive.acceptedAt === null) return values.every(value => value === null);
  if (archive.prayerAt !== null && archive.prayerAt < archive.acceptedAt) return false;
  if (archive.flowerAt !== null && archive.flowerAt < archive.acceptedAt) return false;
  return archive.rewardedAt === null || (archive.prayerAt !== null && archive.flowerAt !== null && archive.rewardedAt >= Math.max(archive.prayerAt, archive.flowerAt));
}
const earliest = (...values) => { const times = values.filter(value => value !== null && value !== undefined); return times.length ? Math.min(...times) : null; };

export function createAbbotQuest(database, { trialMode = false } = {}) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS temple_abbot_quests (
      user_id TEXT PRIMARY KEY REFERENCES community_users(id), accepted_at INTEGER, prayer_at INTEGER, flower_at INTEGER, rewarded_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS temple_abbot_journeys (
      user_id TEXT NOT NULL REFERENCES community_users(id), quest_id TEXT NOT NULL,
      accepted_at INTEGER NOT NULL, objectives_json TEXT NOT NULL, rewarded_at INTEGER,
      PRIMARY KEY(user_id, quest_id)
    );
    CREATE INDEX IF NOT EXISTS temple_abbot_journey_user ON temple_abbot_journeys(user_id, accepted_at);
  `);
  const query = {
    legacy: database.prepare("SELECT accepted_at AS acceptedAt, prayer_at AS prayerAt, flower_at AS flowerAt, rewarded_at AS rewardedAt FROM temple_abbot_quests WHERE user_id = ?"),
    saveLegacy: database.prepare(`INSERT INTO temple_abbot_quests (user_id, accepted_at, prayer_at, flower_at, rewarded_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET accepted_at = excluded.accepted_at, prayer_at = excluded.prayer_at, flower_at = excluded.flower_at, rewarded_at = excluded.rewarded_at`),
    journeys: database.prepare("SELECT quest_id AS questId, accepted_at AS acceptedAt, objectives_json AS objectivesJson, rewarded_at AS rewardedAt FROM temple_abbot_journeys WHERE user_id = ? ORDER BY accepted_at, quest_id"),
    save: database.prepare(`INSERT INTO temple_abbot_journeys (user_id, quest_id, accepted_at, objectives_json, rewarded_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, quest_id) DO UPDATE SET accepted_at = excluded.accepted_at, objectives_json = excluded.objectives_json, rewarded_at = excluded.rewarded_at`),
  };
  function rows(identity) {
    return query.journeys.all(identity.id).map(row => ({ questId: row.questId, acceptedAt: row.acceptedAt, objectives: JSON.parse(row.objectivesJson), rewardedAt: row.rewardedAt, rewardTitle: getAbbotQuest(row.questId).reward.title }));
  }
  function save(identity, journey) {
    query.save.run(identity.id, journey.questId, journey.acceptedAt, JSON.stringify(journey.objectives), journey.rewardedAt);
    if (journey.questId === "legacy") query.saveLegacy.run(identity.id, journey.acceptedAt, journey.objectives["legacy-prayer"], journey.objectives["legacy-flower"], journey.rewardedAt);
  }
  function migrate(identity) {
    const legacy = query.legacy.get(identity.id);
    if (!legacy || legacy.acceptedAt === null || rows(identity).some(row => row.questId === "legacy")) return;
    save(identity, { questId: "legacy", acceptedAt: legacy.acceptedAt, objectives: { "legacy-prayer": legacy.prayerAt, "legacy-flower": legacy.flowerAt }, rewardedAt: legacy.rewardedAt });
  }
  function selected(journeys, timestamp) {
    const pending = journeys.find(journey => journey.rewardedAt === null);
    if (pending) return pending;
    const completed = [...journeys].filter(journey => journey.rewardedAt !== null).sort((left, right) => right.rewardedAt - left.rewardedAt)[0];
    if (completed && Math.floor(completed.rewardedAt / CYCLE_MS) >= Math.floor(timestamp / CYCLE_MS)) return completed;
    return journeys.find(journey => journey.questId === getAbbotEncounter(timestamp).id);
  }
  function snapshot(identity, timestamp = Date.now()) {
    migrate(identity);
    const journeys = rows(identity);
    const journey = selected(journeys, timestamp);
    const quest = getAbbotQuest(journey?.questId ?? getAbbotEncounter(timestamp).id);
    const legacy = journeys.find(item => item.questId === "legacy");
    const completed = journeys.filter(item => item.rewardedAt !== null).sort((left, right) => left.rewardedAt - right.rewardedAt);
    const titles = [...new Set(completed.map(item => item.rewardTitle))];
    const certificates = [...new Map(completed.map(item => [item.rewardTitle, item])).values()];
    const archived = [...new Map([...journeys.slice(-32), ...certificates, ...journeys.filter(item => item.rewardedAt === null), ...(legacy ? [legacy] : [])].map(item => [item.questId, item])).values()];
    const completedObjectives = Object.fromEntries(quest.objectives.map(item => [item.id, journey?.objectives[item.id] !== null && journey?.objectives[item.id] !== undefined]));
    return {
      now: timestamp, encounter: getAbbotEncounter(timestamp), quest,
      progress: { accepted: Boolean(journey), prayer: quest.objectives.some(item => item.kind === "prayer" && completedObjectives[item.id]), flower: quest.objectives.some(item => item.kind === "flower" && completedObjectives[item.id]), rewarded: journey?.rewardedAt !== null && journey?.rewardedAt !== undefined, objectives: completedObjectives },
      rewards: { hasLantern: completed.length > 0, titles, activeTitle: completed[completed.length - 1]?.rewardTitle ?? "" },
      archive: { ...(legacy ? { acceptedAt: legacy.acceptedAt, prayerAt: legacy.objectives["legacy-prayer"], flowerAt: legacy.objectives["legacy-flower"], rewardedAt: legacy.rewardedAt } : emptyLegacy()), version: 2, journeys: archived },
      trial: { temporaryRecords: trialMode },
    };
  }
  function validJourney(journey, timestamp) {
    const quest = getAbbotQuest(journey?.questId);
    if (!quest || !Number.isSafeInteger(journey.acceptedAt) || journey.acceptedAt < 0 || journey.acceptedAt > timestamp || !journey.objectives || typeof journey.objectives !== "object" || Array.isArray(journey.objectives)) return false;
    if (journey.questId !== "legacy") {
      const encounter = getAbbotEncounter(journey.acceptedAt);
      if (!encounter.active || encounter.id !== journey.questId) return false;
    }
    if (Object.keys(journey.objectives).length !== quest.objectives.length || quest.objectives.some(item => !Object.hasOwn(journey.objectives, item.id))) return false;
    const times = quest.objectives.map(item => journey.objectives[item.id]);
    if (!times.every(value => validTime(value, timestamp) && (value === null || value >= journey.acceptedAt)) || !validTime(journey.rewardedAt, timestamp)) return false;
    return journey.rewardedAt === null || (times.every(value => value !== null) && journey.rewardedAt >= Math.max(...times));
  }
  function restore(identity, body, timestamp) {
    let incoming;
    if (body.archive?.version === 2) {
      if (!Array.isArray(body.archive.journeys) || body.archive.journeys.length > 20 || body.archive.journeys.some(journey => !validJourney(journey, timestamp))) return invalid("住持奇遇存档格式无效，请重新进入寺庙。");
      incoming = body.archive.journeys;
    } else {
      if (!validLegacy(body.archive, timestamp)) return invalid("住持奇遇存档格式无效，请重新进入寺庙。");
      const archive = body.archive;
      incoming = archive.acceptedAt === null ? [] : [{ questId: "legacy", acceptedAt: archive.acceptedAt, objectives: { "legacy-prayer": archive.prayerAt, "legacy-flower": archive.flowerAt }, rewardedAt: archive.rewardedAt }];
    }
    const saved = new Map(rows(identity).map(journey => [journey.questId, journey]));
    for (const item of incoming) {
      const old = saved.get(item.questId);
      const merged = { questId: item.questId, acceptedAt: earliest(old?.acceptedAt, item.acceptedAt), objectives: Object.fromEntries(getAbbotQuest(item.questId).objectives.map(objective => [objective.id, earliest(old?.objectives[objective.id], item.objectives[objective.id])])), rewardedAt: earliest(old?.rewardedAt, item.rewardedAt) };
      save(identity, merged);
      saved.set(item.questId, merged);
    }
    return null;
  }
  function perform(identity, body, timestamp) {
    if (body.action === "restore") return restore(identity, body, timestamp);
    if (!["accept", "complete", ...objectives.map(item => item.kind)].includes(body.action)) return invalid("请选择当前因缘中的修行，或与住持交谈。");
    const journeys = rows(identity);
    let journey = body.questId ? journeys.find(item => item.questId === body.questId) : selected(journeys, timestamp);
    if (journey?.rewardedAt !== null && journey?.rewardedAt !== undefined && body.action !== "accept") return null;
    if (body.action === "accept" || body.action === "complete") {
      const encounter = getAbbotEncounter(timestamp);
      if (!encounter.active || body.encounterId !== encounter.id) return invalid("住持已经移步云游，请等下一次现身后再来交谈。", 409);
      if (body.action === "accept") {
        const current = selected(journeys, timestamp);
        if (current) return null;
        if (body.questId && body.questId !== encounter.id) return invalid("住持这次带来了一段新的因缘，请重新听他开示。", 409);
        const quest = getAbbotQuest(encounter.id);
        journey = { questId: quest.id, acceptedAt: timestamp, objectives: Object.fromEntries(quest.objectives.map(item => [item.id, null])), rewardedAt: null };
        save(identity, journey);
        return null;
      }
    }
    if (!journey) return invalid("先找到住持，听他讲完这段因缘，再开始修行。", 409);
    const quest = getAbbotQuest(journey.questId);
    if (body.action === "complete") {
      if (quest.objectives.some(item => journey.objectives[item.id] === null)) return invalid("完成住持交代的每一项小愿，再回来与他交谈。", 409);
      journey.rewardedAt = timestamp;
    } else {
      const objective = quest.objectives.find(item => item.kind === body.action);
      if (!objective) return invalid("这项动作属于另一段因缘，请查看当前任务。", 409);
      journey.objectives[objective.id] ??= timestamp;
    }
    save(identity, journey);
    return null;
  }
  function act(identity, body, timestamp = Date.now()) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("请重新与住持交谈。");
    migrate(identity);
    database.exec("BEGIN IMMEDIATE");
    try {
      const failure = perform(identity, body, timestamp);
      database.exec(failure ? "ROLLBACK" : "COMMIT");
      return failure;
    } catch (failure) {
      database.exec("ROLLBACK");
      throw failure;
    }
  }
  return { snapshot, act };
}
