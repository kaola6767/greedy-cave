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
        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const cell = d.getTile(x, y);
                const px = x * CELL_SIZE;
                const py = y * CELL_SIZE;

                if (!cell.explored) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                    continue;
                }

                // Tile color
                if (cell.tile === TILE.WALL) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                } else {
                    // Walkable: semi-transparent warm dark tone
                    const isCorridor = cell.tile === TILE.CORRIDOR;
                    ctx.fillStyle = isCorridor ? 'rgba(40,32,24,0.55)' : 'rgba(25,25,35,0.45)';
                    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                }
            }
        }

        // --- YELLOW WALL BOUNDARIES ---
        ctx.strokeStyle = '#c8a020';
        ctx.lineWidth = 1.5;
        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const cell = d.getTile(x, y);
                if (!cell.explored || cell.tile !== TILE.WALL) continue;
                const px = x * CELL_SIZE;
                const py = y * CELL_SIZE;
                const neighbors = [
                    [0, -1, px, py, px + CELL_SIZE, py],          // top
                    [0, 1, px, py + CELL_SIZE, px + CELL_SIZE, py + CELL_SIZE], // bottom
                    [-1, 0, px, py, px, py + CELL_SIZE],           // left
                    [1, 0, px + CELL_SIZE, py, px + CELL_SIZE, py + CELL_SIZE], // right
                ];
                for (const [dx, dy, x1, y1, x2, y2] of neighbors) {
                    const n = d.getTile(x + dx, y + dy);
                    if (n.explored && n.tile !== TILE.WALL) {
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                }
            }
        }

        // --- DRAW ENTITIES (visible cells only) ---
        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const cell = d.getTile(x, y);
                if (cell.visible && cell.explored && cell.entity !== ENTITY.NONE) {
                    this.drawEntity(x * CELL_SIZE, y * CELL_SIZE, cell.entity, cell.monsterData);
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

    drawEntity(px, py, entity, monsterData) {
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
            this.drawMonster(cx, cy, monsterData);
        }
    }

    drawMonster(cx, cy, data) {
        const ctx = this.ctx;
        const bob = Math.sin(this.time * 3 + cx) * 1.5;
        const my = cy + bob;
        const isElite = data && data.isElite;
        const isBoss = data && data.isBoss;

        // Dark aura
        const auraColor = isBoss ? 'rgba(255,0,0,0.45)' : isElite ? 'rgba(255,140,0,0.35)' : 'rgba(180,20,20,0.25)';
        const aura = ctx.createRadialGradient(cx, my, 2, cx, my, isBoss ? 14 : 11);
        aura.addColorStop(0, auraColor);
        aura.addColorStop(0.6, 'rgba(20,5,5,0.1)');
        aura.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(cx, my, isBoss ? 14 : 11, 0, Math.PI * 2); ctx.fill();

        // Shadow under
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(cx, my + 7, 6, 2, 0, 0, Math.PI * 2); ctx.fill();

        // Color-coded body based on name hash
        const name = data ? data.name : '?';
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
        const hue = (hash & 0xFF) % 360;
        const bodyColor = `hsl(${hue}, 50%, 35%)`;
        const lightColor = `hsl(${hue}, 60%, 50%)`;

        // Body circle
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(cx, my, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = lightColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Emoji icon
        const emoji = data ? data.emoji : '👾';
        ctx.font = `${CELL_SIZE}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, cx, my);

        // Elite: golden ring + crown
        if (isElite) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, my, 8, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 8px sans-serif';
            ctx.fillText('★', cx + 6, my - 5);
        }

        // Boss: red ring + skull mark
        if (isBoss) {
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(cx, my, 9, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#FF0000';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText('☠', cx + 6, my - 6);
        }
    }

    drawPlayerCharacter(px, py) {
        const ctx = this.ctx;
        const bob = Math.abs(this.walkPhase) > 0.05 ? Math.sin(this.walkPhase * 3) * 1 : 0;
        const s = 0.9;

        // Torch glow
        const torchX = px + 4;
        const torchY = py - 4 + bob;
        const flicker = 1 + Math.sin(this.time * 12) * 0.04 + Math.sin(this.time * 19) * 0.03;
        const glowR = 6 * flicker;
        const glow = ctx.createRadialGradient(torchX, torchY, 1, torchX, torchY, glowR);
        glow.addColorStop(0, 'rgba(255,200,80,0.9)');
        glow.addColorStop(0.3, 'rgba(255,150,30,0.5)');
        glow.addColorStop(0.7, 'rgba(255,80,10,0.1)');
        glow.addColorStop(1, 'rgba(255,50,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(torchX, torchY, glowR, 0, Math.PI * 2); ctx.fill();

        // Torch flame
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.arc(torchX, torchY - 1, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(torchX, torchY - 2, 1, 0, Math.PI * 2); ctx.fill();

        // Torch stick
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(px + 3, py - 1); ctx.lineTo(torchX, torchY); ctx.stroke();

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(px, py + 8, 5, 1.5, 0, 0, Math.PI * 2); ctx.fill();

        // Legs with walk animation
        const legSwing = Math.sin(this.walkPhase * 3) * 2.5;
        ctx.strokeStyle = '#c8b89a';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px, py + 3 + bob); ctx.lineTo(px - legSwing, py + 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, py + 3 + bob); ctx.lineTo(px + legSwing, py + 8); ctx.stroke();

        // Left arm
        ctx.strokeStyle = '#d4c4a8';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(px, py + 1 + bob); ctx.lineTo(px - 4, py + 4 + bob); ctx.stroke();

        // Right arm (holding torch)
        ctx.beginPath(); ctx.moveTo(px, py + 1 + bob); ctx.lineTo(px + 3, py - 1 + bob); ctx.stroke();

        // Body
        ctx.fillStyle = '#5a7a5a';
        ctx.fillRect(px - 2.5, py + bob, 5, 5);

        // Head
        ctx.fillStyle = '#e8d5b7';
        ctx.beginPath(); ctx.arc(px, py - 2 + bob, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c8b090';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Eyes (tiny dots)
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(px - 1, py - 2.5 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 1, py - 2.5 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
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
