class Combat {
    constructor(player, monster, floorLevel) {
        this.player = player;
        this.monster = monster;
        this.floorLevel = floorLevel || 1;
        this.log = [];
        this.finished = false;
        this.playerWon = false;
        this.fled = false;
        this.undyingUsed = false;
        this.skillCdr = false; // reset flag for critCDR legendary
        // Buffs: remaining turns
        this.buffs = {
            shieldWall: 0,
            thorns: 0,
            berserk: 0,
            immune: 0,
        };
        this.monsterFrozen = 0;
    }

    getPlayerPenetration() {
        let pen = this.player.penetration || 0;
        // Legendary: 穿透之刃
        for (const item of Object.values(this.player.equipment)) {
            if (item && item.legendaryMod && item.legendaryMod.name === '穿透之刃') {
                pen = Math.round(pen * 1.5);
                break;
            }
        }
        return pen;
    }

    damageFormula(atk, def, penetration) {
        const pen = penetration || 0;
        const effectiveDef = Math.max(0, def - pen);
        const dmg = atk * (1 - effectiveDef / (effectiveDef + 200 + this.floorLevel * 5));
        return Math.max(1, Math.round(dmg));
    }

    // Returns { ok: boolean, msg: string }
    useSkill(skill) {
        if (!skill || skill.type !== 'active') return { ok: false, msg: '无效技能' };
        const cd = this.player.cooldowns[skill.key];
        if (cd > 0) return { ok: false, msg: `冷却中 (${cd}回合)` };

        // Meditation passive + set bonus cd reduce
        let cdReduction = this.player.hasPassive('meditation') ? 1 : 0;
        const setB3 = calcSetBonus(this.player.equipment);
        if (setB3.cdReduce) cdReduction += setB3.cdReduce;
        const finalCd = Math.max(1, skill.cd - cdReduction);

        let dmg = 0;
        let extraMsg = '';
        const pen = this.getPlayerPenetration();

        switch (skill.key) {
            case 'whirlwind':
                dmg = this.damageFormula(this.player.atk + (this.player.elemDmg || 0), this.monster.def);
                dmg = Math.round(dmg * 1.5);
                break;
            case 'armorBreak':
                dmg = this.damageFormula(this.player.atk + (this.player.elemDmg || 0), Math.round(this.monster.def * 0.7));
                break;
            case 'berserk':
                this.buffs.berserk = 3;
                this.player.cooldowns[skill.key] = finalCd;
                extraMsg = 'ATK+30% 持续3回合';
                this.log.push(`🔥 狂暴! ${extraMsg}`);
                return { ok: true, msg: extraMsg };
            case 'bladeStorm':
                dmg = this.damageFormula(this.player.atk + (this.player.elemDmg || 0), this.monster.def);
                dmg = Math.round(dmg * 2.5);
                break;
            case 'shieldWall':
                this.buffs.shieldWall = 2;
                this.player.cooldowns[skill.key] = finalCd;
                extraMsg = '减伤50% 持续2回合';
                this.log.push(`🧱 盾墙! ${extraMsg}`);
                return { ok: true, msg: extraMsg };
            case 'thorns':
                this.buffs.thorns = 2;
                this.player.cooldowns[skill.key] = finalCd;
                extraMsg = '反弹30%伤害 持续2回合';
                this.log.push(`🌿 荆棘甲! ${extraMsg}`);
                return { ok: true, msg: extraMsg };
            case 'holyLight':
                const heal = Math.round(this.player.maxHp * 0.4);
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
                this.player.cooldowns[skill.key] = finalCd;
                extraMsg = `恢复了 ${heal} HP`;
                this.log.push(`✨ 圣光! ${extraMsg}`);
                return { ok: true, msg: extraMsg };
            case 'sanctuary':
                this.buffs.immune = 3;
                this.player.cooldowns[skill.key] = finalCd;
                extraMsg = '免疫伤害 持续3回合';
                this.log.push(`🏰 神圣领域! ${extraMsg}`);
                return { ok: true, msg: extraMsg };
            case 'fireball':
                dmg = this.damageFormula(this.player.atk + (this.player.elemDmg || 0), Math.round(this.monster.def * 0.5));
                dmg = Math.round(dmg * 2.0);
                break;
            case 'frostNova':
                dmg = this.damageFormula(this.player.atk + (this.player.elemDmg || 0), this.monster.def);
                dmg = Math.round(dmg * 1.5);
                this.monsterFrozen = 1;
                extraMsg = '怪物被冰冻!';
                break;
            case 'thunderStorm':
                dmg = this.damageFormula(this.player.atk + (this.player.elemDmg || 0), this.monster.def);
                dmg = Math.round(dmg * 2.5);
                break;
            case 'meteor':
                dmg = Math.round(this.player.atk * 3.5 + (this.player.elemDmg || 0) * 3.5);
                dmg = Math.max(1, dmg);
                break;
            default:
                return { ok: false, msg: '未知技能' };
        }

        // Berserk bonus
        if (this.buffs.berserk > 0) dmg = Math.round(dmg * 1.30);

        // Crit check (only for damaging skills)
        let crit = false;
        if (dmg > 0 && Math.random() * 100 < this.player.critChance) {
            crit = true;
            const setB2 = calcSetBonus(this.player.equipment);
            let critMult = setB2.critMult || 1.5;
            if (this.player.hasPassive('critDmg30')) critMult += 0.3;
            if (this.player.critDmg) critMult += this.player.critDmg / 100;
            dmg = Math.round(dmg * critMult);
            // Legendary: 暴击连动
            for (const item of Object.values(this.player.equipment)) {
                if (item && item.legendaryMod && item.legendaryMod.name === '暴击连动') {
                    if (Math.random() < 0.20) this.skillCdr = true;
                }
            }
        }

        this.monster.hp -= dmg;
        const parts = [crit ? '暴击!' : '', extraMsg].filter(Boolean);
        this.log.push(`[${skill.name}] 对 ${this.monster.name} 造成 ${dmg} 伤害` + (parts.length ? ' [' + parts.join(' ') + ']' : ''));

        this.player.cooldowns[skill.key] = finalCd;

        // Lifesteal
        if (this.player.lifesteal > 0 && dmg > 0) {
            const heal = Math.round(dmg * this.player.lifesteal / 100);
            if (heal > 0) {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
                this.log.push(`吸血恢复 ${heal} HP`);
            }
        }

        if (this.monster.hp <= 0) {
            this.finished = true;
            this.playerWon = true;
            this.log.push(`击败了 ${this.monster.name}!`);
        }

        return { ok: true, msg: `施放 ${skill.name}` };
    }

