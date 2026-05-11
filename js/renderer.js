class Renderer {
    constructor(canvas, dungeon, player) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dungeon = dungeon;
        this.player = player;
        this.time = 0;
        this.walkPhase = 0;
        this.lastPx = player.x;
        this.lastPy = player.y;
        this.dirX = 0;
        this.dirY = -1;
        // Sprite sheet
        this.spriteImg = new Image();
        this.spriteLoaded = false;
        this.spriteImg.onload = () => { this.spriteLoaded = true; };
        this.spriteImg.src = 'assets/VSCode+Claude替换贪婪洞窟游戏模型.png';
        // Sprite layout: 3 cols × 4 rows
        this.spriteCols = 3;
        this.spriteRows = 4;
    }

    render() {
        const ctx = this.ctx;
        const d = this.dungeon;
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        this.time += 0.016;

        // Track walking
        const moved = (this.player.x !== this.lastPx || this.player.y !== this.lastPy);
        if (moved) {
            this.dirX = this.player.x - this.lastPx;
            this.dirY = this.player.y - this.lastPy;
            this.lastPx = this.player.x;
            this.lastPy = this.player.y;
            this.walkPhase += 0.35;
        } else {
            this.walkPhase *= 0.85;
        }

        ctx.clearRect(0, 0, cw, ch);

        // Camera
        // Dynamic vision: torch light diameter ≈ 3/4 of smaller canvas dimension
        const torchRadius = Math.min(cw, ch) * 0.375;
        const visionCells = Math.ceil(torchRadius / CELL_SIZE);
        this.torchRadius = torchRadius;
        this.visionCells = visionCells;

        let camX = this.player.x * CELL_SIZE - cw / 2 + CELL_SIZE / 2;
        let camY = this.player.y * CELL_SIZE - ch / 2 + CELL_SIZE / 2;
        const maxCamX = d.cols * CELL_SIZE - cw;
        const maxCamY = d.rows * CELL_SIZE - ch;
        camX = Math.max(0, Math.min(camX, maxCamX));
        camY = Math.max(0, Math.min(camY, maxCamY));
        this.camX = camX;
        this.camY = camY;

        ctx.save();
        ctx.translate(-camX, -camY);

        const viewCols = Math.ceil(cw / CELL_SIZE) + 2;
        const viewRows = Math.ceil(ch / CELL_SIZE) + 2;
        const startCol = Math.max(0, Math.floor(camX / CELL_SIZE) - 1);
        const endCol = Math.min(d.cols, startCol + viewCols);
        const startRow = Math.max(0, Math.floor(camY / CELL_SIZE) - 1);
        const endRow = Math.min(d.rows, startRow + viewRows);

        // --- DRAW MAP ---
        // Pass 1: Draw floor/corridor tiles (only visible cells)
        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const cell = d.getTile(x, y);
                const px = x * CELL_SIZE;
                const py = y * CELL_SIZE;

                if (!cell.visible) continue;

                if (cell.tile === TILE.FLOOR || cell.tile === TILE.CORRIDOR) {
                    const isCorridor = cell.tile === TILE.CORRIDOR;
                    ctx.fillStyle = isCorridor ? 'rgba(50,38,28,0.55)' : 'rgba(30,30,46,0.5)';
                    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

                    // Subtle grid
                    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
                }

                // Entities
                if (cell.entity !== ENTITY.NONE) {
                    this.drawEntity(px, py, cell.entity);
                }
            }
        }

        // Pass 2: Draw yellow wall boundaries
        ctx.strokeStyle = '#b8960c';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        const dirs = [[0,-1],[1,0],[0,1],[-1,0]]; // up, right, down, left

        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const cell = d.getTile(x, y);
                if (!cell.visible) continue;
                if (cell.tile !== TILE.FLOOR && cell.tile !== TILE.CORRIDOR) continue;

                const px = x * CELL_SIZE;
                const py = y * CELL_SIZE;

                for (const [dx, dy] of dirs) {
                    const nx = x + dx, ny = y + dy;
                    const neighbor = d.getTile(nx, ny);
                    if (neighbor.tile === TILE.WALL) {
                        ctx.beginPath();
                        if (dy === -1) { // wall above
                            ctx.moveTo(px, py);
                            ctx.lineTo(px + CELL_SIZE, py);
                        } else if (dy === 1) { // wall below
                            ctx.moveTo(px, py + CELL_SIZE);
                            ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE);
                        } else if (dx === -1) { // wall left
                            ctx.moveTo(px, py);
                            ctx.lineTo(px, py + CELL_SIZE);
                        } else if (dx === 1) { // wall right
                            ctx.moveTo(px + CELL_SIZE, py);
                            ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE);
                        }
                        ctx.stroke();
                    }
                }
            }
        }

        // --- DRAW PLAYER ---
        const ppx = this.player.x * CELL_SIZE + CELL_SIZE / 2;
        const ppy = this.player.y * CELL_SIZE + CELL_SIZE / 2;
        this.drawPlayerCharacter(ppx, ppy);

        ctx.restore();

        // --- FOG OF WAR + TORCH LIGHT ---
        this.drawFog(cw, ch);
    }

    drawEntity(px, py, entity) {
        const ctx = this.ctx;
        const cx = px + CELL_SIZE / 2;
        const cy = py + CELL_SIZE / 2;

        if (entity === ENTITY.CHEST) {
            // Chest
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(px + 3, py + 6, 12, 8);
            ctx.fillStyle = '#DAA520';
            ctx.fillRect(px + 4, py + 7, 10, 6);
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(px + 7, py + 4, 4, 4);
        } else if (entity === ENTITY.EXIT) {
            // Door
            ctx.fillStyle = '#2e5a2e';
            ctx.fillRect(px + 2, py + 1, 14, 16);
            ctx.fillStyle = '#4a8';
            ctx.fillRect(px + 4, py + 3, 10, 14);
            ctx.fillStyle = '#ffd700';
            ctx.beginPath(); ctx.arc(cx, cy + 4, 2, 0, Math.PI * 2); ctx.fill();
        } else if (entity === ENTITY.POTION) {
            // Potion bottle
            ctx.fillStyle = '#4488ff';
            ctx.fillRect(px + 5, py + 7, 8, 8);
            ctx.fillStyle = '#88bbff';
            ctx.fillRect(px + 6, py + 8, 6, 6);
            ctx.fillStyle = '#fff';
            ctx.fillRect(px + 6, py + 2, 6, 6);
            ctx.fillRect(px + 7, py + 3, 4, 4);
        } else if (entity === ENTITY.MONSTER) {
            this.drawMonster(cx, cy);
        }
    }

    drawMonster(cx, cy) {
        const ctx = this.ctx;
        const bob = Math.sin(this.time * 3 + cx) * 1.5;
        const my = cy + bob;
        const s = 0.85;

        // Dark aura
        const aura = ctx.createRadialGradient(cx, my, 2, cx, my, 11);
        aura.addColorStop(0, 'rgba(180,20,20,0.35)');
        aura.addColorStop(0.6, 'rgba(80,10,10,0.15)');
        aura.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(cx, my, 11, 0, Math.PI * 2); ctx.fill();

        // Shadow under
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(cx, my + 8, 6, 2, 0, 0, Math.PI * 2); ctx.fill();

        // Body (dark silhouette)
        ctx.fillStyle = '#1a0a0a';
        ctx.beginPath();
        ctx.moveTo(cx - 5 * s, my + 4);
        ctx.lineTo(cx, my - 5);
        ctx.lineTo(cx + 5 * s, my + 4);
        ctx.lineTo(cx + 6 * s, my + 7);
        ctx.lineTo(cx - 6 * s, my + 7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#3a1010';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Claws / teeth
        ctx.fillStyle = '#ddd';
        ctx.fillRect(cx - 1, my + 5, 1, 3);
        ctx.fillRect(cx + 0, my + 5, 1, 3);

        // Eyes (glowing red)
        const eyeGlow = ctx.createRadialGradient(cx - 2, my - 1, 0.5, cx - 2, my - 1, 3);
        eyeGlow.addColorStop(0, '#ff0000');
        eyeGlow.addColorStop(0.4, '#cc0000');
        eyeGlow.addColorStop(1, 'rgba(200,0,0,0)');
        ctx.fillStyle = eyeGlow;
        ctx.beginPath(); ctx.arc(cx - 2, my - 1, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 2, my - 1, 3, 0, Math.PI * 2); ctx.fill();

        // Eye pupils
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx - 2, my - 1, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 2, my - 1, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    drawPlayerCharacter(px, py) {
        const ctx = this.ctx;

        if (this.spriteLoaded && this.spriteImg.naturalWidth > 0) {
            const fw = this.spriteImg.naturalWidth / this.spriteCols;
            const fh = this.spriteImg.naturalHeight / this.spriteRows;

            // Determine row (direction): down=0, left=1, right=2, up=3
            let row = 0;
            if (Math.abs(this.dirY) >= Math.abs(this.dirX)) {
                row = this.dirY > 0 ? 0 : 3; // down or up
            } else {
                row = this.dirX < 0 ? 1 : 2; // left or right
            }

            // Determine column (animation frame)
            let col = 0;
            if (Math.abs(this.walkPhase) > 0.05) {
                col = Math.floor(this.walkPhase * 2) % 2 + 1; // col 1 or 2
            }

            const drawSize = CELL_SIZE * 2.5;
            const dx = px - drawSize / 2;
            const dy = py - drawSize + CELL_SIZE / 2;

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.ellipse(px, py + CELL_SIZE / 2, drawSize * 0.35, drawSize * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();

            // Draw sprite frame
            ctx.drawImage(
                this.spriteImg,
                col * fw, row * fh, fw, fh,
                dx, dy, drawSize, drawSize
            );
        } else {
            // Fallback: simple circle while loading
            const bob = Math.abs(this.walkPhase) > 0.05 ? Math.sin(this.walkPhase * 3) * 1 : 0;
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.ellipse(px, py + CELL_SIZE * 0.8, CELL_SIZE * 0.6, CELL_SIZE * 0.15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4488cc';
            ctx.beginPath();
            ctx.arc(px, py + bob, CELL_SIZE * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawFog(cw, ch) {
        const ctx = this.ctx;
        const playerScreenX = this.player.x * CELL_SIZE - this.camX + CELL_SIZE / 2;
        const playerScreenY = this.player.y * CELL_SIZE - this.camY + CELL_SIZE / 2;

        const tr = this.torchRadius || 144;
        const flicker = 1 + Math.sin(this.time * 8) * 0.02;
        const innerR = tr * 0.55 * flicker;
        const outerR = tr * flicker;

        const grad = ctx.createRadialGradient(playerScreenX, playerScreenY, innerR, playerScreenX, playerScreenY, outerR);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.45, 'rgba(0,0,0,0.08)');
        grad.addColorStop(0.75, 'rgba(0,0,0,0.6)');
        grad.addColorStop(1, 'rgba(0,0,0,0.96)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);
    }
}
