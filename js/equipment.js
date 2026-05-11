const EQ_TYPES = {
    weapon:  { name: '武器',  slot: 'weapon',   category: 'weapon' },
    helmet:  { name: '头盔',  slot: 'helmet',   category: 'armor' },
    armor:   { name: '铠甲',  slot: 'armor',    category: 'armor' },
    gloves:  { name: '护手',  slot: 'gloves',   category: 'armor' },
    boots:   { name: '靴子',  slot: 'boots',    category: 'armor' },
    ring:    { name: '戒指',  slot: 'ring1',    category: 'jewelry' },
    necklace:{ name: '项链',  slot: 'necklace', category: 'jewelry' },
};

const WEAPON_NAMES = ['短剑','长剑','战斧','匕首','弯刀','战锤','长矛','利爪','细剑','巨剑'];
const HELMET_NAMES = ['布帽','皮帽','铁盔','钢盔','秘银盔','龙鳞盔'];
const ARMOR_NAMES = ['布甲','皮甲','锁子甲','板甲','秘银甲','龙鳞甲'];
const GLOVES_NAMES = ['布手套','皮手套','铁护手','钢护手','秘银护手'];
const BOOTS_NAMES = ['布靴','皮靴','铁靴','钢靴','秘银靴'];
const RING_NAMES = ['铜戒指','银戒指','金戒指','铂金戒指','秘银戒指'];
const NECKLACE_NAMES = ['铜项链','银项链','金项链','翡翠项链','秘银项链'];

const RARITIES = [
    { name: '普通', color: 'rarity-common',   weight: 45, affixes: 0, mult: 1.0 },
    { name: '稀有', color: 'rarity-rare',     weight: 30, affixes: 1, mult: 1.0 },
    { name: '黄金', color: 'rarity-epic',     weight: 15, affixes: 2, mult: 1.0 },
    { name: '史诗', color: 'rarity-legendary',weight: 8,  affixes: 3, mult: 1.3 },
    { name: '传说', color: 'rarity-legendary',weight: 2,  affixes: 4, mult: 1.6 },
];

const AFFIX_POOL = [
    { stat: 'atk',        label: '攻击',  minPerLv: 0.5, maxPerLv: 1.2, weight: 20 },
    { stat: 'def',        label: '防御',  minPerLv: 0.3, maxPerLv: 0.8, weight: 15 },
    { stat: 'hp',         label: '生命',  minPerLv: 1.5, maxPerLv: 5,   weight: 18 },
    { stat: 'critChance', label: '暴击率',fType: 1, fMin: 1, fMax: 4,   weight: 10 },
    { stat: 'dodge',      label: '闪避率',fType: 1, fMin: 1, fMax: 3,   weight: 8 },
    { stat: 'lifesteal',  label: '吸血',  fType: 1, fMin: 1, fMax: 3,   weight: 8 },
    { stat: 'goldBonus',  label: '金币加成',fType:1,fMin:10,fMax:30,     weight: 5 },
    { stat: 'xpBonus',    label: '经验加成',fType:1,fMin:10,fMax:25,     weight: 5 },
    { stat: 'elemDmg',    label: '元素伤害',minPerLv:0.4,maxPerLv:1.0,  weight: 6 },
    { stat: 'resist',     label: '全抗性',minPerLv:0.2,maxPerLv:0.6,    weight: 5 },
];

const LEGENDARY_MODS = [
    { name: '处决者', desc: '对HP<20%敌人伤害+50%' },
    { name: '不死鸟', desc: '死亡时以30%HP复活一次' },
    { name: '时空裂隙', desc: '10%概率额外行动一回合' },
    { name: '吸血之王', desc: '吸血效果翻倍' },
    { name: '金刚不坏', desc: '受到暴击伤害减半' },
    { name: '雷霆之怒', desc: '攻击15%概率双倍伤害' },
];

