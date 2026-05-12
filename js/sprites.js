const TILE_SIZE = 16;

const Sprites = {
    images: {},
    loaded: false,

    async loadAll() {
        const toLoad = {
            dungeonTiles: 'sprites/tiles/Dungeon_Tiles.png',
            wallTiles: 'sprites/tiles/Wall_Tiles.png',
            floorTiles: 'sprites/tiles/Floors_Tiles.png',
            wallVar: 'sprites/tiles/Wall_Variations.png',
            dungeonProps: 'sprites/props/Dungeon_Props.png',
            bonfire: 'sprites/props/Bonfire.png',
            fire: 'sprites/props/Fire_01-Sheet.png',
            // Player
            playerIdleDown: 'sprites/player/Idle_Down-Sheet.png',
            playerIdleSide: 'sprites/player/Idle_Side-Sheet.png',
            playerIdleUp: 'sprites/player/Idle_Up-Sheet.png',
            playerWalkDown: 'sprites/player/Walk_Down-Sheet.png',
            playerWalkSide: 'sprites/player/Walk_Side-Sheet.png',
            playerWalkUp: 'sprites/player/Walk_Up-Sheet.png',
            playerDeath: 'sprites/player/Death_Down-Sheet.png',
            playerHit: 'sprites/player/Hit_Down-Sheet.png',
            playerSlice: 'sprites/player/Slice_Down-Sheet.png',
            // Weapons
            boneWeapons: 'sprites/weapons/Bone.png',
            woodWeapons: 'sprites/weapons/Wood.png',
            hands: 'sprites/weapons/Hands.png',
        };

        // Load monster sprites
        const monsterDirs = [
            'Orc', 'Orc - Rogue', 'Orc - Shaman', 'Orc - Warrior',
            'Skeleton - Base', 'Skeleton - Mage', 'Skeleton - Rogue', 'Skeleton - Warrior'
        ];
        for (const dir of monsterDirs) {
            const key = dir.replace(/[ -]/g, '_');
            toLoad[`monster_${key}_Idle`] = `sprites/monsters/${dir}/Idle-Sheet.png`;
            toLoad[`monster_${key}_Run`] = `sprites/monsters/${dir}/Run-Sheet.png`;
            toLoad[`monster_${key}_Death`] = `sprites/monsters/${dir}/Death-Sheet.png`;
        }

        const promises = Object.entries(toLoad).map(([key, path]) =>
            new Promise((resolve) => {
                const img = new Image();
                img.onload = () => { Sprites.images[key] = img; resolve(); };
                img.onerror = () => { resolve(); }; // skip missing
                img.src = path;
            })
        );

        await Promise.all(promises);
        this.loaded = true;
    },

    get(name) { return this.images[name] || null; },

    // Draw a frame from a sprite sheet
    // sheet: image key, frame: 0-based index, frameW/H: size of each frame
    // sheet is assumed to be a horizontal strip of frames
    drawFrame(ctx, sheetName, frame, frameW, frameH, dx, dy, dw, dh) {
        const img = this.images[sheetName];
        if (!img) return false;
        const sx = frame * frameW;
        const maxFrames = Math.floor(img.width / frameW);
        if (frame >= maxFrames) return false;
        ctx.drawImage(img, sx, 0, frameW, frameH, dx, dy, dw || frameW, dh || frameH);
        return true;
    },

    // Draw a tile from a tileset sheet
    // Tile sheets are grids of TILE_SIZE×TILE_SIZE
    drawTile(ctx, sheetName, col, row, dx, dy, size) {
        const img = this.images[sheetName];
        if (!img) return false;
        const s = size || TILE_SIZE;
        ctx.drawImage(img, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE, dx, dy, s, s);
        return true;
    },

    // Get number of frames in a horizontal strip sheet
    frameCount(sheetName, frameW) {
        const img = this.images[sheetName];
        if (!img) return 0;
        return Math.floor(img.width / frameW);
    },
};

// Tile grid coordinates in the tileset (col, row in 16px grid)
// Dungeon_Tiles.png layout (guessed from common dungeon tilesets)
// We'll map game tiles to positions in the tileset
const TILE_MAP = {
    // Floor tiles - use first few rows of Dungeon_Tiles
    FLOOR_BASE:     { sheet: 'dungeonTiles', col: 0, row: 0 },
    FLOOR_VAR1:     { sheet: 'dungeonTiles', col: 1, row: 0 },
    FLOOR_VAR2:     { sheet: 'dungeonTiles', col: 2, row: 0 },
    FLOOR_VAR3:     { sheet: 'dungeonTiles', col: 3, row: 0 },
    FLOOR_VAR4:     { sheet: 'dungeonTiles', col: 0, row: 1 },
    FLOOR_VAR5:     { sheet: 'dungeonTiles', col: 1, row: 1 },
    // Wall tiles - from Wall_Tiles.png
    WALL_TOP:       { sheet: 'wallTiles', col: 0, row: 0 },
    WALL_SIDE:      { sheet: 'wallTiles', col: 1, row: 0 },
    WALL_CORNER_TL: { sheet: 'wallTiles', col: 2, row: 0 },
    WALL_CORNER_TR: { sheet: 'wallTiles', col: 3, row: 0 },
    WALL_SINGLE:    { sheet: 'wallTiles', col: 0, row: 1 },
    // Floor tiles from Floors_Tiles
    FLOOR_TILE1:    { sheet: 'floorTiles', col: 0, row: 0 },
    FLOOR_TILE2:    { sheet: 'floorTiles', col: 1, row: 0 },
    FLOOR_TILE3:    { sheet: 'floorTiles', col: 2, row: 0 },
    FLOOR_TILE4:    { sheet: 'floorTiles', col: 0, row: 1 },
};

// Get a tile entry by hash for variety
function getFloorTile(x, y) {
    const h = ((x * 374761393 + y * 668265263 + 1013904223) & 0x7FFFFFFF) % 100;
    const floorVars = ['FLOOR_TILE1', 'FLOOR_TILE2', 'FLOOR_TILE3', 'FLOOR_TILE4', 'FLOOR_VAR1', 'FLOOR_VAR2', 'FLOOR_VAR3', 'FLOOR_VAR4', 'FLOOR_VAR5', 'FLOOR_BASE'];
    return TILE_MAP[floorVars[h % floorVars.length]];
}

// Monster sprite mapping
const MONSTER_SPRITE_MAP = {
    '骷髅兵': { key: 'Skeleton___Base', frameW: 32 },
    '骷髅':   { key: 'Skeleton___Base', frameW: 32 },
    '哥布林': { key: 'Orc', frameW: 32 },
    '法师':   { key: 'Skeleton___Mage', frameW: 32 },
    '法王':   { key: 'Skeleton___Mage', frameW: 32 },
    '食人魔': { key: 'Orc___Warrior', frameW: 32 },
    '暗影':   { key: 'Skeleton___Rogue', frameW: 32 },
    '精英':   { key: 'Orc___Shaman', frameW: 32 },
    '巨石':   { key: 'Orc___Warrior', frameW: 32 },
};

function getMonsterSprite(name) {
    for (const [pattern, info] of Object.entries(MONSTER_SPRITE_MAP)) {
        if (name.includes(pattern)) return info;
    }
    return null;
}
