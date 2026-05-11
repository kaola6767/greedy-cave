// --- Global State ---
let gameState = STATE.TITLE;
let player;
let dungeon;
let combat;
let renderer;
let floorLevel = 1;
let isMobile = false;
let drawerTab = null; // 'stats', 'equip', 'inventory', 'log'

// --- DOM Elements ---
const titleScreen = document.getElementById('title-screen');
const gameScreen = document.getElementById('game-screen');
const combatModal = document.getElementById('combat-modal');
const victoryModal = document.getElementById('victory-modal');
const deadModal = document.getElementById('dead-modal');
const canvas = document.getElementById('game-canvas');
const floorIndicator = document.getElementById('floor-indicator');
const logContent = document.getElementById('log-content');
const dpad = document.getElementById('dpad');
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerContent = document.getElementById('drawer-content');
const mobileHeader = document.getElementById('mobile-header');

// --- Toast (mobile) ---
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
document.getElementById('game-screen').appendChild(toastContainer);

function showToast(msg, color) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.style.color = color || '#ccc';
    div.textContent = msg;
    toastContainer.appendChild(div);
    setTimeout(() => div.remove(), 2500);
    if (toastContainer.children.length > 5) toastContainer.firstChild.remove();
}

// --- Resize ---
function detectMobile() {
    isMobile = window.innerWidth <= 768;
}

function resizeCanvas() {
    detectMobile();
    const main = document.getElementById('game-main');
    if (isMobile) {
        const w = main.clientWidth;
        const h = main.clientHeight;
        canvas.width = w;
        canvas.height = h;
    } else {
        canvas.width = 800;
        canvas.height = 560;
    }
    if (renderer) {
        renderer.canvas = canvas;
        renderer.ctx = canvas.getContext('2d');
        renderer.render();
    }
}

// --- Utility ---
function addLog(msg, color) {
    if (isMobile) {
        showToast(msg, color);
        drawerLogBuffer.push({ msg, color });
        if (drawerLogBuffer.length > 100) drawerLogBuffer.shift();
    } else {
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.style.color = color || '#aaa';
        div.textContent = msg;
        logContent.appendChild(div);
        logContent.scrollTop = logContent.scrollHeight;
        while (logContent.children.length > 200) logContent.firstChild.remove();
    }
}

const drawerLogBuffer = [];

// --- UI Update ---
function updateUI() {
    // Desktop side panel
    if (!isMobile) {
        document.getElementById('stat-level').textContent = player.level;
        document.getElementById('stat-hp').textContent = `${player.hp}/${player.maxHp}`;
        document.getElementById('stat-atk').textContent = player.atk;
        document.getElementById('stat-def').textContent = player.def;
        document.getElementById('stat-xp').textContent = `${player.xp}/${player.xpToNext}`;
        document.getElementById('stat-potions').textContent = player.potions;
        floorIndicator.textContent = `第 ${floorLevel} 层`;

        for (const slot of ['weapon', 'helmet', 'armor', 'ring']) {
            const el = document.getElementById(`eq-${slot}`);
            const item = player.equipment[slot];
            if (item) {
                el.textContent = item.fullName;
                el.className = item.rarity.color;
            } else {
                el.textContent = '空';
                el.className = '';
            }
        }

        const invList = document.getElementById('inv-list');
        invList.innerHTML = '';
        if (player.inventory.length === 0) {
            invList.innerHTML = '<div style="color:#555;font-size:12px;padding:4px;">背包为空</div>';
        } else {
            for (let i = 0; i < player.inventory.length; i++) {
                const item = player.inventory[i];
                const div = document.createElement('div');
                div.className = 'inv-item';
                div.innerHTML = `<span class="${item.rarity.color}">${item.fullName}</span><br><span style="color:#888;font-size:11px;">${item.description()}</span>`;
                div.onclick = () => { player.equip(item); updateUI(); };
                div.title = '点击装备';
                invList.appendChild(div);
            }
        }

        // Desktop header
        document.getElementById('dh-level').textContent = player.level;
        document.getElementById('dh-hp').textContent = `${player.hp}/${player.maxHp}`;
        document.getElementById('dh-atk').textContent = player.atk;
        document.getElementById('dh-def').textContent = player.def;
        document.getElementById('dh-xp').textContent = `${player.xp}/${player.xpToNext}`;
        document.getElementById('dh-potions').textContent = player.potions;
        document.getElementById('dh-floor').textContent = `第${floorLevel}层`;
    }

    // Mobile header
    document.getElementById('mob-floor').textContent = `第${floorLevel}层`;
    document.getElementById('mob-hp-fill').style.width = `${(player.hp / player.maxHp) * 100}%`;
    document.getElementById('mob-hp-text').textContent = `${player.hp}/${player.maxHp}`;
    document.getElementById('mob-potions').textContent = `🧪${player.potions}`;

    // Combat modal HP bar
    const combatPlayerHp = document.getElementById('combat-player-hp');
    if (combatPlayerHp) {
        combatPlayerHp.style.width = `${(player.hp / player.maxHp) * 100}%`;
    }

    // Update drawer if open
    if (!drawer.classList.contains('hidden')) {
        renderDrawerContent();
    }
}

