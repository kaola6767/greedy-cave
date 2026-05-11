class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.baseHp = 100;
        this.baseAtk = 8;
        this.baseDef = 3;
        this.maxHp = 100;
        this.hp = 100;
        this.atk = 8;
        this.def = 3;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 50;
        this.potions = 3;
        this.equipment = { weapon: null, helmet: null, armor: null, ring: null };
        this.inventory = [];
        this.critChance = 5;
    }

    recalcStats() {
        this.maxHp = this.baseHp + (this.level - 1) * 15;
        this.atk = this.baseAtk + (this.level - 1) * 2;
        this.def = this.baseDef + (this.level - 1) * 1;
        this.critChance = 5;

        for (const slot of Object.values(this.equipment)) {
            if (!slot) continue;
            this.atk += slot.atk || 0;
            this.def += slot.def || 0;
            this.maxHp += slot.hp || 0;
            if (slot.affixes) {
                for (const a of slot.affixes) {
                    if (a.stat === 'atk') this.atk += a.value;
                    else if (a.stat === 'def') this.def += a.value;
                    else if (a.stat === 'hp') this.maxHp += a.value;
                    else if (a.stat === 'critChance') this.critChance += a.value;
                }
            }
        }
        this.hp = Math.min(this.hp, this.maxHp);
    }

    gainXp(amount) {
        this.xp += amount;
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = Math.floor(this.xpToNext * 1.5);
            this.hp = this.maxHp; // full heal on level up
            addLog(`🎉 升级! 当前等级 ${this.level}`, '#ffd700');
        }
        this.recalcStats();
    }

    equip(item) {
        const idx = this.inventory.indexOf(item);
        if (idx !== -1) this.inventory.splice(idx, 1);
        const slot = item.type.slot;
        const old = this.equipment[slot];
        if (old) this.inventory.push(old);
        this.equipment[slot] = item;
        this.recalcStats();
        addLog(`装备了 ${item.fullName}`, '#ffd700');
    }

    unequip(slot) {
        const item = this.equipment[slot];
        if (!item) return;
        if (this.inventory.length >= 20) {
            addLog('背包已满!', '#ff4444');
            return;
        }
        this.equipment[slot] = null;
        this.inventory.push(item);
        this.recalcStats();
        addLog(`卸下了 ${item.fullName}`, '#888');
    }

    addToInventory(item) {
        if (this.inventory.length >= 20) {
            addLog('背包已满，无法拾取!', '#ff4444');
            return false;
        }
        this.inventory.push(item);
        return true;
    }

    usePotion() {
        if (this.potions <= 0) return false;
        this.potions--;
        const heal = 30 + rand(0, 20);
        this.hp = Math.min(this.maxHp, this.hp + heal);
        addLog(`使用了药水，恢复了 ${heal} 点生命`, '#44ff44');
        return true;
    }
}
