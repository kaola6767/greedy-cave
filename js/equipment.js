// ============ Six-Tier Rarity System ============
const EQ_TYPES = {
    weapon:  { name:'武器',  slot:'weapon',  category:'weapon' },
    helmet:  { name:'头盔',  slot:'helmet',  category:'armor' },
    armor:   { name:'铠甲',  slot:'armor',   category:'armor' },
    gloves:  { name:'护手',  slot:'gloves',  category:'armor' },
    boots:   { name:'靴子',  slot:'boots',   category:'armor' },
    ring:    { name:'戒指',  slot:'ring1',   category:'jewelry' },
    necklace:{ name:'项链',  slot:'necklace',category:'jewelry' },
};

const WEAPON_NAMES = ['短剑','长剑','战斧','匕首','弯刀','战锤','长矛','利爪','细剑','巨剑'];
const HELMET_NAMES = ['布帽','皮帽','铁盔','钢盔','秘银盔','龙鳞盔'];
const ARMOR_NAMES = ['布甲','皮甲','锁子甲','板甲','秘银甲','龙鳞甲'];
const GLOVES_NAMES = ['布手套','皮手套','铁护手','钢护手','秘银护手'];
const BOOTS_NAMES = ['布靴','皮靴','铁靴','钢靴','秘银靴'];
const RING_NAMES = ['铜戒指','银戒指','金戒指','铂金戒指','秘银戒指'];
const NECKLACE_NAMES = ['铜项链','银项链','金项链','翡翠项链','秘银项链'];

const RARITIES = [
    { name:'普通', color:'rarity-common',    affixes:0, mult:1.0, hex:'#aaa' },
    { name:'精良', color:'rarity-uncommon',  affixes:1, mult:1.0, hex:'#4dff4d' },
    { name:'稀有', color:'rarity-rare',      affixes:2, mult:1.0, hex:'#4da6ff' },
    { name:'史诗', color:'rarity-epic',      affixes:3, mult:1.3, hex:'#c44dff' },
    { name:'传说', color:'rarity-legendary', affixes:4, mult:1.6, hex:'#ff8c00' },
    { name:'神话', color:'rarity-mythic',    affixes:5, mult:2.0, hex:'#ffd700' },
];

// Floor-range rarity weights (for generic generation)
const RARITY_WEIGHTS = [
    // floorRanges: 1-10, 11-20, 21-40, 41-60, 61+
    [45, 30, 15,  8,  2,  0],  // 1-10
    [30, 30, 20, 12,  6,  2],  // 11-20
    [15, 25, 25, 18, 12,  5],  // 21-40
    [ 5, 15, 25, 25, 18, 12],  // 41-60
    [ 0,  5, 15, 28, 30, 22],  // 61+
];

// Drop tables by monster type
const NORMAL_DROP = [
    [60, 30,  8,  2,  0,  0],  // 1-10
    [40, 35, 18,  5,  2,  0],  // 11-20
    [25, 30, 25, 14,  5,  1],  // 21-40
    [10, 20, 28, 25, 12,  5],  // 41-60
    [ 0, 10, 20, 30, 25, 15],  // 61+
];
const ELITE_DROP = [   // +1 tier shift
    [ 0, 60, 30,  8,  2,  0],
    [ 0, 40, 35, 18,  5,  2],
    [ 0, 25, 30, 25, 14,  6],
    [ 0, 10, 20, 28, 25, 17],
    [ 0,  0, 10, 20, 35, 35],
];
const BOSS_DROP = [    // +2 tier shift, min epic
    [ 0,  0, 60, 30,  8,  2],
    [ 0,  0, 40, 35, 18,  7],
    [ 0,  0, 25, 30, 25, 20],
    [ 0,  0, 10, 20, 30, 40],
    [ 0,  0,  0, 15, 30, 55],
];

function getFloorTier(floor) {
    if (floor <= 10) return 0;
    if (floor <= 20) return 1;
    if (floor <= 40) return 2;
    if (floor <= 60) return 3;
    return 4;
}

function rollRarityWeights(weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    if (total === 0) return RARITIES.length - 1; // fallback
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
    }
    return weights.length - 1;
}

