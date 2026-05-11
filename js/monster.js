const MONSTER_TYPES = [
    { name: '史莱姆',   baseHp: 20, baseAtk: 4,  baseDef: 1, xp: 15, emoji: '🟢' },
    { name: '骷髅兵',   baseHp: 30, baseAtk: 7,  baseDef: 3, xp: 25, emoji: '💀' },
    { name: '哥布林',   baseHp: 25, baseAtk: 6,  baseDef: 2, xp: 20, emoji: '👺' },
    { name: '暗影蜘蛛', baseHp: 35, baseAtk: 9,  baseDef: 3, xp: 30, emoji: '🕷️' },
    { name: '石像鬼',   baseHp: 45, baseAtk: 10, baseDef: 6, xp: 40, emoji: '🗿' },
    { name: '暗黑法师', baseHp: 30, baseAtk: 13, baseDef: 2, xp: 35, emoji: '🧙' },
    { name: '食人魔',   baseHp: 60, baseAtk: 11, baseDef: 5, xp: 50, emoji: '👹' },
    { name: '恶魔',     baseHp: 80, baseAtk: 15, baseDef: 8, xp: 70, emoji: '👿' },
    { name: '龙',       baseHp:120, baseAtk: 20, baseDef:12, xp:100, emoji: '🐉' },
];

function generateMonster(floorLevel) {
    const idx = Math.min(floorLevel - 1, MONSTER_TYPES.length - 1);
    const pool = MONSTER_TYPES.slice(0, idx + 1);
    const template = pick(pool);

    const scale = 1 + (floorLevel - 1) * 0.2;
    const variance = randFloat(0.85, 1.15);

    return {
        name: template.name,
        emoji: template.emoji,
        maxHp: Math.floor(template.baseHp * scale * variance),
        hp: Math.floor(template.baseHp * scale * variance),
        atk: Math.floor(template.baseAtk * scale * variance),
        def: Math.floor(template.baseDef * scale * variance),
        xp: Math.floor(template.xp * scale),
    };
}
