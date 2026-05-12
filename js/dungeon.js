class BSPNode {
    constructor(x, y, w, h) {
        this.x = x; this.y = y;
        this.w = w; this.h = h;
        this.left = null;
        this.right = null;
        this.room = null;
    }
}

class Dungeon {
    constructor(floorLevel) {
        this.floorLevel = floorLevel;
        this.cols = MAP_COLS;
        this.rows = MAP_ROWS;
        this.map = [];
        this.startX = 0;
        this.startY = 0;
        this.exitX = 0;
        this.exitY = 0;
        this.totalMonsters = 0;
        this.monstersKilled = 0;
        this.exitPlaced = false;
        this.isBossFloor = (floorLevel % 10 === 0);
        this.generate();
    }

    generate() {
        this.map = [];
        for (let y = 0; y < this.rows; y++) {
            this.map[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.map[y][x] = { tile: TILE.WALL, entity: ENTITY.NONE, explored: false, visible: false };
            }
        }

        if (this.isBossFloor) {
            this.generateBossRoom();
        } else {
            this.root = new BSPNode(1, 1, this.cols - 2, this.rows - 2);
            this.splitNode(this.root, 6);
            this.createRooms(this.root);
            this.connectRooms(this.root);
            this.placeEntities();
        }
    }

    generateBossRoom() {
        // Single large room taking most of the map
        const margin = 2;
        const rx = margin;
        const ry = margin;
        const rw = this.cols - margin * 2;
        const rh = this.rows - margin * 2;

        for (let y = ry; y < ry + rh; y++) {
            for (let x = rx; x < rx + rw; x++) {
                this.map[y][x].tile = TILE.FLOOR;
            }
        }

        // Start at bottom-left area
        this.startX = rx + 3;
        this.startY = ry + rh - 4;

        // Place boss in center
        const bx = rx + Math.floor(rw / 2);
        const by = ry + Math.floor(rh / 2);
        this.map[by][bx].entity = ENTITY.MONSTER;
        this.map[by][bx].monsterData = generateMonster(this.floorLevel);
        this.totalMonsters = 1;

        // Place chest in corner
        const isGoldChest = Math.random() < 0.30;
        const chestType = isGoldChest ? ENTITY.GOLD_CHEST : ENTITY.SILVER_CHEST;
        this.map[ry + 3][rx + 3].entity = chestType;

        // Place potions
        const potionCount = 2 + rand(0, 2);
        const corners = [
            [rx + 5, ry + rh - 5], [rx + rw - 5, ry + 3],
            [rx + rw - 5, ry + rh - 5], [rx + 5, ry + 5],
        ];
        for (let i = 0; i < Math.min(potionCount, corners.length); i++) {
            const [px, py] = corners[i];
            if (this.map[py][px].entity === ENTITY.NONE) {
                this.map[py][px].entity = ENTITY.POTION;
            }
        }
    }

    onMonsterKilled() {
        this.monstersKilled++;
        if (this.isBossFloor) {
            // Boss killed — place exit
            const rx = 2, ry = 2, rw = this.cols - 4, rh = this.rows - 4;
            this.exitX = rx + rw - 5;
            this.exitY = ry + 3;
            this.map[this.exitY][this.exitX].entity = ENTITY.EXIT;
            this.exitPlaced = true;
        } else if (!this.exitPlaced && this.totalMonsters > 0) {
            const pct = this.monstersKilled / this.totalMonsters;
            if (pct >= 0.60) {
                this.placeExit();
            }
        }
    }

    getKillPct() {
        if (this.totalMonsters === 0) return 100;
        return Math.round(this.monstersKilled / this.totalMonsters * 100);
    }

    placeExit() {
        const allRooms = this.getAllRooms(this.root);
        if (allRooms.length === 0) return;
        const exitRoom = allRooms[allRooms.length - 1];
        this.exitX = exitRoom.x + Math.floor(exitRoom.w / 2);
        this.exitY = exitRoom.y + Math.floor(exitRoom.h / 2);
        if (this.map[this.exitY][this.exitX].entity === ENTITY.NONE) {
            this.map[this.exitY][this.exitX].entity = ENTITY.EXIT;
            this.exitPlaced = true;
        }
    }

    splitNode(node, depth) {
        if (depth <= 0) return;
        const minRoom = 6;
        const minSplit = minRoom * 2 + 1;

        let splitH;
        if (node.w > node.h * 1.25) splitH = true;
        else if (node.h > node.w * 1.25) splitH = false;
        else splitH = Math.random() > 0.5;

        const maxSplit = (splitH ? node.w : node.h) - minSplit;
        if (maxSplit < minRoom) return;

        const split = minRoom + rand(0, maxSplit - minRoom);

        if (splitH) {
            node.left = new BSPNode(node.x, node.y, split, node.h);
            node.right = new BSPNode(node.x + split + 1, node.y, node.w - split - 1, node.h);
        } else {
            node.left = new BSPNode(node.x, node.y, node.w, split);
            node.right = new BSPNode(node.x, node.y + split + 1, node.w, node.h - split - 1);
        }

        this.splitNode(node.left, depth - 1);
        this.splitNode(node.right, depth - 1);
    }

    createRooms(node) {
        if (node.left || node.right) {
            if (node.left) this.createRooms(node.left);
            if (node.right) this.createRooms(node.right);
            return;
        }

        const roomW = rand(4, Math.max(4, node.w - 2));
        const roomH = rand(4, Math.max(4, node.h - 2));
        const roomX = node.x + rand(1, node.w - roomW - 1);
        const roomY = node.y + rand(1, node.h - roomH - 1);

        node.room = { x: roomX, y: roomY, w: roomW, h: roomH };

        for (let y = roomY; y < roomY + roomH; y++) {
            for (let x = roomX; x < roomX + roomW; x++) {
                this.map[y][x].tile = TILE.FLOOR;
            }
        }
    }

