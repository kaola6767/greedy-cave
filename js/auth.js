const AUTH_KEYS = {
    users: 'greedyUsers',
    currentUser: 'greedyCurrentUser',
    savePrefix: 'greedySave_',
    displayNames: 'greedyDisplayNames',
};

const LB_URL = 'https://raw.githubusercontent.com/kaola6767/greedy-cave/master/leaderboard.json';
const LB_API = 'https://api.github.com/repos/kaola6767/greedy-cave/contents/leaderboard.json';
let leaderboardCache = null;
let leaderboardSha = null;

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

// --- Leaderboard (GitHub API, token from localStorage) ---
async function fetchLeaderboard() {
    try {
        const resp = await fetch(LB_URL + '?t=' + Date.now());
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        leaderboardCache = data;
        return data;
    } catch (e) {
        return leaderboardCache || [];
    }
}

async function fetchLeaderboardSha() {
    const token = getGitHubToken();
    if (!token) return null;
    try {
        const resp = await fetch(LB_API, {
            headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github.v3+json' },
        });
        if (resp.ok) {
            const d = await resp.json();
            leaderboardSha = d.sha;
            return d.sha;
        }
    } catch {}
    return null;
}

async function saveLeaderboardRemote(data) {
    const token = getGitHubToken();
    if (!token) return { ok: false, msg: '未设置Token, 主城🔑设置' };
    if (!leaderboardSha) {
        const sha = await fetchLeaderboardSha();
        if (!sha) return { ok: false, msg: '无法获取SHA, Token是否有效?' };
    }
    const content = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data, null, 2))));
    const body = { message: 'Update leaderboard', content, sha: leaderboardSha };
    try {
        const resp = await fetch(LB_API, {
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
            body: JSON.stringify(body),
        });
        if (resp.ok) {
            const r = await resp.json();
            leaderboardSha = r.content?.sha;
            leaderboardCache = data;
            return { ok: true };
        }
        leaderboardSha = null;
        return { ok: false, msg: 'API错误 ' + resp.status };
    } catch {
        return { ok: false, msg: '网络错误' };
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
        leaderboardSha = null;
        return await saveLeaderboardRemote(lb);
    }
    return { ok: false, msg: '未超过最高记录' };
}

async function getTopLeaderboard(n) {
    const lb = await fetchLeaderboard();
    return lb.sort((a, b) => b.maxFloor - a.maxFloor).slice(0, n);
}

function getGitHubToken() {
    return localStorage.getItem('greedyGHToken') || '';
}
function setGitHubToken(token) {
    localStorage.setItem('greedyGHToken', token);
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
