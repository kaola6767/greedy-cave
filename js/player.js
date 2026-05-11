class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 60;
        this.potions = 3;
        this.gold = 0;

        // 8 equipment slots
        this.equipment = {
            weapon: null, helmet: null, armor: null, gloves: null,
            boots: null, ring1: null, ring2: null, necklace: null,
        };
        this.inventory = [];

        // Derived stats (set by recalcStats)
        this.maxHp = 120;
        this.hp = 120;
        this.atk = 13;
        this.def = 6.5;
        this.critChance = 5;
        this.dodge = 0;
        this.lifesteal = 0;
        this.goldBonus = 0;
        this.xpBonus = 0;
        this.elemDmg = 0;
        this.resist = 0;

        this.recalcStats();
    }

    recalcStats() {
        const L = this.level;
        this.maxHp = Math.round(100 + L * 20);
        this.atk = Math.round(10 + L * 3);
        this.def = Math.round(5 + L * 1.5);
        this.critChance = 5;
        this.dodge = 0;
        this.lifesteal = 0;
        this.goldBonus = 0;
        this.xpBonus = 0;
        this.elemDmg = 0;
        this.resist = 0;

        for (const item of Object.values(this.equipment)) {
            if (!item) continue;
            if (item.stats) {
                this.atk += item.stats.atk || 0;
                this.def += item.stats.def || 0;
                this.maxHp += item.stats.hp || 0;
            }
            if (item.affixes) {
                for (const a of item.affixes) {
                    if (a.stat === 'atk') this.atk += a.value;
                    else if (a.stat === 'def') this.def += a.value;
                    else if (a.stat === 'hp') this.maxHp += a.value;
                    else if (a.stat === 'critChance') this.critChance += a.value;
                    else if (a.stat === 'dodge') this.dodge += a.value;
                    else if (a.stat === 'lifesteal') this.lifesteal += a.value;
                    else if (a.stat === 'goldBonus') this.goldBonus += a.value;
                    else if (a.stat === 'xpBonus') this.xpBonus += a.value;
                    else if (a.stat === 'elemDmg') this.elemDmg += a.value;
                    else if (a.stat === 'resist') this.resist += a.value;
                }
            }
        }

        // Set bonus
        const setB = calcSetBonus(this.equipment);
        if (setB.atkPct) this.atk = Math.round(this.atk * (1 + setB.atkPct));
        // dmgReduct applied in combat

        // Legendary: 不死鸟 tracked in combat

        this.hp = Math.min(this.hp, this.maxHp);
    }

    gainXp(amount) {
        const bonus = 1 + this.xpBonus / 100;
        const gained = Math.round(amount * bonus);
        this.xp += gained;
        while (this.xp >= this.xpToNext && this.level < 100) {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = Math.floor(this.xpToNext * 1.4);
            this.hp = this.maxHp;
            addLog(`🎉 升级! Lv.${this.level}`, '#ffd700');
        }
        this.xp = Math.min(this.xp, this.xpToNext);
        this.recalcStats();
    }

    equip(item) {
        const idx = this.inventory.indexOf(item);
        if (idx !== -1) this.inventory.splice(idx, 1);
        let slot = item.type.slot;
        // Auto-assign ring to ring2 if ring1 is occupied and ring2 is free
        if (slot === 'ring1' && this.equipment.ring1 && !this.equipment.ring2) {
            slot = 'ring2';
        }
        const old = this.equipment[slot];
        if (old) this.inventory.push(old);
        this.equipment[slot] = item;
        this.recalcStats();
        addLog(`装备了 ${item.fullName}`, '#ffd700');
    }

    unequip(slot) {
        const item = this.equipment[slot];
        if (!item) return;
        if (this.inventory.length >= 30) {
            addLog('背包已满!', '#ff4444');
            return;
        }
        this.equipment[slot] = null;
        this.inventory.push(item);
        this.recalcStats();
        addLog(`卸下了 ${item.fullName}`, '#888');
    }

    addToInventory(item) {
        if (this.inventory.length >= 30) {
            addLog('背包已满!', '#ff4444');
            return false;
        }
        this.inventory.push(item);
        return true;
    }

    usePotion() {
        if (this.potions <= 0) return false;
        this.potions--;
        const heal = Math.round(this.maxHp * 0.3 + rand(0, 20));
        this.hp = Math.min(this.maxHp, this.hp + heal);
        addLog(`使用药水，恢复 ${heal} HP`, '#44ff44');
        return true;
    }
}