// ============ Affix System ============
const AFFIX_TIERS = {
    T1: { label:'T1', weight:20, affixes:[
        { stat:'atk',       label:'攻击+',   formula:(ilv)=>Math.round(ilv*randFloat(0.8,1.5)) },
        { stat:'def',       label:'防御+',   formula:(ilv)=>Math.round(ilv*randFloat(0.5,1.0)) },
        { stat:'hp',        label:'生命+',   formula:(ilv)=>Math.round(ilv*randFloat(3.0,6.0)) },
    ]},
    T2: { label:'T2', weight:14, affixes:[
        { stat:'atkPct',    label:'攻击%',   formula:()=>rand(3,8), suffix:'%' },
        { stat:'defPct',    label:'防御%',   formula:()=>rand(3,8), suffix:'%' },
        { stat:'hpPct',     label:'生命%',   formula:()=>rand(4,10), suffix:'%' },
    ]},
    T3: { label:'T3', weight:10, affixes:[
        { stat:'critChance',label:'暴击率',  formula:()=>rand(2,6), suffix:'%' },
        { stat:'critDmg',   label:'暴击伤害',formula:()=>rand(15,40), suffix:'%' },
        { stat:'lifesteal', label:'吸血',    formula:()=>rand(1,4), suffix:'%' },
        { stat:'dodge',     label:'闪避',    formula:()=>rand(1,4), suffix:'%' },
        { stat:'penetration',label:'穿透',   formula:(ilv)=>Math.round(ilv*randFloat(0.3,0.8)) },
    ]},
    T4: { label:'T4', weight:6, affixes:[
        { stat:'elemDmg',   label:'元素伤害',formula:(ilv)=>Math.round(ilv*randFloat(0.5,1.2)) },
        { stat:'resist',    label:'全抗性',  formula:(ilv)=>Math.round(ilv*randFloat(0.3,0.7)) },
        { stat:'goldBonus', label:'金币加成',formula:()=>rand(15,40), suffix:'%' },
        { stat:'xpBonus',   label:'经验加成',formula:()=>rand(15,35), suffix:'%' },
        { stat:'dmgReduct', label:'伤害减免',formula:()=>rand(2,5), suffix:'%' },
    ]},
};

// ============ Legendary Mods ============
const LEGENDARY_MODS = [
    { name:'处决者',   desc:'对HP<20%敌人伤害+50%', tier:'S' },
    { name:'不死鸟',   desc:'死亡时以30%HP复活一次', tier:'S' },
    { name:'时空裂隙', desc:'10%概率额外行动一回合', tier:'A' },
    { name:'吸血之王', desc:'吸血效果翻倍', tier:'A' },
    { name:'金刚不坏', desc:'受到暴击伤害减半', tier:'A' },
    { name:'雷霆之怒', desc:'攻击15%概率双倍伤害', tier:'S' },
    { name:'穿透之刃', desc:'穿透值+50%', tier:'A' },
    { name:'暴击连动', desc:'暴击时20%概率重置技能CD', tier:'S' },
    { name:'元素共鸣', desc:'元素伤害30%概率连锁相邻怪物', tier:'A' },
];

// ============ Sets (Mythic only) ============
const SETS = [
    { name:'龙鳞之怒', slots:['helmet','armor','gloves','boots'],
      bonus2:'DEF+25%', bonus4:'受到伤害反弹20%给攻击者', type:'tank' },
    { name:'暗影之刃', slots:['weapon','gloves','ring1','ring2'],
      bonus2:'暴击率+12%', bonus4:'暴击伤害从1.5×提升至2.2×', type:'dps' },
    { name:'元素之心', slots:['weapon','necklace','ring1','ring2'],
      bonus2:'元素伤害+35%', bonus4:'技能冷却-1(可叠加)', type:'mage' },
    { name:'不朽之魂', slots:['helmet','armor','necklace','boots'],
      bonus2:'HP+30%', bonus4:'每回合恢复8%HP', type:'survival' },
];

// ============ Generation ============
function stageRange(floor) {
    const lo = Math.floor((floor - 1) / 10) * 10 + 1;
    return [lo, lo + 9];
}

function rollILvl(floor) {
    const [lo, hi] = stageRange(floor);
    return clamp(floor + rand(-2, 2), lo, hi);
}

function randFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function weightedPick(items, fn) {
    const total = items.reduce((s, i) => s + fn(i), 0);
    let r = Math.random() * total;
    for (const item of items) {
        r -= fn(item);
        if (r <= 0) return item;
    }
    return items[items.length - 1];
}

function getRarityByIndex(idx) {
    return RARITIES[idx] || RARITIES[0];
}

