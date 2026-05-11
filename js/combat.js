class Combat {
    constructor(player, monster) {
        this.player = player;
        this.monster = monster;
        this.log = [];
        this.finished = false;
        this.playerWon = false;
        this.fled = false;
    }

    playerAttack() {
        const crit = Math.random() * 100 < this.player.critChance;
        const baseDmg = this.player.atk - Math.floor(this.monster.def * 0.5);
        const dmg = Math.max(1, baseDmg + rand(-3, 3));
        const finalDmg = crit ? Math.floor(dmg * 1.5) : dmg;

        this.monster.hp -= finalDmg;
        const critText = crit ? ' 💥暴击!' : '';
        this.log.push(`你对 ${this.monster.name} 造成了 ${finalDmg} 点伤害${critText}`);

        if (this.monster.hp <= 0) {
            this.finished = true;
            this.playerWon = true;
            this.log.push(`你击败了 ${this.monster.name}!`);
        }
    }

    monsterAttack() {
        const baseDmg = this.monster.atk - Math.floor(this.player.def * 0.5);
        const dmg = Math.max(1, baseDmg + rand(-2, 2));
        this.player.hp -= dmg;
        this.log.push(`${this.monster.name} 对你造成了 ${dmg} 点伤害`);

        if (this.player.hp <= 0) {
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
        if (Math.random() < dropRate * 0.5) {
            loot.push(generateEquipment(floorLevel));
        }
        return loot;
    }
}
