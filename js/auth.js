const AUTH_KEYS = {
    users: 'greedyUsers',
    currentUser: 'greedyCurrentUser',
    savePrefix: 'greedySave_',
    displayNames: 'greedyDisplayNames',
};


function getUsers() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEYS.users)) || []; }
    catch { return []; }
}

function saveUsers(users) {
    localStorage.setItem(AUTH_KEYS.users, JSON.stringify(users));
}

function getCurrentUser() {
    return localStorage.getItem(AUTH_KEYS.currentUser);
}

function setCurrentUser(username) {
    localStorage.setItem(AUTH_KEYS.currentUser, username);
}

function clearCurrentUser() {
    localStorage.removeItem(AUTH_KEYS.currentUser);
}

function register(username, password, confirmPassword) {
    if (!username || !password) return { ok: false, msg: '用户名和密码不能为空' };
    if (username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
    if (password.length < 3) return { ok: false, msg: '密码至少3个字符' };
    if (password !== confirmPassword) return { ok: false, msg: '两次密码不一致' };

    const users = getUsers();
    if (users.find(u => u.username === username)) {
        return { ok: false, msg: '用户名已存在' };
    }
    users.push({ username, password, createdAt: Date.now() });
    saveUsers(users);
    return { ok: true, msg: '注册成功，请登录' };
}

function login(username, password) {
    if (!username || !password) return { ok: false, msg: '请输入用户名和密码' };
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (!user) return { ok: false, msg: '用户不存在' };
    if (user.password !== password) return { ok: false, msg: '密码错误' };
    setCurrentUser(username);
    return { ok: true, msg: '登录成功', username };
}

function logout() {
    clearCurrentUser();
}

function saveProgress(player, floorLevel) {
    const username = getCurrentUser();
    if (!username || !player) return;
    const save = {
        classType: player.classType,
        currentBlessing: player.currentBlessing,
        level: player.level,
        xp: player.xp,
        xpToNext: player.xpToNext,
        potions: player.potions,
        gold: player.gold || 0,
        floorLevel: floorLevel,
        equipment: player.equipment,
        inventory: player.inventory,
        savedAt: Date.now(),
    };
    localStorage.setItem(AUTH_KEYS.savePrefix + username, JSON.stringify(save));
}

function loadProgress(username) {
    try {
        const data = JSON.parse(localStorage.getItem(AUTH_KEYS.savePrefix + username));
        return data || null;
    } catch { return null; }
}

function hasSave(username) {
    return !!loadProgress(username);
}

function deleteSave(username) {
    localStorage.removeItem(AUTH_KEYS.savePrefix + username);
}

function restoreProgress(player, floorLevel) {
    const username = getCurrentUser() || '';
    const save = loadProgress(username);
    if (!save) return false;
    player.level = save.level;
    player.xp = save.xp;
    player.xpToNext = save.xpToNext;
    player.potions = save.potions;
    player.gold = save.gold || 0;
    player.equipment = save.equipment;
    player.inventory = save.inventory;
    player.currentBlessing = save.currentBlessing || null;
    player.recalcStats();
    player.hp = player.maxHp;
    return save.floorLevel || 1;
}

// --- Leaderboard (localStorage + jsonbin.io cloud sync) ---
const LB_KEY = 'greedyLeaderboard';
const LB_BIN_ID = '6a0284f8250b1311c3383705';
const LB_ACCESS_KEY = '$2a$10$Fx/eif7M7s1OaoSfbHMea.R6gnLXkQhF21vkFtSddmtIJk2R6Ni/K';
const LB_MASTER_KEY = '$2a$10$UPFaREbmCKing4RzKWSmuuhTTnt/GZ6mlkgH9U.sAWI5IAruPFn/6';

function getLeaderboard() {
    try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch { return []; }
}
function saveLeaderboard(data) {
    localStorage.setItem(LB_KEY, JSON.stringify(data));
}

async function fetchCloudLeaderboard() {
    try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${LB_BIN_ID}/latest`, {
            headers: { 'X-Access-Key': LB_ACCESS_KEY }
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.record || [];
    } catch {
        return null;
    }
}

async function pushCloudLeaderboard(data) {
    try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${LB_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': LB_MASTER_KEY,
                'X-Bin-Versioning': 'false'
            },
            body: JSON.stringify(data)
        });
        return res.ok;
    } catch {
        return false;
    }
}

function mergeLeaderboard(a, b) {
    const merged = [...a];
    for (const e of b) {
        const existing = merged.find(x => x.name === e.name);
        if (existing) {
            if (e.maxFloor > existing.maxFloor) existing.maxFloor = e.maxFloor;
            if (e.updatedAt > existing.updatedAt) existing.updatedAt = e.updatedAt;
        } else {
            merged.push({ name: e.name, maxFloor: e.maxFloor, updatedAt: e.updatedAt });
        }
    }
    return merged;
}

function updateMaxFloor(floorLevel) {
    const username = getCurrentUser();
    if (!username) return { ok: false, msg: '未登录' };
    const lb = getLeaderboard();
    const entry = lb.find(e => e.name === username);
    if (entry && floorLevel > entry.maxFloor) {
        entry.maxFloor = floorLevel;
        entry.updatedAt = Date.now();
    } else if (!entry) {
        lb.push({ name: username, maxFloor: floorLevel, updatedAt: Date.now() });
    } else {
        return { ok: false, msg: '未超过最高记录' };
    }
    saveLeaderboard(lb);
    pushCloudLeaderboard(lb);
    return { ok: true };
}

async function syncLeaderboard() {
    const cloud = await fetchCloudLeaderboard();
    if (cloud && cloud.length > 0) {
        const local = getLeaderboard();
        const merged = mergeLeaderboard(local, cloud);
        saveLeaderboard(merged);
        pushCloudLeaderboard(merged);
        return merged;
    }
    const local = getLeaderboard();
    if (local.length > 0) pushCloudLeaderboard(local);
    return local;
}

function getTopLeaderboard(n) {
    return getLeaderboard().sort((a, b) => b.maxFloor - a.maxFloor).slice(0, n);
}

function exportLeaderboard() {
    return JSON.stringify(getLeaderboard(), null, 2);
}

function importLeaderboard(json) {
    try {
        const data = JSON.parse(json);
        if (!Array.isArray(data)) return false;
        const lb = getLeaderboard();
        const merged = mergeLeaderboard(lb, data);
        saveLeaderboard(merged);
        return true;
    } catch { return false; }
}

// --- Display Name ---
function getDisplayNames() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEYS.displayNames)) || {}; }
    catch { return {}; }
}

function getDisplayName(username) {
    const names = getDisplayNames();
    return names[username] || username;
}

function setDisplayName(username, displayName) {
    const names = getDisplayNames();
    names[username] = displayName;
    localStorage.setItem(AUTH_KEYS.displayNames, JSON.stringify(names));
}
