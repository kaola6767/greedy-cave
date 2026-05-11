class Renderer {
    constructor(canvas, dungeon, player) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dungeon = dungeon;
        this.player = player;
        this.glowAngle = 0;
    }

    render() {
        const ctx = this.ctx;
        const d = this.dungeon;
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        this.glowAngle += 0.03;

        ctx.clearRect(0, 0, cw, ch);

        // camera
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

        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const cell = d.getTile(x, y);
                const px = x * CELL_SIZE;
                const py = y * CELL_SIZE;

                if (cell.explored) {
                    // Tile base
                    if (cell.tile === TILE.WALL) {
                        ctx.fillStyle = '#1c1c2a';
                        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                        // Wall texture
                        ctx.fillStyle = '#232340';
                        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                        ctx.fillStyle = '#1a1a28';
                        ctx.fillRect(px + 3, py + 3, CELL_SIZE - 6, CELL_SIZE - 6);
                    } else {
                        const isCorridor = cell.tile === TILE.CORRIDOR;
                        ctx.fillStyle = isCorridor ? '#252535' : '#2e2e40';
                        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                        // Subtle floor variation
                        if ((x + y) % 3 === 0 && cell.tile === TILE.FLOOR) {
                            ctx.fillStyle = 'rgba(255,255,255,0.02)';
                            ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                        }
                    }

                    // Grid
                    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(px, py, CELL_SIZE, CELL_SIZE);

                    // Entities (only when visible)
                    if (cell.visible && cell.entity !== ENTITY.NONE) {
                        this.drawEntity(px, py, cell.entity);
                    }

                    // Fog
                    if (!cell.visible) {
                        ctx.fillStyle = 'rgba(10,10,25,0.7)';
                        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                    }
                } else {
                    ctx.fillStyle = '#080810';
                    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                }
            }
        }

        // Draw player with glow
        this.drawPlayer();

        ctx.restore();
    }

    drawEntity(px, py, entity) {
        const ctx = this.ctx;
        const cx = px + CELL_SIZE / 2;
        const cy = py + CELL_SIZE / 2;
        const r = CELL_SIZE / 2 - 2;

        let emoji, bgColor;
        switch (entity) {
            case ENTITY.MONSTER:
                emoji = '👾'; bgColor = 'rgba(200,50,50,0.25)'; break;
            case ENTITY.CHEST:
                emoji = '📦'; bgColor = 'rgba(200,170,40,0.25)'; break;
            case ENTITY.EXIT:
                emoji = '🚪'; bgColor = 'rgba(40,200,100,0.25)'; break;
            case ENTITY.POTION:
                emoji = '🧪'; bgColor = 'rgba(60,120,255,0.25)'; break;
            default: return;
        }

        // Background circle
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Emoji
        ctx.font = `${CELL_SIZE - 2}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, cx, cy);
    }

    drawPlayer() {
        const ctx = this.ctx;
        const cx = this.player.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = this.player.y * CELL_SIZE + CELL_SIZE / 2;
        const r = CELL_SIZE / 2 - 1;

        // Outer glow
        const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2);
        glow.addColorStop(0, 'rgba(0,229,255,0.5)');
        glow.addColorStop(0.5, 'rgba(0,180,220,0.15)');
        glow.addColorStop(1, 'rgba(0,100,200,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
        ctx.fill();

        // Body circle
        const body = ctx.createRadialGradient(cx - 1, cy - 1, 1, cx, cy, r);
        body.addColorStop(0, '#80f0ff');
        body.addColorStop(0.6, '#00bcd4');
        body.addColorStop(1, '#006080');
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 3, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }
}