// --- Drawer ---
function openDrawer(tab) {
    drawerTab = tab;
    drawer.classList.remove('hidden');
    drawerOverlay.classList.remove('hidden');
    renderDrawerContent();
}

function closeDrawer() {
    drawer.classList.add('hidden');
    drawerOverlay.classList.add('hidden');
}

function renderDrawerContent() {
    if (!drawerTab) return;
    let html = '';

    if (drawerTab === 'stats') {
        html = `<h3>玩家状态</h3>
            <div class="stat-row"><span>等级</span><span>${player.level}</span></div>
            <div class="stat-row"><span>生命</span><span>${player.hp}/${player.maxHp}</span></div>
            <div class="stat-row"><span>攻击</span><span>${player.atk}</span></div>
            <div class="stat-row"><span>防御</span><span>${player.def}</span></div>
            <div class="stat-row"><span>经验</span><span>${player.xp}/${player.xpToNext}</span></div>
            <div class="stat-row"><span>药水</span><span>${player.potions}</span></div>`;
    } else if (drawerTab === 'equip') {
        html = '<h3>装备 (点击卸下)</h3>';
        for (const slot of ['weapon', 'helmet', 'armor', 'ring']) {
            const item = player.equipment[slot];
            const names = { weapon: '武器', helmet: '头盔', armor: '铠甲', ring: '戒指' };
            if (item) {
                html += `<div class="equip-slot" data-slot="${slot}">
                    <span>${names[slot]}</span>
                    <span class="${item.rarity.color}">${item.fullName}</span>
                </div>`;
            } else {
                html += `<div class="equip-slot"><span>${names[slot]}</span><span style="color:#555">空</span></div>`;
            }
        }
    } else if (drawerTab === 'inventory') {
        html = '<h3>背包 (点击装备)</h3>';
        if (player.inventory.length === 0) {
            html += '<div style="color:#555;padding:8px;">背包为空</div>';
        } else {
            for (let i = 0; i < player.inventory.length; i++) {
                const item = player.inventory[i];
                html += `<div class="inv-item" data-inv-idx="${i}">
                    <span class="${item.rarity.color}">${item.fullName}</span><br>
                    <span style="color:#888;font-size:12px;">${item.description()}</span>
                </div>`;
            }
        }
    } else if (drawerTab === 'log') {
        html = '<h3>消息记录</h3>';
        if (drawerLogBuffer.length === 0) {
            html += '<div style="color:#555;padding:8px;">暂无消息</div>';
        } else {
            for (const entry of [...drawerLogBuffer].reverse().slice(0, 50)) {
                html += `<div style="padding:2px 0;font-size:13px;color:${entry.color || '#aaa'}">${entry.msg}</div>`;
            }
        }
    }

    drawerContent.innerHTML = html;

    // Attach click handlers
    drawerContent.querySelectorAll('.equip-slot[data-slot]').forEach(el => {
        el.onclick = () => {
            if (player.equipment[el.dataset.slot]) {
                player.unequip(el.dataset.slot);
                updateUI();
                renderDrawerContent();
            }
        };
    });

    drawerContent.querySelectorAll('.inv-item[data-inv-idx]').forEach(el => {
        el.onclick = () => {
            const idx = parseInt(el.dataset.invIdx);
            if (idx >= 0 && idx < player.inventory.length) {
                player.equip(player.inventory[idx]);
                updateUI();
                renderDrawerContent();
            }
        };
    });
}

drawerOverlay.addEventListener('click', closeDrawer);

// --- Game Flow ---
function startGame() {
    player = new Player();
    floorLevel = 1;
    titleScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    resizeCanvas();
    addLog('你进入了地牢...', '#ffd700');
    generateFloor();
}

