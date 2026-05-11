const AUTH_KEYS = {
    users: 'greedyUsers',
    currentUser: 'greedyCurrentUser',
    savePrefix: 'greedySave_',
    displayNames: 'greedyDisplayNames',
};

const LB_URL = 'https://jsonblob.com/api/jsonBlob/019e17b0-de2b-7128-86f1-197c63cf678b';
let leaderboardCache = null;

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
    player.recalcStats();
    player.hp = player.maxHp;
    return save.floorLevel || 1;
}

// --- Leaderboard (jsonblob.com — free, no auth) ---
async function fetchLeaderboard() {
    try {
        const resp = await fetch(LB_URL + '?t=' + Date.now());
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        leaderboardCache = data;
        return data;
    } catch (e) {
        console.log('LB fetch failed:', e.message);
        return leaderboardCache || [];
    }
}

async function saveLeaderboardRemote(data) {
    try {
        const resp = await fetch(LB_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (resp.ok) {
            leaderboardCache = data;
            return { ok: true };
        }
        return { ok: false, msg: 'HTTP ' + resp.status };
    } catch (e) {
        return { ok: false, msg: e.message };
    }
}

async function updateMaxFloor(floorLevel) {
    const username = getCurrentUser();
    if (!username) return { ok: false, msg: '未登录' };
    const lb = await fetchLeaderboard();
    const entry = lb.find(e => e.name === username);
    if (entry && floorLevel > entry.maxFloor) {
        entry.maxFloor = floorLevel;
        entry.updatedAt = Date.now();
        return await saveLeaderboardRemote(lb);
    } else if (!entry) {
        lb.push({ name: username, maxFloor: floorLevel, updatedAt: Date.now() });
        return await saveLeaderboardRemote(lb);
    }
    return { ok: false, msg: '未超过最高记录' };
}

async function getTopLeaderboard(n) {
    const lb = await fetchLeaderboard();
    return lb.sort((a, b) => b.maxFloor - a.maxFloor).slice(0, n);
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