function generateEquipment(floorLevel, forcedRarity, monsterType) {
    const iLvl = rollILvl(floorLevel);
    const type = pick(Object.values(EQ_TYPES));
    const ft = getFloorTier(floorLevel);

    let rarity;
    if (forcedRarity) {
        rarity = forcedRarity;
    } else if (monsterType === 'boss') {
        const idx = rollRarityWeights(BOSS_DROP[ft]);
        rarity = getRarityByIndex(Math.max(idx, 3)); // min epic
    } else if (monsterType === 'elite') {
        const idx = rollRarityWeights(ELITE_DROP[ft]);
        rarity = getRarityByIndex(idx);
    } else {
        const idx = rollRarityWeights(NORMAL_DROP[ft]);
        rarity = getRarityByIndex(idx);
    }

    // Main stats by slot
    const stats = {};
    if (type.category === 'weapon') {
        stats.atk = Math.round((iLvl * 3.2 + 8) * randFloat(0.85, 1.15));
    } else if (type.slot === 'helmet') {
        stats.def = Math.round((iLvl * 1.2 + 3) * 0.85 * randFloat(0.9, 1.1));
    } else if (type.slot === 'armor') {
        stats.def = Math.round((iLvl * 1.2 + 3) * 0.85 * randFloat(0.9, 1.1));
        stats.hp = Math.round((iLvl * 5 + 20) * randFloat(0.9, 1.1));
    } else if (type.slot === 'gloves') {
        stats.atk = Math.round((iLvl * 1.5 + 4) * randFloat(0.9, 1.1));
        stats.def = Math.round((iLvl * 0.8 + 2) * randFloat(0.9, 1.1));
    } else if (type.slot === 'boots') {
        stats.def = Math.round((iLvl * 1.0 + 3) * 0.85 * randFloat(0.9, 1.1));
        stats.dodge = rand(2, 5);
    } else if (type.slot === 'necklace') {
        stats.atk = Math.round((iLvl * 2.0 + 4) * randFloat(0.8, 1.2));
        stats.hp = Math.round((iLvl * 4 + 15) * randFloat(0.8, 1.2));
    } else {
        // rings
        stats.atk = Math.round((iLvl * 1.0 + 2) * randFloat(0.8, 1.2));
        stats.hp = Math.round((iLvl * 2 + 10) * randFloat(0.8, 1.2));
    }

    // Affixes
    const affixes = [];
    const affixCount = rarity.affixes;
    if (affixCount > 0) {
        const usedStats = new Set(Object.keys(stats));
        // Collect all available affixes with tier info
        const affixPool = [];
        for (const [tierKey, tierData] of Object.entries(AFFIX_TIERS)) {
            for (const a of tierData.affixes) {
                affixPool.push({ ...a, tierWeight: tierData.weight });
            }
        }
        // Shuffle
        affixPool.sort(() => Math.random() - 0.5);

        for (const a of affixPool) {
            if (affixes.length >= affixCount) break;
            if (usedStats.has(a.stat)) continue;
            // Conflict: same stat in T1+T2
            const conflict = (a.stat === 'atkPct' && usedStats.has('atk'))
                || (a.stat === 'defPct' && usedStats.has('def'))
                || (a.stat === 'hpPct' && usedStats.has('hp'));
            if (conflict) continue;
            let val = a.formula(iLvl);
            val = Math.round(val * rarity.mult);
            if (val <= 0) continue;
            affixes.push({ stat:a.stat, label:a.label, value:val, suffix:a.suffix||'' });
            usedStats.add(a.stat);
        }
    }

    // Legendary mod (orange + gold)
    let legendaryMod = null;
    if (rarity.name === '传说') {
        legendaryMod = pick(LEGENDARY_MODS);
    } else if (rarity.name === '神话') {
        const sTier = LEGENDARY_MODS.filter(m => m.tier === 'S');
        legendaryMod = pick(sTier);
    }

    // Set (mythic 50% chance)
    let setType = null;
    if (rarity.name === '神话' && Math.random() < 0.5) {
        const set = pick(SETS);
        if (set.slots.includes(type.slot)) {
            setType = set.name;
        }
    }

    // Name
    const nameMap = {
        weapon:WEAPON_NAMES, helmet:HELMET_NAMES, armor:ARMOR_NAMES,
        gloves:GLOVES_NAMES, boots:BOOTS_NAMES,
        necklace:NECKLACE_NAMES, ring1:RING_NAMES,
    };
    const baseName = pick(nameMap[type.slot] || RING_NAMES);

    return {
        type, rarity, iLvl, stats, affixes, legendaryMod, setType, baseName,
        fullName: rarity.name + ' ' + baseName,
        desc() {
            const p = [`iLv.${iLvl}`];
            const labelMap = {
                atk:'攻', def:'防', hp:'命', dodge:'闪避', critDmg:'暴伤',
                penetration:'穿透', dmgReduct:'减伤',
            };
            for (const [k, v] of Object.entries(stats)) {
                const lb = labelMap[k] || k;
                p.push(`${lb}+${v}`);
            }
            for (const a of affixes) p.push(`${a.label}+${a.value}${a.suffix}`);
            if (legendaryMod) p.push(`[${legendaryMod.name}]`);
            if (setType) p.push(`{${setType}}`);
            return p.join(' ');
        },
    };
}

// ============ Set Bonus ============
function calcSetBonus(equipment) {
    const setCounts = {};
    for (const item of Object.values(equipment)) {
        if (item && item.setType) {
            setCounts[item.setType] = (setCounts[item.setType] || 0) + 1;
        }
    }

    const bonuses = { atkPct:0, dmgReduct:0, defPct:0, critChance:0, elemDmg:0, hpPct:0, critMult:0, cdReduce:0, regen:0, thorns:0 };
    for (const [setName, count] of Object.entries(setCounts)) {
        if (count >= 2) {
            const set = SETS.find(s => s.name === setName);
            if (!set) continue;
            switch (set.type) {
                case 'tank':
                    if (count >= 2) bonuses.defPct += 0.25;
                    if (count >= 4) bonuses.thorns = 0.20;
                    break;
                case 'dps':
                    if (count >= 2) bonuses.critChance += 12;
                    if (count >= 4) bonuses.critMult = 2.2;
                    break;
                case 'mage':
                    if (count >= 2) bonuses.elemDmg += 0.35;
                    if (count >= 4) bonuses.cdReduce += 1;
                    break;
                case 'survival':
                    if (count >= 2) bonuses.hpPct += 0.30;
                    if (count >= 4) bonuses.regen += 8;
                    break;
            }
        }
    }
    return bonuses;
}