    tickBuffs() {
        if (this.buffs.shieldWall > 0) this.buffs.shieldWall--;
        if (this.buffs.thorns > 0) this.buffs.thorns--;
        if (this.buffs.berserk > 0) this.buffs.berserk--;
        if (this.buffs.immune > 0) this.buffs.immune--;
        if (this.monsterFrozen > 0) this.monsterFrozen--;
    }

    playerAttack() {
        const crit = Math.random() * 100 < this.player.critChance;
        const pen = this.getPlayerPenetration();

        // Legendary: 雷霆之怒
        let doubleHit = false;
        for (const item of Object.values(this.player.equipment)) {
            if (item && item.legendaryMod && item.legendaryMod.name === '雷霆之怒') {
                if (Math.random() < 0.15) doubleHit = true;
            }
        }

        // Legendary: 处决者
        let execDmg = 1;
        for (const item of Object.values(this.player.equipment)) {
            if (item && item.legendaryMod && item.legendaryMod.name === '处决者') {
                if (this.monster.hp / this.monster.maxHp < 0.2) execDmg = 1.5;
            }
        }

        // Set bonus: critMult (暗影之刃 4件)
        const setB = calcSetBonus(this.player.equipment);
        let dmg = this.damageFormula(this.player.atk + (this.player.elemDmg || 0), this.monster.def, pen);
        dmg = Math.round(dmg * execDmg);
        if (crit) {
            let critMult = setB.critMult || 1.5;
            if (this.player.hasPassive('critDmg30')) critMult += 0.3;
            if (this.player.critDmg) critMult += this.player.critDmg / 100;
            dmg = Math.round(dmg * critMult);
            // Legendary: 暴击连动
            for (const item of Object.values(this.player.equipment)) {
                if (item && item.legendaryMod && item.legendaryMod.name === '暴击连动') {
                    if (Math.random() < 0.20) this.skillCdr = true;
                }
            }
        }
        if (doubleHit) dmg *= 2;
        // Berserk buff
        if (this.buffs.berserk > 0) dmg = Math.round(dmg * 1.30);

        this.monster.hp -= dmg;
        const parts = [];
        if (crit) parts.push('暴击!');
        if (doubleHit) parts.push('雷霆之怒!');
        if (this.buffs.berserk > 0) parts.push('狂暴');
        this.log.push(`你对 ${this.monster.name} 造成 ${dmg} 伤害` + (parts.length ? ' [' + parts.join(' ') + ']' : ''));

        // Lifesteal
        if (this.player.lifesteal > 0) {
            const heal = Math.round(dmg * this.player.lifesteal / 100);
            if (heal > 0) {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
                this.log.push(`吸血恢复 ${heal} HP`);
            }
        }

        if (this.monster.hp <= 0) {
            this.finished = true;
            this.playerWon = true;
            this.log.push(`击败了 ${this.monster.name}!`);
        }
    }

