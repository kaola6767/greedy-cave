const RARITY = {
    COMMON: { name: '普通', color: 'rarity-common', dropChance: 0.55 },
    RARE: { name: '稀有', color: 'rarity-rare', dropChance: 0.30 },
    EPIC: { name: '史诗', color: 'rarity-epic', dropChance: 0.12 },
    LEGENDARY: { name: '传说', color: 'rarity-legendary', dropChance: 0.03 },
};

const EQUIP_TYPE = {
    WEAPON: { name: '武器', slot: 'weapon', statMain: 'atk' },
    HELMET: { name: '头盔', slot: 'helmet', statMain: 'def' },
    ARMOR: { name: '铠甲', slot: 'armor', statMain: 'def' },
    RING: { name: '戒指', slot: 'ring', statMain: 'atk' },
};

const WEAPON_NAMES = ['短剑', '长剑', '战斧', '匕首', '弯刀', '手杖', '长矛', '铁锤', '细剑', '镰刀'];
const HELMET_NAMES = ['布帽', '皮盔', '铁盔', '链甲头巾', '角盔', '秘银盔', '暗影兜帽'];
const ARMOR_NAMES = ['布甲', '皮甲', '锁子甲', '板甲', '鳞甲', '暗影长袍', '龙鳞甲'];
const RING_NAMES = ['铜戒', '银戒', '金戒', '宝石戒', '骷髅戒', '龙眼戒', '暗影戒'];

const AFFIXES = [
    { name: '力量', stat: 'atk', min: 1, max: 4 },
    { name: '坚固', stat: 'def', min: 1, max: 3 },
    { name: '活力', stat: 'hp', min: 5, max: 20 },
    { name: '精准', stat: 'atk', min: 2, max: 6 },
    { name: '韧性', stat: 'def', min: 2, max: 5 },
    { name: '巨熊', stat: 'hp', min: 10, max: 30 },
    { name: '致命', stat: 'critChance', min: 2, max: 8 },
];

function rollRarity() {
    const roll = Math.random();
    let cumulative = 0;
    for (const r of [RARITY.LEGENDARY, RARITY.EPIC, RARITY.RARE, RARITY.COMMON]) {
        cumulative += r.dropChance;
        if (roll <= cumulative) return r;
    }
    return RARITY.COMMON;
}

function randomAffix() {
    return { ...pick(AFFIXES), value: rand(pick(AFFIXES).min, pick(AFFIXES).max) };
}

function generateEquipment(floorLevel, forcedRarity) {
    const type = pick([EQUIP_TYPE.WEAPON, EQUIP_TYPE.HELMET, EQUIP_TYPE.ARMOR, EQUIP_TYPE.RING]);
    const rarity = forcedRarity || rollRarity();
    const baseNames = {
        weapon: WEAPON_NAMES, helmet: HELMET_NAMES, armor: ARMOR_NAMES, ring: RING_NAMES
    };
    const name = pick(baseNames[type.slot]);

    const rarityMultiplier = { COMMON: 1, RARE: 1.5, EPIC: 2.2, LEGENDARY: 3.2 }[Object.keys(RARITY).find(k => RARITY[k] === rarity)];
    const floorBonus = 1 + (floorLevel - 1) * 0.15;

    let atk = 0, def = 0, hp = 0;
    if (type.slot === 'weapon') atk = rand(3, 6) * rarityMultiplier * floorBonus | 0;
    else if (type.slot === 'armor') def = rand(3, 6) * rarityMultiplier * floorBonus | 0;
    else if (type.slot === 'helmet') { def = rand(1, 3) * rarityMultiplier * floorBonus | 0; hp = rand(5, 15) * rarityMultiplier * floorBonus | 0; }
    else if (type.slot === 'ring') atk = rand(2, 4) * rarityMultiplier * floorBonus | 0;

    const affixCount = rarity === RARITY.LEGENDARY ? 2 : (rarity === RARITY.EPIC ? rand(1, 2) : 1);
    const affixes = [];
    for (let i = 0; i < affixCount; i++) {
        affixes.push(randomAffix());
    }

    return {
        name,
        type,
        rarity,
        atk,
        def,
        hp,
        affixes,
        fullName: `${rarity.name} ${name}`,
        description() {
            const parts = [];
            if (this.atk) parts.push(`攻击+${this.atk}`);
            if (this.def) parts.push(`防御+${this.def}`);
            if (this.hp) parts.push(`生命+${this.hp}`);
            for (const a of this.affixes) {
                const label = a.stat === 'critChance' ? '暴击率' : (a.stat === 'atk' ? '攻击' : a.stat === 'def' ? '防御' : '生命');
                parts.push(`${a.name}: ${label}+${a.value}${a.stat === 'critChance' ? '%' : ''}`);
            }
            return parts.join(' ');
        }
    };
}
