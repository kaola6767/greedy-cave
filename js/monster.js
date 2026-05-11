const MONSTER_NAMES = [
    { name: '史莱姆',   emoji: '🟢' },
    { name: '骷髅兵',   emoji: '💀' },
    { name: '哥布林',   emoji: '👺' },
    { name: '暗影蜘蛛', emoji: '🕷️' },
    { name: '石像鬼',   emoji: '🗿' },
    { name: '暗黑法师', emoji: '🧙' },
    { name: '食人魔',   emoji: '👹' },
    { name: '恶魔',     emoji: '👿' },
    { name: '龙',       emoji: '🐉' },
];

const ELITE_PREFIXES = [
    { name: '精英', emoji: '⭐', color: '#ffaa00' },
    { name: '狂怒', emoji: '🔥', color: '#ff4400' },
    { name: '暗影', emoji: '🌑', color: '#8844ff' },
    { name: '冰霜', emoji: '❄️', color: '#44ccff' },
    { name: '剧毒', emoji: '☠️', color: '#44ff44' },
    { name: '巨石', emoji: '🪨', color: '#aaaaaa' },
];

const BOSS_NAMES = [
    { name: '深渊领主', emoji: '👁️' },
    { name: '死灵法王', emoji: '☠️' },
    { name: '炎魔',     emoji: '🔥' },
    { name: '远古巨龙', emoji: '🐲' },
    { name: '暗影之王', emoji: '🖤' },
];

function monsterBaseStats(N) {
    const hp = Math.round(45 + N * 20 + Math.pow(N, 1.2) * 1.8);
    const atk = Math.round(10 + N * 6 + Math.pow(N, 1.08) * 0.8);
    const def = Math.round(3 + N * 2 + Math.pow(N, 1.08) * 0.4);
    return { hp, atk, def };
}

function generateMonster(floorLevel) {
    const isBoss = (floorLevel % 10 === 0);
    const isElite = !isBoss && Math.random() < 0.15;
    const N = floorLevel;

    const base = monsterBaseStats(N);
    const template = pick(MONSTER_NAMES);

    if (isBoss) {
        const bossTmpl = pick(BOSS_NAMES);
        return {
            name: bossTmpl.name,
            emoji: bossTmpl.emoji,
            maxHp: Math.round(base.hp * 6 + N * 20),
            hp: Math.round(base.hp * 6 + N * 20),
            atk: Math.round(base.atk * 2.5 + N * 2),
            def: Math.round(base.def * 3),
            xp: Math.round((15 + N * 4) * 9),
            gold: Math.round((5 + N * 2) * 9 * randFloat(0.7, 1.3)),
            isBoss: true,
            isElite: false,
            color: '#ff0000',
        };
    }

    if (isElite) {
        const prefix = pick(ELITE_PREFIXES);
        return {
            name: prefix.name + ' ' + template.name,
            emoji: prefix.emoji + template.emoji,
            maxHp: Math.round(base.hp * 2.5),
            hp: Math.round(base.hp * 2.5),
            atk: Math.round(base.atk * 1.8),
            def: Math.round(base.def * 2.0),
            xp: Math.round((15 + N * 4) * 3),
            gold: Math.round((5 + N * 2) * 3 * randFloat(0.7, 1.3)),
            isBoss: false,
            isElite: true,
            color: prefix.color,
        };
    }

    return {
        name: template.name,
        emoji: template.emoji,
        maxHp: base.hp,
        hp: base.hp,
        atk: base.atk,
        def: base.def,
        xp: Math.round(15 + N * 4),
        gold: Math.round((5 + N * 2) * randFloat(0.7, 1.3)),
        isBoss: false,
        isElite: false,
        color: '#ff4444',
    };
}