function generateFloor() {
    dungeon = new Dungeon(floorLevel);
    player.x = dungeon.startX;
    player.y = dungeon.startY;
    player.hp = player.maxHp;
    dungeon.updateVisibility(player.x, player.y, 7);
    renderer = new Renderer(canvas, dungeon, player);
    renderer.render();
    updateUI();
    addLog(`进入第 ${floorLevel} 层地牢`, '#ffd700');
}

function movePlayer(dx, dy) {
    if (gameState !== STATE.DUNGEON) return;
    const nx = player.x + dx;
    const ny = player.y + dy;

    if (!dungeon.isWalkable(nx, ny)) return;

    const cell = dungeon.getTile(nx, ny);
    player.x = nx;
    player.y = ny;

    if (cell.entity === ENTITY.MONSTER) {
        dungeon.removeEntity(nx, ny);
        startCombat();
    } else if (cell.entity === ENTITY.CHEST) {
        dungeon.removeEntity(nx, ny);
        openChest();
    } else if (cell.entity === ENTITY.EXIT) {
        showVictory();
    } else if (cell.entity === ENTITY.POTION) {
        dungeon.removeEntity(nx, ny);
        player.potions++;
        addLog('捡到了一瓶药水!', '#44ff44');
        updateUI();
    }

    dungeon.updateVisibility(player.x, player.y, 7);
    renderer.render();
    updateUI();
}

function startCombat() {
    gameState = STATE.COMBAT;
    const monster = generateMonster(floorLevel);
    combat = new Combat(player, monster);

    document.getElementById('combat-monster-name').textContent = `${monster.emoji} ${monster.name} (Lv.${floorLevel})`;
    document.getElementById('combat-monster-stats').textContent = `攻击:${monster.atk} 防御:${monster.def}`;
    document.getElementById('combat-monster-hp').style.width = '100%';
    document.getElementById('combat-player-hp').style.width = `${(player.hp / player.maxHp) * 100}%`;
    document.getElementById('combat-log').innerHTML = '';
    document.getElementById('btn-attack').disabled = false;
    document.getElementById('btn-potion').disabled = player.potions <= 0;
    document.getElementById('btn-flee').disabled = false;
    combatModal.classList.remove('hidden');

    addLog(`遭遇了 ${monster.emoji} ${monster.name}!`, '#ff4444');
}

function combatAction(action) {
    if (!combat || combat.finished) return;

    if (action === 'attack') {
        combat.playerAttack();
    } else if (action === 'potion') {
        if (!player.usePotion()) return;
        document.getElementById('btn-potion').disabled = player.potions <= 0;
    } else if (action === 'flee') {
        combat.flee();
    }

    updateCombatUI();

    if (!combat.finished) {
        setTimeout(() => {
            if (!combat) return;
            combat.monsterAttack();
            updateCombatUI();
            if (combat.finished) finishCombat();
        }, 400);
    } else {
        finishCombat();
    }
}