function stageRange(floor) {
    const lo = Math.floor((floor - 1) / 10) * 10 + 1;
    return [lo, lo + 9];
}

function rollILvl(floor) {
    const [lo, hi] = stageRange(floor);
    return clamp(floor + rand(-2, 2), lo, hi);
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

function generateEquipment(floorLevel, forcedRarity) {
    const iLvl = rollILvl(floorLevel);
    const type = pick(Object.values(EQ_TYPES));
    const rarity = forcedRarity || weightedPick(RARITIES, r => r.weight);
    const stats = {};

    if (type.category === 'weapon') {
        stats.atk = Math.round((iLvl * 3.2 + 8) * randFloat(0.85, 1.15));
    } else if (type.category === 'armor') {
        stats.def = Math.round((iLvl * 1.2 + 3) * 0.85 * randFloat(0.9, 1.1));
        if (type.slot === 'armor') {
            stats.hp = Math.round((iLvl * 5 + 20) * randFloat(0.9, 1.1));
        }
    } else {
        if (type.slot === 'necklace') {
            stats.atk = Math.round((iLvl * 2.0 + 4) * randFloat(0.8, 1.2));
            stats.def = Math.round((iLvl * 1.0 + 2) * randFloat(0.8, 1.2));
            stats.hp = Math.round((iLvl * 4 + 15) * randFloat(0.8, 1.2));
        } else {
            stats.atk = Math.round((iLvl * 1.0 + 2) * randFloat(0.8, 1.2));
            stats.def = Math.round((iLvl * 0.6 + 1) * randFloat(0.8, 1.2));
            stats.hp = Math.round((iLvl * 2 + 10) * randFloat(0.8, 1.2));
        }
    }

    // Affixes
    const affixes = [];
    const affixCount = rarity.affixes;
    if (affixCount > 0) {
        const used = new Set(Object.keys(stats));
        const pool = [...AFFIX_POOL].sort(() => Math.random() - 0.5);
        for (const a of pool) {
            if (affixes.length >= affixCount) break;
            if (used.has(a.stat)) continue;
            let val;
            if (a.fType) {
                val = rand(a.fMin, a.fMax);
            } else {
                val = Math.round(randFloat(iLvl * a.minPerLv, iLvl * a.maxPerLv));
            }
            val = Math.round(val * rarity.mult);
            if (val <= 0) continue;
            affixes.push({ stat: a.stat, label: a.label, value: val, suffix: a.fType ? '%' : '' });
            used.add(a.stat);
        }
    }

    // Legendary mod
    let legendaryMod = null;
    if (rarity.name === '传说') legendaryMod = pick(LEGENDARY_MODS);

    // Name
    const nameMap = {
        weapon: WEAPON_NAMES, helmet: HELMET_NAMES, armor: ARMOR_NAMES,
        gloves: GLOVES_NAMES, boots: BOOTS_NAMES,
        necklace: NECKLACE_NAMES, ring1: RING_NAMES,
    };
    const baseName = pick(nameMap[type.slot] || RING_NAMES);

    return {
        type, rarity, iLvl, stats, affixes, legendaryMod, baseName,
        fullName: rarity.name + ' ' + baseName,
        desc() {
            const p = [`iLv.${iLvl}`];
            for (const [k, v] of Object.entries(stats)) {
                const lb = { atk: '攻', def: '防', hp: '命' }[k] || k;
                p.push(`${lb}+${v}`);
            }
            for (const a of affixes) p.push(`${a.label}+${a.value}${a.suffix}`);
            if (legendaryMod) p.push(`[${legendaryMod.name}]`);
            return p.join(' ');
        },
    };
}

function calcSetBonus(equipment) {
    let n = 0;
    for (const v of Object.values(equipment)) {
        if (v && v.rarity.name === '史诗') n++;
    }
    return { atkPct: n >= 2 ? 0.12 : 0, dmgReduct: n >= 4 ? 0.10 : 0 };
}
