class Renderer {
    constructor(canvas, dungeon, player) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dungeon = dungeon;
        this.player = player;
    }

    render() {
        const ctx = this.ctx;
        const d = this.dungeon;
        const cw = this.canvas.width;
        const ch = this.canvas.height;

        ctx.clearRect(0, 0, cw, ch);

        // camera centered on player, clamped to map bounds
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
                    if (cell.tile === TILE.WALL) {
                        ctx.fillStyle = COLORS.wall;
                    } else if (cell.tile === TILE.CORRIDOR) {
                        ctx.fillStyle = COLORS.corridor;
                    } else {
                        ctx.fillStyle = COLORS.floor;
                    }
                    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

                    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
                    ctx.strokeRect(px, py, CELL_SIZE, CELL_SIZE);

                    if (cell.visible) {
                        if (cell.entity === ENTITY.MONSTER) {
                            this.drawEntity(px, py, COLORS.monster, 'M');
                        } else if (cell.entity === ENTITY.CHEST) {
                            this.drawEntity(px, py, COLORS.chest, '箱');
                        } else if (cell.entity === ENTITY.EXIT) {
                            this.drawEntity(px, py, COLORS.exit, '门');
                        } else if (cell.entity === ENTITY.POTION) {
                            this.drawEntity(px, py, COLORS.potion, '药');
                        }
                    }

                    if (!cell.visible) {
                        ctx.fillStyle = COLORS.fog_explored;
                        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                    }
                } else {
                    ctx.fillStyle = COLORS.fog_unexplored;
                    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                }
            }
        }

        // draw player
        const ppx = this.player.x * CELL_SIZE;
        const ppy = this.player.y * CELL_SIZE;
        ctx.fillStyle = COLORS.player;
        ctx.beginPath();
        ctx.arc(ppx + CELL_SIZE / 2, ppy + CELL_SIZE / 2, CELL_SIZE / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    drawEntity(px, py, color, text) {
        const ctx = this.ctx;
        ctx.fillStyle = color;
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        ctx.fillStyle = '#fff';
        ctx.font = `${CELL_SIZE - 4}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, px + CELL_SIZE / 2, py + CELL_SIZE / 2 + 1);
    }
}