    monsterAttack() {
        // Frozen: skip attack
        if (this.monsterFrozen > 0) {
            this.log.push(`${this.monster.name} 被冰冻，无法行动!`);
            return;
        }

        // Set bonus: dmg reduction
        const setB = calcSetBonus(this.player.equipment);
        let defMult = 1 - (setB.dmgReduct || 0);

        // Dmg reduction from equipment + set bonus
        if (this.player.dmgReduct > 0) defMult *= (1 - this.player.dmgReduct / 100);
        // Shield wall buff
        if (this.buffs.shieldWall > 0) defMult *= 0.5;
        // Immune buff
        if (this.buffs.immune > 0) {
            this.log.push(`神圣领域免疫了 ${this.monster.name} 的攻击!`);
            return;
        }

        // Legendary: 金刚不坏
        const hasDiamond = Object.values(this.player.equipment).some(
            item => item && item.legendaryMod && item.legendaryMod.name === '金刚不坏'
        );

        let dmg = this.damageFormula(this.monster.atk, this.player.def + (this.player.resist || 0) * 2);
        let crit = false;
        if (Math.random() < 0.05) {
            crit = true;
            dmg = Math.round(dmg * 1.5);
            if (hasDiamond) dmg = Math.round(dmg * 0.5);
        }
        dmg = Math.round(dmg * defMult);

        // Dodge
        if (this.player.dodge > 0 && Math.random() * 100 < this.player.dodge) {
            this.log.push(`${this.monster.name} 的攻击被闪避了!`);
            // Thorns still applies even on dodge
            if (this.buffs.thorns > 0) {
                const reflect = Math.round(dmg * 0.30);
                this.monster.hp -= reflect;
                this.log.push(`荆棘甲反弹 ${reflect} 伤害`);
                if (this.monster.hp <= 0) {
                    this.finished = true;
                    this.playerWon = true;
                    this.log.push(`击败了 ${this.monster.name}!`);
                }
            }
            return;
        }

        this.player.hp -= dmg;
        let logMsg = `${this.monster.name} 对你造成 ${dmg} 伤害`;
        if (crit) logMsg += ' [暴击!]';
        if (this.buffs.shieldWall > 0) logMsg += ' [盾墙]';
        this.log.push(logMsg);

        // Thorns reflect
        if (this.buffs.thorns > 0) {
            const reflect = Math.round(dmg * 0.30);
            this.monster.hp -= reflect;
            this.log.push(`荆棘甲反弹 ${reflect} 伤害`);
            if (this.monster.hp <= 0) {
                this.finished = true;
                this.playerWon = true;
                this.log.push(`击败了 ${this.monster.name}!`);
            }
        }

        // Regen passive + set bonus
        const setB2 = calcSetBonus(this.player.equipment);
        if (this.player.hasPassive('regen5') && this.player.hp > 0) {
            const regen = Math.round(this.player.maxHp * 0.05);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + regen);
        }
        if (setB2.regen && this.player.hp > 0) {
            const regen2 = Math.round(this.player.maxHp * setB2.regen / 100);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + regen2);
        }

        // Set bonus: thorns (龙鳞之怒)
        if (setB2.thorns && dmg > 0) {
            const reflect = Math.round(dmg * setB2.thorns);
            this.monster.hp -= reflect;
            this.log.push(`龙鳞之怒反弹 ${reflect} 伤害`);
            if (this.monster.hp <= 0) {
                this.finished = true;
                this.playerWon = true;
                this.log.push(`击败了 ${this.monster.name}!`);
            }
        }

        if (this.player.hp <= 0) {
            // Legendary: 不死鸟
            if (!this.undyingUsed) {
                for (const item of Object.values(this.player.equipment)) {
                    if (item && item.legendaryMod && item.legendaryMod.name === '不死鸟') {
                        this.undyingUsed = true;
                        this.player.hp = Math.round(this.player.maxHp * 0.3);
                        this.log.push('🔥 不死鸟复活! 恢复了 30% HP');
                        return;
                    }
                }
            }
            this.finished = true;
            this.playerWon = false;
            this.log.push('你被击败了...');
        }
    }

    flee() {
        if (Math.random() < 0.5) {
            this.fled = true;
            this.finished = true;
            this.log.push('逃跑成功!');
        } else {
            this.log.push('逃跑失败!');
            this.monsterAttack();
        }
    }

    getLoot(floorLevel) {
        if (!this.playerWon) return [];
        const loot = [];

        // Determine monster type for drop table
        let monsterType = 'normal';
        if (this.monster.isBoss) monsterType = 'boss';
        else if (this.monster.isElite) monsterType = 'elite';

        // Drop rates by type
        let dropRate, dropCount;
        if (monsterType === 'boss') {
            dropRate = 1.0; dropCount = 2;
        } else if (monsterType === 'elite') {
            dropRate = 0.60; dropCount = 1;
        } else {
            dropRate = 0.30; dropCount = 1;
        }

        if (this.player.currentBlessing === 'luck') dropRate *= 1.15;

        const setB = calcSetBonus(this.player.equipment);
        if (setB.elemDmg) dropRate *= (1 + setB.elemDmg); // 元素之心

        if (Math.random() < dropRate) {
            for (let i = 0; i < dropCount; i++) {
                if (monsterType === 'boss' && i === 0) {
                    loot.push(generateEquipment(floorLevel, RARITIES.find(r => r.name === '史诗'), monsterType));
                } else {
                    loot.push(generateEquipment(floorLevel, null, monsterType));
                }
            }
        }
        return loot;
    }
}
