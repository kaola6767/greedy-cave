const TILE = { WALL: 0, FLOOR: 1, CORRIDOR: 2 };
const ENTITY = { NONE: 0, MONSTER: 1, CHEST: 2, EXIT: 3, POTION: 4 };
const STATE = { TITLE: 'TITLE', TOWN: 'TOWN', DUNGEON: 'DUNGEON', COMBAT: 'COMBAT', VICTORY: 'VICTORY', DEAD: 'DEAD' };

const CELL_SIZE = 18;
const MAP_COLS = 50;
const MAP_ROWS = 40;
const CANVAS_W = 800;
const CANVAS_H = 580;
const VIEW_COLS = Math.ceil(CANVAS_W / CELL_SIZE) + 2;
const VIEW_ROWS = Math.ceil(CANVAS_H / CELL_SIZE) + 2;

const COLORS = {
    wall: '#1a1a2e',
    floor: '#2a2a3e',
    corridor: '#222238',
    player: '#00e5ff',
    monster: '#ff4444',
    chest: '#ffd700',
    exit: '#00ff88',
    potion: '#4488ff',
    fog_unexplored: '#000',
    fog_explored: 'rgba(0,0,0,0.65)',
};

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
