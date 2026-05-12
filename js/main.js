// --- Global State ---
let gameState = STATE.TITLE;
let player;
let dungeon;
let combat;
let renderer;
let floorLevel = 1;
let isMobile = false;
let drawerTab = null;
const GAME_VERSION = 'v2.03';
let restUsed = false;
let lastMoveTime = 0;
let lastCombatTime = 0;
let heldDir = null;
let moveInterval = null;

// --- DOM Elements ---
const titleScreen = document.getElementById('title-screen');
const townScreen = document.getElementById('town-screen');
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
    const w = main.clientWidth || window.innerWidth;
    const h = main.clientHeight || window.innerHeight - 80;
    canvas.width = Math.max(w, 300);
    canvas.height = Math.max(h, 300);
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
    // Always update panel content (CSS handles mobile/desktop visibility)
    document.getElementById('stat-level').textContent = player.level;
    document.getElementById('stat-hp').textContent = `${player.hp}/${player.maxHp}`;
    document.getElementById('stat-atk').textContent = player.atk;
    document.getElementById('stat-def').textContent = player.def;
    document.getElementById('stat-xp').textContent = `${player.xp}/${player.xpToNext}`;
    document.getElementById('stat-potions').textContent = player.potions;
    document.getElementById('stat-gold').textContent = player.gold || 0;
    if (dungeon && gameState === STATE.DUNGEON && !dungeon.isBossFloor) {
        const pct = dungeon.getKillPct();
        const exitLabel = dungeon.exitPlaced ? ' ✅出口已开' : '';
        floorIndicator.textContent = `第 ${floorLevel} 层 | 击杀 ${pct}%${exitLabel}`;
    } else if (dungeon && dungeon.isBossFloor) {
        floorIndicator.textContent = `第 ${floorLevel} 层 | BOSS层`;
    } else {
        floorIndicator.textContent = `第 ${floorLevel} 层`;
    }

    for (const slot of ['weapon','helmet','armor','gloves','boots','ring1','ring2','necklace']) {
        const el = document.getElementById(`eq-${slot}`);
        if (!el) continue;
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
            div.innerHTML = `<span class="${item.rarity.color}">${item.fullName}</span><br><span style="color:#888;font-size:11px;">${item.desc()}</span>`;
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

    // Mobile header
    document.getElementById('mob-floor').textContent = `第${floorLevel}层`;
    const mobHpEl = document.getElementById('mob-hp-fill');
    mobHpEl.style.width = `${(player.hp / player.maxHp) * 100}%`;
    updateHpBarColor(mobHpEl, player.hp / player.maxHp);
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
    const SLOTS = ['weapon','helmet','armor','gloves','boots','ring1','ring2','necklace'];
    const SLOT_NAMES = { weapon:'武器',helmet:'头盔',armor:'铠甲',gloves:'护手',boots:'靴子',ring1:'戒指1',ring2:'戒指2',necklace:'项链' };

    if (drawerTab === 'stats') {
        html = `<h3>玩家状态</h3>
            <div class="stat-row"><span>等级</span><span>${player.level}</span></div>
            <div class="stat-row"><span>生命</span><span>${player.hp}/${player.maxHp}</span></div>
            <div class="stat-row"><span>攻击</span><span>${player.atk}</span></div>
            <div class="stat-row"><span>防御</span><span>${player.def}</span></div>
            <div class="stat-row"><span>经验</span><span>${player.xp}/${player.xpToNext}</span></div>
            <div class="stat-row"><span>药水</span><span>${player.potions}</span></div>
            <div class="stat-row"><span>金币</span><span>${player.gold||0}</span></div>`;
    } else if (drawerTab === 'equip') {
        html = '<h3>装备 (点击卸下)</h3>';
        for (const slot of SLOTS) {
            const item = player.equipment[slot];
            if (item) {
                html += `<div class="equip-slot" data-slot="${slot}">
                    <span>${SLOT_NAMES[slot]}</span>
                    <span class="${item.rarity.color}">${item.fullName}</span>
                </div>`;
            } else {
                html += `<div class="equip-slot"><span>${SLOT_NAMES[slot]}</span><span style="color:#555">空</span></div>`;
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
                    <span style="color:#888;font-size:12px;">${item.desc()}</span>
                </div>`;
            }
        }
    } else if (drawerTab === 'log') {
        html = '<h3>消息记录</h3>';
        if (drawerLogBuffer.length === 0) {
            html += '<div style="color:#555;padding:8px;">暂无消息</div>';
        } else {
            for (const entry of [...drawerLogBuffer].reverse().slice(0, 50)) {
                html += `<div style="padding:2px 0;font-size:13px;color:${entry.color||'#aaa'}">${entry.msg}</div>`;
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
function startNewGame() {
    const username = getCurrentUser();
    deleteSave(username);
    // Show class selection instead of immediately starting
    document.getElementById('class-select').classList.remove('hidden');
    document.getElementById('logged-section').classList.add('hidden');
}

function selectClass(classType) {
    document.getElementById('class-select').classList.add('hidden');
    document.getElementById('logged-section').classList.remove('hidden');
    player = new Player(classType);
    floorLevel = 1;
    restUsed = false;
    titleScreen.classList.add('hidden');
    const cd = player.getClassData();
    addLog(`选择了职业: ${cd.icon} ${cd.name}`, '#ffd700');
    showTown();
}

function continueGame() {
    const username = getCurrentUser();
    const save = loadProgress(username);
    const classType = (save && save.classType) || null;
    player = new Player(classType);
    const savedFloor = restoreProgress(player, floorLevel);
    floorLevel = savedFloor || 1;
    // Re-apply saved level/xp to unlock skills
    if (save) {
        player.level = save.level || 1;
        player.xp = save.xp || 0;
        player.xpToNext = save.xpToNext || 60;
        player.checkSkillUnlocks(0);
    }
    restUsed = false;
    titleScreen.classList.add('hidden');
    showTown();
}

function showTown() {
    gameState = STATE.TOWN;
    townScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    combatModal.classList.add('hidden');
    victoryModal.classList.add('hidden');
    deadModal.classList.add('hidden');
    updateTownUI();
}

function updateTownUI() {
    if (!player) return;
    document.getElementById('town-level').textContent = player.level;
    document.getElementById('town-hp').textContent = `${player.hp}/${player.maxHp}`;
    document.getElementById('town-atk').textContent = player.atk;
    document.getElementById('town-def').textContent = player.def;
    document.getElementById('town-xp').textContent = `${player.xp}/${player.xpToNext}`;
    document.getElementById('town-potions').textContent = player.potions;
    const displayName = getDisplayName(getCurrentUser());
    document.getElementById('town-gold').textContent = player.gold || 0;
    const cd = player.getClassData();
    const classLabel = cd ? `${cd.icon} ${cd.name} ` : '';
    document.getElementById('town-floor').textContent = `${GAME_VERSION} | 第${floorLevel}层 | ${classLabel}${displayName}`;

    // Equipment
    for (const slot of ['weapon','helmet','armor','gloves','boots','ring1','ring2','necklace']) {
        const el = document.getElementById(`teq-${slot}`);
        const item = player.equipment[slot];
        if (item) {
            el.textContent = item.fullName;
            el.className = item.rarity.color;
        } else {
            el.textContent = '空';
            el.className = '';
        }
    }

    // Town inventory list
    const invList = document.getElementById('town-inv-list');
    invList.innerHTML = '';
    if (player.inventory.length === 0) {
        invList.innerHTML = '<div style="color:#555;font-size:12px;padding:4px;">背包为空</div>';
    } else {
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            const div = document.createElement('div');
            div.className = 'inv-item';
            div.innerHTML = `<span class="${item.rarity.color}">${item.fullName}</span><br><span style="color:#888;font-size:11px;">${item.desc()}</span>`;
            div.onclick = () => { player.equip(item); updateTownUI(); };
            div.title = '点击装备';
            invList.appendChild(div);
        }
    }
}

async function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '<div style="color:#888;padding:8px;">☁️ 正在同步云端排行...</div>';

    await syncLeaderboard();

    const top = getTopLeaderboard(10);
    let html = '';
    if (top.length === 0) {
        html = '<div style="color:#555;padding:8px;">暂无记录，快去冲榜吧!</div>';
    } else {
        const medals = ['🥇','🥈','🥉'];
        for (let i = 0; i < top.length; i++) {
            const e = top[i];
            const dn = getDisplayName(e.name);
            const medal = i < 3 ? medals[i] : `${i + 1}`;
            html += `<div class="lb-row"><span class="lb-rank">${medal}</span><span class="lb-name">${dn}</span><span class="lb-floor">${e.maxFloor}层</span></div>`;
        }
    }
    html += '<div style="margin-top:10px;display:flex;gap:6px;"><button id="btn-refresh-lb" class="btn-small">🔄 刷新</button><button id="btn-export-lb" class="btn-small">📤 导出</button><button id="btn-import-lb" class="btn-small">📥 导入</button></div>';
    list.innerHTML = html;
    document.getElementById('btn-refresh-lb').onclick = () => renderLeaderboard();
    document.getElementById('btn-export-lb').onclick = () => {
        const json = exportLeaderboard();
        navigator.clipboard.writeText(json).then(() => addLog('排行榜已复制到剪贴板!', '#44ff44'));
    };
    document.getElementById('btn-import-lb').onclick = () => {
        const json = prompt('粘贴排行榜数据:');
        if (json && importLeaderboard(json)) {
            renderLeaderboard();
            addLog('排行榜已合并!', '#44ff44');
        } else if (json) {
            addLog('格式错误!', '#ff4444');
        }
    };
}

function renderCodex() {
    let html = '<div class="codex-list">';
    const types = [
        { label: '武器', items: WEAPON_NAMES },
        { label: '头盔', items: HELMET_NAMES },
        { label: '铠甲', items: ARMOR_NAMES },
        { label: '护手', items: GLOVES_NAMES },
        { label: '靴子', items: BOOTS_NAMES },
        { label: '戒指', items: RING_NAMES },
        { label: '项链', items: NECKLACE_NAMES },
    ];
    for (const t of types) {
        html += `<div class="codex-section"><strong>${t.label}</strong>: ${t.items.join(' / ')}</div>`;
    }
    html += '<div class="codex-section"><strong>品质</strong>: 普通 | 稀有 | 黄金 | 史诗 | 传说</div>';
    html += '<div class="codex-section"><strong>传说词缀</strong>: 处决者 不死鸟 时空裂隙 吸血之王 金刚不坏 雷霆之怒</div>';
    html += '</div>';
    document.getElementById('codex-content').innerHTML = html;
}

function enterDungeon() {
    gameState = STATE.DUNGEON;
    townScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    saveProgress(player, floorLevel);
    restUsed = false;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            resizeCanvas();
            addLog('进入了地牢...', '#ffd700');
            generateFloor();
        });
    });
}

function returnToTown() {
    saveProgress(player, floorLevel);
    gameState = STATE.TOWN;
    player.hp = player.maxHp; // auto-heal when returning to town
    showTown();
}

function generateFloor() {
    dungeon = new Dungeon(floorLevel);
    player.x = dungeon.startX;
    player.y = dungeon.startY;
    player.hp = player.maxHp;
    renderer = new Renderer(canvas, dungeon, player);
    dungeon.updateVisibility(player.x, player.y, renderer.visionCells || 10);
    renderer.render();
    updateUI();
    if (floorLevel % 10 === 0) {
        addLog(`⚠️ 第${floorLevel}层 - Boss层! 击败Boss后出口开启!`, '#ff4444');
    } else {
        addLog(`进入第 ${floorLevel} 层 (需击杀60%怪物开启出口)`, '#ffd700');
    }
}

function startHeldMove(dx, dy) {
    if (gameState !== STATE.DUNGEON) return;
    heldDir = { dx, dy };
    if (moveInterval) clearInterval(moveInterval);
    moveInterval = setInterval(() => tryMove(dx, dy), 150);
    tryMove(dx, dy); // immediate first move
}

function stopHeldMove() {
    heldDir = null;
    if (moveInterval) { clearInterval(moveInterval); moveInterval = null; }
}

function tryMove(dx, dy) {
    if (gameState !== STATE.DUNGEON) { stopHeldMove(); return; }
    if (!heldDir) return;
    movePlayer(dx, dy);
}

function movePlayer(dx, dy) {
    if (gameState !== STATE.DUNGEON) return;
    const now = performance.now();
    if (now - lastMoveTime < 120) return;
    lastMoveTime = now;
    const nx = player.x + dx;
    const ny = player.y + dy;

    if (!dungeon.isWalkable(nx, ny)) return;

    const cell = dungeon.getTile(nx, ny);
    player.x = nx;
    player.y = ny;

    if (cell.entity === ENTITY.MONSTER) {
        const monsterData = cell.monsterData;
        dungeon.removeEntity(nx, ny);
        startCombat(monsterData);
    } else if (cell.entity === ENTITY.SILVER_CHEST) {
        dungeon.removeEntity(nx, ny);
        openChest('silver');
    } else if (cell.entity === ENTITY.GOLD_CHEST) {
        dungeon.removeEntity(nx, ny);
        openChest('gold');
    } else if (cell.entity === ENTITY.EXIT) {
        showVictory();
    } else if (cell.entity === ENTITY.POTION) {
        dungeon.removeEntity(nx, ny);
        player.potions++;
        addLog('捡到了一瓶药水!', '#44ff44');
        updateUI();
    }

    dungeon.updateVisibility(player.x, player.y, renderer.visionCells || 10);
    renderer.render();
    updateUI();
}

function startCombat(monsterData) {
    gameState = STATE.COMBAT;
    const monster = monsterData || generateMonster(floorLevel);
    combat = new Combat(player, monster, floorLevel);

    document.getElementById('combat-monster-name').innerHTML = `<span class="combat-emoji">${monster.emoji}</span> ${monster.name} <span class="combat-lv">Lv.${floorLevel}</span>`;
    document.getElementById('combat-monster-stats').textContent = `攻击:${monster.atk}  防御:${monster.def}`;
    document.getElementById('combat-monster-hp').style.width = '100%';
    document.getElementById('combat-monster-hp').style.background = '#e04040';
    document.getElementById('combat-player-hp').style.width = `${(player.hp / player.maxHp) * 100}%`;
    updateHpBarColor(document.getElementById('combat-player-hp'), player.hp / player.maxHp);
    document.getElementById('combat-log').innerHTML = '';
    document.getElementById('btn-attack').disabled = false;
    document.getElementById('btn-potion').disabled = player.potions <= 0;
    document.getElementById('btn-flee').disabled = false;
    renderSkillButtons();
    combatModal.classList.remove('hidden');

    addLog(`遭遇了 ${monster.emoji} ${monster.name}!`, '#ff4444');
}

function renderSkillButtons() {
    const container = document.getElementById('skill-buttons');
    const skills = player.getActiveSkills();
    let html = '';
    for (const s of skills) {
        const cd = player.cooldowns[s.key] || 0;
        if (cd > 0) {
            html += `<button class="btn-skill" disabled>${s.icon} ${s.name} (${cd})</button>`;
        } else {
            html += `<button class="btn-skill" data-skill="${s.key}">${s.icon} ${s.name}</button>`;
        }
    }
    container.innerHTML = html;
    container.querySelectorAll('.btn-skill[data-skill]').forEach(btn => {
        btn.addEventListener('click', () => combatSkill(btn.dataset.skill));
    });
}

function updateHpBarColor(el, ratio) {
    if (ratio > 0.6) el.style.background = '#4caf50';
    else if (ratio > 0.3) el.style.background = '#ff9800';
    else el.style.background = '#e04040';
}

function combatAction(action) {
    if (!combat || combat.finished) return;
    const now = performance.now();
    if (now - lastCombatTime < 1000) return;
    lastCombatTime = now;

    if (action === 'attack') {
        combat.playerAttack();
    } else if (action === 'potion') {
        if (!player.usePotion()) return;
        document.getElementById('btn-potion').disabled = player.potions <= 0;
    } else if (action === 'flee') {
        combat.flee();
    }

    // Tick buffs and cooldowns after player action
    combat.tickBuffs();
    player.tickCooldowns();

    updateCombatUI();
    renderSkillButtons();

    if (!combat.finished) {
        setTimeout(() => {
            if (!combat) return;
            combat.monsterAttack();
            combat.tickBuffs();
            player.tickCooldowns();
            updateCombatUI();
            renderSkillButtons();
            if (combat.finished) finishCombat();
        }, 400);
    } else {
        finishCombat();
    }
}

function combatSkill(skillKey) {
    if (!combat || combat.finished) return;
    const now = performance.now();
    if (now - lastCombatTime < 1000) return;
    lastCombatTime = now;

    const skill = player.getActiveSkills().find(s => s.key === skillKey);
    if (!skill) return;
    const result = combat.useSkill(skill);
    if (!result.ok) {
        addLog(result.msg, '#ff8888');
        return;
    }

    combat.tickBuffs();
    player.tickCooldowns();

    updateCombatUI();
    renderSkillButtons();

    if (!combat.finished) {
        setTimeout(() => {
            if (!combat) return;
            combat.monsterAttack();
            combat.tickBuffs();
            player.tickCooldowns();
            updateCombatUI();
            renderSkillButtons();
            if (combat.finished) finishCombat();
        }, 400);
    } else {
        finishCombat();
    }
}

function updateCombatUI() {
    if (!combat) return;
    const mhpRatio = Math.max(0, combat.monster.hp / combat.monster.maxHp);
    const phpRatio = Math.max(0, player.hp / player.maxHp);

    const mhpEl = document.getElementById('combat-monster-hp');
    const phpEl = document.getElementById('combat-player-hp');
    mhpEl.style.width = `${mhpRatio * 100}%`;
    phpEl.style.width = `${phpRatio * 100}%`;
    updateHpBarColor(phpEl, phpRatio);
    updateHpBarColor(mhpEl, mhpRatio);

    const logDiv = document.getElementById('combat-log');
    logDiv.innerHTML = combat.log.map(l => `<div>${l}</div>`).join('');
    logDiv.scrollTop = logDiv.scrollHeight;
}

function finishCombat() {
    document.getElementById('btn-attack').disabled = true;
    document.getElementById('btn-potion').disabled = true;
    document.getElementById('btn-flee').disabled = true;
    document.getElementById('skill-buttons').querySelectorAll('button').forEach(b => b.disabled = true);

    const wasFled = combat.fled;

    if (combat.playerWon) {
        dungeon.onMonsterKilled();
        if (!dungeon.isBossFloor && dungeon.exitPlaced) {
            const pct = dungeon.getKillPct();
            if (pct >= 60) addLog(`🚪 已击杀${pct}%怪物，出口已开启!`, '#00ff88');
        }
        if (dungeon.isBossFloor && dungeon.exitPlaced) {
            addLog('🚪 Boss已击败，出口已开启!', '#00ff88');
        }
        const loot = combat.getLoot(floorLevel);
        const xpGained = combat.monster.xp;
        const goldGained = combat.monster.gold || 0;
        player.gainXp(xpGained);
        player.gold += goldGained;
        addLog(`获得 ${xpGained} 经验, ${goldGained} 金币`, '#ffd700');
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

function openChest(type) {
    if (type === 'gold') {
        const item1 = generateEquipment(floorLevel, RARITIES.find(r => r.name === '稀有'));
        const item2 = generateEquipment(floorLevel, null);
        player.addToInventory(item1);
        player.addToInventory(item2);
        addLog(`打开黄金宝箱!`, '#ffd700');
        addLog(`获得: ${item1.fullName}!`, item1.rarity.color);
        addLog(`获得: ${item2.fullName}!`, item2.rarity.color);
    } else {
        const item = generateEquipment(floorLevel, null);
        player.addToInventory(item);
        addLog(`打开白银宝箱，获得: ${item.fullName}!`, item.rarity.color);
    }
    updateUI();
}

function showVictory() {
    gameState = STATE.VICTORY;
    document.getElementById('victory-floor').textContent = floorLevel;
    victoryModal.classList.remove('hidden');
}

function showDeath() {
    gameState = STATE.DEAD;

    // Death penalty: back to floor 1, lose 20% equipment
    const allItems = [];
    // Collect all equipped items
    for (const slot of Object.keys(player.equipment)) {
        if (player.equipment[slot]) allItems.push({ slot, item: player.equipment[slot] });
    }
    // Collect inventory indices
    for (let i = 0; i < player.inventory.length; i++) {
        allItems.push({ slot: null, invIdx: i, item: player.inventory[i] });
    }

    const loseCount = Math.max(1, Math.floor(allItems.length * 0.20));
    const lostItems = [];
    const shuffled = allItems.sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(loseCount, shuffled.length); i++) {
        const entry = shuffled[i];
        lostItems.push(entry.item.fullName);
        if (entry.slot) {
            player.equipment[entry.slot] = null;
        } else if (entry.invIdx !== undefined) {
            // Mark for removal (will be cleaned below)
            shuffled[i]._remove = true;
        }
    }

    // Rebuild inventory without lost items
    player.inventory = player.inventory.filter((item, idx) => {
        return !lostItems.some((_, i) => shuffled[i].invIdx === idx && shuffled[i]._remove);
    });

    player.recalcStats();
    floorLevel = 1;
    saveProgress(player, floorLevel);

    const lostStr = lostItems.length > 0 ? `\n装备掉落: ${lostItems.join(', ')}` : '';
    document.getElementById('dead-info').textContent = `你回到了第1层，损失了20%装备${lostStr}`;
    document.getElementById('dead-floor').textContent = floorLevel;
    deadModal.classList.remove('hidden');
}

function nextFloor() {
    victoryModal.classList.add('hidden');
    floorLevel++;
    gameState = STATE.DUNGEON;
    saveProgress(player, floorLevel);
    const result = updateMaxFloor(floorLevel);
    if (result.ok) addLog('🏆 排行榜已更新!', '#ffd700');
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

// Auth tabs
let authMode = 'login';
document.getElementById('tab-login').addEventListener('click', () => {
    authMode = 'login';
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('auth-confirm').classList.add('hidden');
    document.getElementById('btn-auth-submit').textContent = '登录';
    document.getElementById('auth-error').textContent = '';
});
document.getElementById('tab-register').addEventListener('click', () => {
    authMode = 'register';
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('auth-confirm').classList.remove('hidden');
    document.getElementById('btn-auth-submit').textContent = '注册';
    document.getElementById('auth-error').textContent = '';
});

// Auth submit (login or register)
document.getElementById('btn-auth-submit').addEventListener('click', () => {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');

    let result;
    if (authMode === 'register') {
        const confirm = document.getElementById('auth-confirm').value;
        result = register(username, password, confirm);
        if (result.ok) {
            authMode = 'login';
            document.getElementById('tab-login').click();
        }
    } else {
        result = login(username, password);
    }

    errorEl.textContent = result.msg;
    errorEl.style.color = result.ok ? '#44ff44' : '#ff4444';

    if (result.ok && authMode === 'login') {
        showLoggedIn(result.username);
    }
});

// Enter key on password fields
document.getElementById('auth-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-auth-submit').click();
});
document.getElementById('auth-confirm').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-auth-submit').click();
});

// Logout
document.getElementById('btn-logout').addEventListener('click', () => {
    logout();
    showLoggedOut();
});

// Town buttons
document.getElementById('btn-enter-dungeon').addEventListener('click', enterDungeon);
// Leaderboard
document.getElementById('btn-town-leaderboard').addEventListener('click', () => {
    document.getElementById('town-codex').classList.add('hidden');
    document.getElementById('town-equipment').classList.add('hidden');
    const panel = document.getElementById('town-leaderboard');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) renderLeaderboard();
});
document.getElementById('btn-town-codex').addEventListener('click', () => {
    document.getElementById('town-leaderboard').classList.add('hidden');
    document.getElementById('town-equipment').classList.add('hidden');
    const panel = document.getElementById('town-codex');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) renderCodex();
});
document.getElementById('btn-change-name').addEventListener('click', () => {
    const username = getCurrentUser();
    const current = getDisplayName(username);
    const newName = prompt('输入新昵称:', current);
    if (newName && newName.trim()) {
        setDisplayName(username, newName.trim());
        updateTownUI();
    }
});

document.getElementById('btn-town-equip').addEventListener('click', () => {
    document.getElementById('town-leaderboard').classList.add('hidden');
    document.getElementById('town-codex').classList.add('hidden');
    document.getElementById('town-equipment').classList.toggle('hidden');
});
document.getElementById('btn-town-logout').addEventListener('click', () => {
    logout();
    townScreen.classList.add('hidden');
    showLoggedOut();
});

// Town equip slots
document.querySelectorAll('#town-equipment .equip-slot').forEach(slot => {
    slot.addEventListener('click', () => {
        if (player && player.equipment[slot.dataset.slot]) {
            player.unequip(slot.dataset.slot);
            updateTownUI();
        }
    });
});

// Return to town (dungeon)
document.getElementById('btn-return-town').addEventListener('click', () => {
    if (gameState === STATE.DUNGEON) returnToTown();
});
document.getElementById('mob-btn-return').addEventListener('click', () => {
    if (gameState === STATE.DUNGEON) returnToTown();
});

// Game actions
document.getElementById('btn-start').addEventListener('click', startNewGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);

document.getElementById('btn-howto').addEventListener('click', () => {
    document.getElementById('howto-panel').classList.toggle('hidden');
});
document.getElementById('btn-attack').addEventListener('click', () => combatAction('attack'));
document.getElementById('btn-potion').addEventListener('click', () => combatAction('potion'));
document.getElementById('btn-flee').addEventListener('click', () => combatAction('flee'));
document.getElementById('btn-next-floor').addEventListener('click', nextFloor);
document.getElementById('btn-next-back-town').addEventListener('click', () => {
    victoryModal.classList.add('hidden');
    returnToTown();
});
document.getElementById('btn-back-town-dead').addEventListener('click', () => {
    deadModal.classList.add('hidden');
    returnToTown();
});

// Mobile action buttons
document.getElementById('mob-btn-stats').addEventListener('click', () => openDrawer('stats'));
document.getElementById('mob-btn-equip').addEventListener('click', () => openDrawer('equip'));
document.getElementById('mob-btn-bag').addEventListener('click', () => openDrawer('inventory'));
document.getElementById('mob-btn-log').addEventListener('click', () => openDrawer('log'));

// D-pad — hold to move continuously
document.querySelectorAll('.dpad-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const dx = parseInt(btn.dataset.dx);
        const dy = parseInt(btn.dataset.dy);
        startHeldMove(dx, dy);
    });
    btn.addEventListener('pointerup', (e) => {
        e.preventDefault();
        stopHeldMove();
    });
    btn.addEventListener('pointerleave', (e) => {
        stopHeldMove();
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

// Keyboard — keydown starts held movement
document.addEventListener('keydown', (e) => {
    if (e.repeat) return; // ignore OS key repeat
    if (gameState === STATE.DUNGEON) {
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': e.preventDefault(); startHeldMove(0, -1); break;
            case 'ArrowDown': case 's': case 'S': e.preventDefault(); startHeldMove(0, 1); break;
            case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); startHeldMove(-1, 0); break;
            case 'ArrowRight': case 'd': case 'D': e.preventDefault(); startHeldMove(1, 0); break;
            case 'i': case 'I': if (isMobile) openDrawer('inventory'); e.preventDefault(); break;
        }
    }
    if (gameState === STATE.COMBAT && combat && !combat.finished) {
        if (e.key === '1') combatAction('attack');
        else if (e.key === '2') combatAction('potion');
        else if (e.key === '3') combatAction('flee');
        else if (e.key === '4') { const skills = player.getActiveSkills(); if (skills[0]) combatSkill(skills[0].key); }
        else if (e.key === '5') { const skills = player.getActiveSkills(); if (skills[1]) combatSkill(skills[1].key); }
        else if (e.key === '6') { const skills = player.getActiveSkills(); if (skills[2]) combatSkill(skills[2].key); }
        else if (e.key === '7') { const skills = player.getActiveSkills(); if (skills[3]) combatSkill(skills[3].key); }
    }
});

// Keyboard — keyup stops held movement
document.addEventListener('keyup', (e) => {
    switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
        case 'ArrowDown': case 's': case 'S':
        case 'ArrowLeft': case 'a': case 'A':
        case 'ArrowRight': case 'd': case 'D':
            stopHeldMove(); break;
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

// --- Auth UI ---
function showLoggedIn(username) {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('logged-section').classList.remove('hidden');
    document.getElementById('welcome-msg').textContent = `欢迎，${getDisplayName(username)}!`;
    document.getElementById('btn-continue').classList.toggle('hidden', !hasSave(username));
}

function showLoggedOut() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('logged-section').classList.add('hidden');
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-confirm').value = '';
    document.getElementById('auth-error').textContent = '';
    gameState = STATE.TITLE;
}

// Class selection
document.querySelectorAll('.class-card').forEach(card => {
    card.addEventListener('click', () => selectClass(card.dataset.class));
});

// --- Init ---
detectMobile();
document.getElementById('title-version').textContent = GAME_VERSION;

// Auto-login if session exists
const savedUser = getCurrentUser();
if (savedUser) {
    document.getElementById('auth-username').value = savedUser;
    showLoggedIn(savedUser);
}
