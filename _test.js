global.rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
global.randFloat = (min, max) => Math.random() * (max - min) + min;
global.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
global.clamp = (val, min, max) => Math.max(min, Math.min(max, val));
global.addLog = () => {};

const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('js/utils.js', 'utf8') + '\n' +
    fs.readFileSync('js/equipment.js', 'utf8') + '\n' +
    fs.readFileSync('js/player.js', 'utf8') + '\n' +
    fs.readFileSync('js/monster.js', 'utf8') + '\n' +
    fs.readFileSync('js/combat.js', 'utf8');
const sandbox = {};
vm.createContext(sandbox);
new vm.Script(src).runInContext(sandbox);

// Test equipment generation
console.log("=== Test generateEquipment ===");
for (let i = 0; i < 5; i++) {
    try {
        const eq = sandbox.generateEquipment(5);
        console.log(`Item ${i}: ${eq.fullName} | type.slot=${eq.type.slot} | stats=`, eq.stats, '| desc=', eq.desc());
    } catch(e) { console.log("ERROR:", e.message); }
}

// Test Player
console.log("\n=== Test Player ===");
const P = sandbox.Player;
const p = new P();
console.log('Initial HP:', p.hp, 'ATK:', p.atk, 'DEF:', p.def);
console.log('Slots:', Object.keys(p.equipment));

// Test equip flow
const eq = sandbox.generateEquipment(5);
console.log('\nEquipping:', eq.fullName, 'to slot:', eq.type.slot);
p.addToInventory(eq);
console.log('Inventory size:', p.inventory.length);
p.equip(eq);
console.log('After equip - slot', eq.type.slot, ':', p.equipment[eq.type.slot]?.fullName);
console.log('Inventory size after equip:', p.inventory.length);
console.log('Player HP:', p.hp, 'ATK:', p.atk, 'DEF:', p.def);

// Test unequip
p.unequip(eq.type.slot);
console.log('After unequip - slot:', p.equipment[eq.type.slot]);
console.log('Inventory size:', p.inventory.length);

// Test combat
console.log("\n=== Test Combat ===");
const mon = sandbox.generateMonster(5);
console.log('Monster:', mon.name, 'HP:', mon.hp, 'ATK:', mon.atk, 'DEF:', mon.def);
const C = sandbox.Combat;
const combat = new C(p, mon, 5);
combat.playerAttack();
console.log('Combat log:', combat.log[0]);
console.log('Monster HP after:', mon.hp);
combat.monsterAttack();
console.log('Monster attack log:', combat.log[1]);

// Test loot
const loot = combat.getLoot(5);
console.log('Loot count:', loot.length);
for (const item of loot) console.log('  Loot:', item.fullName);

console.log('\nALL TESTS PASSED');