function updateCombatUI() {
    if (!combat) return;
    document.getElementById('combat-monster-hp').style.width =
        `${Math.max(0, (combat.monster.hp / combat.monster.maxHp) * 100)}%`;
    document.getElementById('combat-player-hp').style.width =
        `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;

    const logDiv = document.getElementById('combat-log');
    logDiv.innerHTML = combat.log.map(l => `<div>${l}</div>`).join('');
    logDiv.scrollTop = logDiv.scrollHeight;
}

function finishCombat() {
    document.getElementById('btn-attack').disabled = true;
    document.getElementById('btn-potion').disabled = true;
    document.getElementById('btn-flee').disabled = true;

    const wasFled = combat.fled;

    if (combat.playerWon) {
        const loot = combat.getLoot(floorLevel);
        const xpGained = combat.monster.xp;
        player.gainXp(xpGained);
        addLog(`获得 ${xpGained} 点经验`, '#ffd700');
        for (const item of loot) {
            player.addToInventory(item);
            addLog(`掉落: ${item.fullName}`, item.rarity.color);
        }
    }

    setTimeout(() => {
        combatModal.classList.add('hidden');
        combat = null;

        if (player.hp <= 0) {
            showDeath();
        } else {
            gameState = STATE.DUNGEON;
        }
        updateUI();
        if (gameState === STATE.DUNGEON) renderer.render();
    }, combat.playerWon ? 800 : 500);
}

function openChest() {
    const item = generateEquipment(floorLevel, null);
    player.addToInventory(item);
    addLog(`打开宝箱，获得: ${item.fullName}!`, item.rarity.color);
    updateUI();
}

function showVictory() {
    gameState = STATE.VICTORY;
    document.getElementById('victory-floor').textContent = floorLevel;
    victoryModal.classList.remove('hidden');
}

function showDeath() {
    gameState = STATE.DEAD;
    document.getElementById('dead-floor').textContent = floorLevel;
    deadModal.classList.remove('hidden');
    player.equipment = { weapon: null, helmet: null, armor: null, ring: null };
    player.inventory = [];
}

function nextFloor() {
    victoryModal.classList.add('hidden');
    floorLevel++;
    gameState = STATE.DUNGEON;
    generateFloor();
}

function restartGame() {
    deadModal.classList.add('hidden');
    gameScreen.classList.add('hidden');
    titleScreen.classList.remove('hidden');
    logContent.innerHTML = '';
    drawerLogBuffer.length = 0;
    gameState = STATE.TITLE;
}

// --- Event Listeners ---
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-howto').addEventListener('click', () => {
    document.getElementById('howto-panel').classList.toggle('hidden');
});
document.getElementById('btn-attack').addEventListener('click', () => combatAction('attack'));
document.getElementById('btn-potion').addEventListener('click', () => combatAction('potion'));
document.getElementById('btn-flee').addEventListener('click', () => combatAction('flee'));
document.getElementById('btn-next-floor').addEventListener('click', nextFloor);
document.getElementById('btn-restart').addEventListener('click', restartGame);

// Mobile action buttons
document.getElementById('mob-btn-stats').addEventListener('click', () => openDrawer('stats'));
document.getElementById('mob-btn-equip').addEventListener('click', () => openDrawer('equip'));
document.getElementById('mob-btn-bag').addEventListener('click', () => openDrawer('inventory'));
document.getElementById('mob-btn-log').addEventListener('click', () => openDrawer('log'));

// D-pad
document.querySelectorAll('.dpad-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const dx = parseInt(btn.dataset.dx);
        const dy = parseInt(btn.dataset.dy);
        movePlayer(dx, dy);
    });
});

// Tap / click canvas to move (works on both mobile and desktop)
canvas.addEventListener('pointerdown', (e) => {
    if (gameState !== STATE.DUNGEON) return;
    if (!renderer) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Convert screen coords to map coords (account for camera offset)
    const mapPx = sx + renderer.camX;
    const mapPy = sy + renderer.camY;
    const tx = Math.floor(mapPx / CELL_SIZE);
    const ty = Math.floor(mapPy / CELL_SIZE);

    // Find direction from player to tapped tile
    const ddx = tx - player.x;
    const ddy = ty - player.y;

    if (Math.abs(ddx) > Math.abs(ddy)) {
        movePlayer(ddx > 0 ? 1 : -1, 0);
    } else if (Math.abs(ddy) > 0) {
        movePlayer(0, ddy > 0 ? 1 : -1);
    }
});

// Keyboard
document.addEventListener('keydown', (e) => {
    if (gameState === STATE.DUNGEON) {
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': movePlayer(0, -1); e.preventDefault(); break;
            case 'ArrowDown': case 's': case 'S': movePlayer(0, 1); e.preventDefault(); break;
            case 'ArrowLeft': case 'a': case 'A': movePlayer(-1, 0); e.preventDefault(); break;
            case 'ArrowRight': case 'd': case 'D': movePlayer(1, 0); e.preventDefault(); break;
            case 'i': case 'I': if (isMobile) openDrawer('inventory'); e.preventDefault(); break;
        }
    }
    if (gameState === STATE.COMBAT && combat && !combat.finished) {
        if (e.key === '1') combatAction('attack');
        else if (e.key === '2') combatAction('potion');
        else if (e.key === '3') combatAction('flee');
    }
});

// Equip/unequip on desktop side panel click
document.querySelectorAll('#side-panel .equip-slot').forEach(slot => {
    slot.addEventListener('click', () => {
        if (player && player.equipment[slot.dataset.slot]) {
            player.unequip(slot.dataset.slot);
            updateUI();
        }
    });
});

// Resize
window.addEventListener('resize', () => {
    resizeCanvas();
    updateUI();
});

// Prevent double-tap zoom on D-pad
dpad.addEventListener('touchstart', (e) => e.preventDefault());

// Init
detectMobile();