    connectRooms(node) {
        if (node.left && node.right) {
            this.connectRooms(node.left);
            this.connectRooms(node.right);
        }
        if (!node.left || !node.right) return;

        const r1 = this.getRoom(node.left);
        const r2 = this.getRoom(node.right);
        if (!r1 || !r2) return;

        const x1 = r1.x + Math.floor(r1.w / 2);
        const y1 = r1.y + Math.floor(r1.h / 2);
        const x2 = r2.x + Math.floor(r2.w / 2);
        const y2 = r2.y + Math.floor(r2.h / 2);

        if (Math.random() > 0.5) {
            this.hCorridor(x1, x2, y1);
            this.vCorridor(y1, y2, x2);
        } else {
            this.vCorridor(y1, y2, x1);
            this.hCorridor(x1, x2, y2);
        }
    }

    hCorridor(x1, x2, y) {
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            if (this.map[y][x].tile === TILE.WALL) this.map[y][x].tile = TILE.CORRIDOR;
        }
    }

    vCorridor(y1, y2, x) {
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            if (this.map[y][x].tile === TILE.WALL) this.map[y][x].tile = TILE.CORRIDOR;
        }
    }

    getRoom(node) {
        if (node.room) return node.room;
        const left = node.left ? this.getRoom(node.left) : null;
        const right = node.right ? this.getRoom(node.right) : null;
        return left || right;
    }

    getAllRooms(node) {
        const rooms = [];
        this.collectRooms(node, rooms);
        return rooms;
    }

    collectRooms(node, out) {
        if (!node) return;
        if (node.room) { out.push(node.room); return; }
        this.collectRooms(node.left, out);
        this.collectRooms(node.right, out);
    }

    placeEntities() {
        const allRooms = this.getAllRooms(this.root);

        // start in first room
        const startRoom = allRooms[0];
        this.startX = startRoom.x + Math.floor(startRoom.w / 2);
        this.startY = startRoom.y + Math.floor(startRoom.h / 2);

        // Save exit position (exit not placed until kill condition met)
        const exitRoom = allRooms[allRooms.length - 1];
        this.exitX = exitRoom.x + Math.floor(exitRoom.w / 2);
        this.exitY = exitRoom.y + Math.floor(exitRoom.h / 2);

        // monsters, chests, potions in other rooms
        const monsterCount = 5 + this.floorLevel * 2;
        const potionCount = 2 + rand(0, 3);
        const isGoldChest = Math.random() < 0.30;
        const chestType = isGoldChest ? ENTITY.GOLD_CHEST : ENTITY.SILVER_CHEST;

        const midRooms = allRooms.length > 2 ? allRooms.slice(1, -1) : allRooms;
        if (midRooms.length === 0) return;

        const placed = new Set();
        const placeInRoom = (room) => `${room.x},${room.y}`;

        const placeRandom = (type, count, genData) => {
            let placedCount = 0;
            for (let i = 0; i < count; i++) {
                const room = pick(midRooms);
                if (!room) continue;
                const key = placeInRoom(room);
                if (placed.has(key) && type === ENTITY.EXIT) continue;
                const ex = room.x + rand(1, room.w - 2);
                const ey = room.y + rand(1, room.h - 2);
                if (this.map[ey][ex].entity !== ENTITY.NONE) continue;
                this.map[ey][ex].entity = type;
                if (genData) this.map[ey][ex].monsterData = genData();
                if (type === ENTITY.MONSTER) placedCount++;
                if (type === ENTITY.SILVER_CHEST || type === ENTITY.GOLD_CHEST || type === ENTITY.EXIT) placed.add(key);
            }
            return placedCount;
        };

        this.totalMonsters += placeRandom(ENTITY.MONSTER, Math.min(monsterCount, midRooms.length * 2), () => generateMonster(this.floorLevel));
        placeRandom(chestType, 1);
        placeRandom(ENTITY.POTION, potionCount);
        this.totalMonsters += placeRandom(ENTITY.MONSTER, 2, () => generateMonster(this.floorLevel));
    }

    getTile(x, y) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return { tile: TILE.WALL, entity: ENTITY.NONE, explored: false, visible: false };
        return this.map[y][x];
    }

    isWalkable(x, y) {
        const cell = this.getTile(x, y);
        // Exit is only walkable after it's placed
        if (cell.entity === ENTITY.EXIT && !this.exitPlaced) return false;
        return cell.tile !== TILE.WALL;
    }

    removeEntity(x, y) {
        const cell = this.getTile(x, y);
        cell.entity = ENTITY.NONE;
    }

    updateVisibility(px, py, radius) {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.map[y][x].visible = false;
            }
        }
        const r2 = radius * radius;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy > r2) continue;
                const cx = px + dx, cy = py + dy;
                if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) continue;
                if (this.map[cy][cx].tile === TILE.WALL) {
                    this.map[cy][cx].visible = true;
                    this.map[cy][cx].explored = true;
                } else {
                    let blocked = false;
                    const steps = Math.max(Math.abs(dx), Math.abs(dy));
                    if (steps > 1) {
                        for (let s = 1; s < steps; s++) {
                            const t = s / steps;
                            const sx = Math.round(px + dx * t);
                            const sy = Math.round(py + dy * t);
                            if (this.map[sy][sx].tile === TILE.WALL) { blocked = true; break; }
                        }
                    }
                    if (!blocked) {
                        this.map[cy][cx].visible = true;
                        this.map[cy][cx].explored = true;
                    }
                }
            }
        }
    }
}
