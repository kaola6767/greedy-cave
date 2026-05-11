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
    }

    damageFormula(atk, def) {
        const dmg = atk * (1 - def / (def + 200 + this.floorLevel * 5));
        return Math.max(1, Math.round(dmg));
    }

    playerAttack() {
        const crit = Math.random() * 100 < this.player.critChance;

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

        let dmg = this.damageFormula(this.player.atk + (this.player.elemDmg || 0), this.monster.def);
        dmg = Math.round(dmg * execDmg);
        if (crit) dmg = Math.round(dmg * 1.5);
        if (doubleHit) dmg *= 2;

        this.monster.hp -= dmg;
        const parts = [];
        if (crit) parts.push('暴击!');
        if (doubleHit) parts.push('雷霆之怒!');
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
        // Set bonus: dmg reduction
        const setB = calcSetBonus(this.player.equipment);
        let defMult = 1 - (setB.dmgReduct || 0);

        // Legendary: 金刚不坏
        const hasDiamond = Object.values(this.player.equipment).some(
            item => item && item.legendaryMod && item.legendaryMod.name === '金刚不坏'
        );

        let dmg = this.damageFormula(this.monster.atk, this.player.def);
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
            return;
        }

        this.player.hp -= dmg;
        let logMsg = `${this.monster.name} 对你造成 ${dmg} 伤害`;
        if (crit) logMsg += ' [暴击!]';
        this.log.push(logMsg);

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
        const dropRate = 0.30;
        if (Math.random() < dropRate) {
            loot.push(generateEquipment(floorLevel));
        }
        // Boss guaranteed epic+
        if (this.monster.isBoss) {
            loot.push(generateEquipment(floorLevel, RARITIES.find(r => r.name === '史诗')));
        }
        return loot;
    }
}
