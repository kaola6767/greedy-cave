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

// --- Leaderboard (GitHub API) ---
function base64Encode(str) {
    // Unicode-safe base64
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

// Fetch data + SHA — public API call (no auth needed for public repo)
async function fetchLeaderboardWithSha() {
    try {
        // Public API — no auth needed for GET on public repos
        const resp = await fetch(LB_API + '?t=' + Date.now(), {
            headers: { Accept: 'application/vnd.github.v3+json' },
        });
        if (resp.ok) {
            const apiData = await resp.json();
            leaderboardSha = apiData.sha;
            const data = JSON.parse(atob(apiData.content.replace(/\n/g, '')));
            leaderboardCache = data;
            return { data, sha: apiData.sha };
        }
    } catch (e) { console.log('Public API fetch failed:', e.message); }
    // Fallback: raw URL
    try {
        const resp = await fetch(LB_URL + '?t=' + Date.now());
        const data = await resp.json();
        leaderboardCache = data;
        return { data, sha: null };
    } catch (e) {
        return { data: leaderboardCache || [], sha: null };
    }
}

async function saveLeaderboardRemote(data) {
    const token = getGitHubToken();
    if (!token) return { ok: false, msg: '未设置Token' };
    try {
        if (!leaderboardSha) {
            const { sha } = await fetchLeaderboardWithSha();
            if (!sha) return { ok: false, msg: '无法获取文件SHA' };
        }
        const encoded = base64Encode(JSON.stringify(data, null, 2));
        const body = { message: 'Update leaderboard', content: encoded, sha: leaderboardSha };
        const resp = await fetch(LB_API, {
            method: 'PUT',
            mode: 'cors',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
            body: JSON.stringify(body),
        });
        const result = await resp.json();
        if (resp.ok) {
            leaderboardSha = result.content?.sha;
            leaderboardCache = data;
            return { ok: true };
        }
        leaderboardSha = null;
        return { ok: false, msg: result.message || 'API错误' };
    } catch (e) {
        leaderboardSha = null;
        return { ok: false, msg: e.message };
    }
}

async function updateMaxFloor(floorLevel) {
    const username = getCurrentUser();
    if (!username) return { ok: false, msg: '未登录' };
    console.log('updateMaxFloor: user=' + username + ' floor=' + floorLevel);
    const { data: lb, sha } = await fetchLeaderboardWithSha();
    console.log('fetchLeaderboardWithSha: entries=' + lb.length + ' sha=' + (sha ? 'ok' : 'none'));
    const entry = lb.find(e => e.name === username);
    if (entry && floorLevel > entry.maxFloor) {
        entry.maxFloor = floorLevel;
        entry.updatedAt = Date.now();
        console.log('Updating existing entry to floor ' + floorLevel);
        return await saveLeaderboardRemote(lb);
    } else if (!entry) {
        lb.push({ name: username, maxFloor: floorLevel, updatedAt: Date.now() });
        leaderboardSha = null;
        console.log('Creating new entry');
        return await saveLeaderboardRemote(lb);
    }
    return { ok: false, msg: '未超过最高记录' };
}

async function getTopLeaderboard(n) {
    const { data: lb } = await fetchLeaderboardWithSha();
    return lb.sort((a, b) => b.maxFloor - a.maxFloor).slice(0, n);
}

const EMBEDDED_TOKEN = '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';

function getGitHubToken() {
    return localStorage.getItem('greedyGHToken') || EMBEDDED_TOKEN;
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
