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
        this.hitFlash = 0;
        this.damageFlash = 0;
        this.shakeX = 0; this.shakeY = 0;
        this.shakeDuration = 0; this.shakeAmount = 0;
        this.minimapCanvas = document.createElement('canvas');
        this.minimapCanvas.width = 100;
        this.minimapCanvas.height = 80;
        this.minimapCtx = this.minimapCanvas.getContext('2d');
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

        // Screen shake
        if (this.shakeDuration > 0) {
            this.shakeX = Math.sin(this.time * 60) * this.shakeAmount;
            this.shakeY = Math.cos(this.time * 53.7) * this.shakeAmount;
            this.shakeDuration -= 0.016;
            this.shakeAmount *= 0.85;
            if (this.shakeDuration <= 0) { this.shakeX = 0; this.shakeY = 0; this.shakeAmount = 0; }
        }

        // Floor theme
        const theme = getFloorTheme(this.dungeon ? this.dungeon.floorLevel : 1);

        // Camera
        // Dynamic vision: torch light diameter ≈ 3/4 of smaller canvas dimension
        const torchRadius = Math.min(cw, ch) * 0.375;
        const visionCells = Math.ceil(torchRadius / CELL_SIZE);
        this.torchRadius = torchRadius;
        this.visionCells = visionCells;

        let camX = this.player.x * CELL_SIZE - cw / 2 + CELL_SIZE / 2 + this.shakeX;
        let camY = this.player.y * CELL_SIZE - ch / 2 + CELL_SIZE / 2 + this.shakeY;
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
                    // 3D bevel: top/left lighter edges for raised stone look
                    ctx.strokeStyle = '#2a2a32';
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + CELL_SIZE - 1, py); ctx.stroke();
                    ctx.strokeStyle = '#333340';
                    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + CELL_SIZE - 1); ctx.stroke();
                } else {
                    const h = ((x * 374761393 + y * 668265263 + 1013904223) & 0x7FFFFFFF) % 100;
                    const v = (h % 7) - 3;
                    const isCorridor = cell.tile === TILE.CORRIDOR;
                    if (isCorridor) {
                        const r = theme.corrR + v, g = theme.corrG + v, b = theme.corrB + v;
                        ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
                    } else {
                        const r = theme.floorR + v, g = theme.floorG + v, b = theme.floorB + v;
                        ctx.fillStyle = `rgba(${r},${g},${b},0.45)`;
                    }
                    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

                    // Crack / dirt marks on ~8% of floor tiles
                    if (h < 8) {
                        ctx.fillStyle = 'rgba(0,0,0,0.25)';
                        const cx2 = px + 3 + (h % 11);
                        const cy2 = py + 4 + ((h * 7) % 10);
                        ctx.fillRect(cx2, cy2, 1 + (h % 3), 1);
                        if (h < 3) {
                            ctx.fillRect(cx2 + 2, cy2 - 1, 1, 1);
                        }
                    }
                }
            }
        }

        // --- WALL BOUNDARIES (theme-colored) ---
        ctx.strokeStyle = theme.wallEdge;
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
                    this.drawEntity(x * CELL_SIZE, y * CELL_SIZE, cell.entity, cell.monsterData, cell.lootData);
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

        // --- MINIMAP ---
        this.drawMinimap(cw, ch);

        // --- HIT FLASH OVERLAY (fast decay, time-independent) ---
        if (this.hitFlash > 0.005) {
            ctx.fillStyle = `rgba(255,0,0,${this.hitFlash})`;
            ctx.fillRect(0, 0, cw, ch);
            this.hitFlash *= 0.5;
        }
        if (this.damageFlash > 0.005) {
            ctx.fillStyle = `rgba(255,255,255,${this.damageFlash})`;
            ctx.fillRect(0, 0, cw, ch);
            this.damageFlash *= 0.5;
        }
    }

    triggerHitFlash() { this.hitFlash = 0.4; }
    triggerDamageFlash() { this.damageFlash = 0.35; }

    triggerShake(intensity) {
        this.shakeDuration = Math.max(this.shakeDuration, 0.35);
        this.shakeAmount = Math.max(this.shakeAmount, intensity);
    }

    drawMinimap(cw, ch) {
        const ctx = this.ctx;
        const d = this.dungeon;
        const mw = 100, mh = 80;
        const mx = cw - mw - 6, my = 6;
        const sclX = mw / (d.cols * CELL_SIZE);
        const sclY = mh / (d.rows * CELL_SIZE);

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(mx, my, mw, mh);
        ctx.strokeStyle = 'rgba(255,215,0,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx, my, mw, mh);

        const mmCtx = this.minimapCtx;
        mmCtx.clearRect(0, 0, 100, 80);

        for (let y = 0; y < d.rows; y++) {
            for (let x = 0; x < d.cols; x++) {
                const cell = d.getTile(x, y);
                if (!cell.explored) continue;
                const rx = x * CELL_SIZE * sclX;
                const ry = y * CELL_SIZE * sclY;
                const rw = Math.max(1, CELL_SIZE * sclX);
                const rh = Math.max(1, CELL_SIZE * sclY);

                if (cell.tile === TILE.WALL) {
                    mmCtx.fillStyle = cell.visible ? '#555' : '#2a2a2a';
                } else {
                    mmCtx.fillStyle = cell.visible ? '#999' : '#3a3a3a';
                }
                mmCtx.fillRect(rx, ry, rw, rh);

                if (cell.visible && cell.entity === ENTITY.EXIT) {
                    mmCtx.fillStyle = '#00ff88';
                    mmCtx.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
                }
                if (cell.visible && cell.entity === ENTITY.MONSTER) {
                    mmCtx.fillStyle = '#ff4444';
                    mmCtx.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
                }
            }
        }

        // Player dot
        const pdx = this.player.x * CELL_SIZE * sclX;
        const pdy = this.player.y * CELL_SIZE * sclY;
        mmCtx.fillStyle = '#ffd700';
        mmCtx.beginPath(); mmCtx.arc(pdx, pdy, 2.5, 0, Math.PI * 2); mmCtx.fill();

        ctx.drawImage(this.minimapCanvas, mx, my);
    }

    drawEntity(px, py, entity, monsterData, lootData) {
        const ctx = this.ctx;
        const cx = px + CELL_SIZE / 2;
        const cy = py + CELL_SIZE / 2;

        if (entity === ENTITY.LOOT) {
            this.drawLoot(px, py, lootData);
        } else if (entity === ENTITY.SILVER_CHEST) {
            // Large Silver Chest (~32x24)
            ctx.fillStyle = '#606060';
            ctx.fillRect(px - 5, py - 2, 28, 16);
            ctx.fillStyle = '#909090';
            ctx.fillRect(px - 3, py, 24, 12);
            ctx.fillStyle = '#b0b0b0';
            ctx.fillRect(px - 6, py - 4, 30, 6);
            ctx.fillStyle = '#d0d0d0';
            ctx.fillRect(px - 4, py - 3, 26, 4);
            // Lock
            ctx.fillStyle = '#c0c0c0';
            ctx.fillRect(px + 8, py + 2, 4, 4);
            ctx.fillStyle = '#888';
            ctx.fillRect(px + 9, py + 4, 2, 2);
            // Silver trim
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(px + 10, py - 5, 2, 3);
        } else if (entity === ENTITY.GOLD_CHEST) {
            // Large Gold Chest (~32x24)
            ctx.fillStyle = '#5a3a0a';
            ctx.fillRect(px - 5, py - 2, 28, 16);
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(px - 3, py, 24, 12);
            ctx.fillStyle = '#DAA520';
            ctx.fillRect(px - 6, py - 4, 30, 6);
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(px - 4, py - 3, 26, 4);
            // Lock
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(px + 8, py + 2, 4, 4);
            ctx.fillStyle = '#B8860B';
            ctx.fillRect(px + 9, py + 4, 2, 2);
            // Gold trim / sparkle
            ctx.fillStyle = '#FFEC8B';
            ctx.fillRect(px + 10, py - 5, 2, 3);
        } else if (entity === ENTITY.EXIT) {
            const unlocked = this.dungeon.exitPlaced && (this.dungeon.isBossFloor || this.dungeon.getKillPct() >= 60);
            if (unlocked) {
                ctx.fillStyle = '#2e5a2e';
                ctx.fillRect(px + 2, py + 1, 14, 16);
                ctx.fillStyle = '#4a8';
                ctx.fillRect(px + 4, py + 3, 10, 14);
                ctx.fillStyle = '#ffd700';
                ctx.beginPath(); ctx.arc(cx, cy + 4, 2, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillStyle = '#333';
                ctx.fillRect(px + 2, py + 1, 14, 16);
                ctx.fillStyle = '#555';
                ctx.fillRect(px + 4, py + 3, 10, 14);
                ctx.fillStyle = '#888';
                ctx.beginPath(); ctx.arc(cx, cy + 4, 2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#666';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🔒', cx, cy - 2);
            }
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

    drawLoot(px, py, item) {
        if (!item) return;
        const ctx = this.ctx;
        const rarityColors = {
            'rarity-common': '#aaa',
            'rarity-uncommon': '#4dff4d',
            'rarity-rare': '#4da6ff',
            'rarity-epic': '#c44dff',
            'rarity-legendary': '#ff8c00',
            'rarity-mythic': '#ffd700',
        };
        const color = rarityColors[item.rarity.color] || '#aaa';
        const cx = px + CELL_SIZE / 2;
        const baseY = py + CELL_SIZE / 2;

        // Light beam (vertical gradient, fading upward)
        const beamH = 48;
        const grad = ctx.createLinearGradient(cx, baseY, cx, baseY - beamH);
        grad.addColorStop(0, color);
        grad.addColorStop(0.3, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(cx - 3, baseY - beamH, 6, beamH);
        ctx.globalAlpha = 1.0;

        // Glow circle at base
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(cx, baseY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;

        // Item icon (small colored gem)
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, baseY, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    drawMonster(cx, cy, data) {
        const ctx = this.ctx;
        const bob = Math.sin(this.time * 3 + cx) * 1.2;
        const my = cy + bob;
        const isElite = data && data.isElite;
        const isBoss = data && data.isBoss;
        const name = data ? data.name : '史莱姆';
        const s = isBoss ? 5.0 : isElite ? 2.0 : 1.5;

        // Dark aura
        const auraColor = isBoss ? 'rgba(255,0,0,0.45)' : isElite ? 'rgba(255,140,0,0.35)' : 'rgba(180,20,20,0.2)';
        const auraR = isBoss ? 14 : isElite ? 12 : 10;
        const aura = ctx.createRadialGradient(cx, my, 1, cx, my, auraR);
        aura.addColorStop(0, auraColor);
        aura.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(cx, my, auraR, 0, Math.PI * 2); ctx.fill();

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(cx, my + 6, 5 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();

        ctx.save();
        ctx.translate(cx, my);
        ctx.scale(s, s);

        // Draw distinct body per type
        if (name.includes('史莱姆')) this.drawSlime(ctx);
        else if (name.includes('骷髅')) this.drawSkeleton(ctx);
        else if (name.includes('哥布林')) this.drawGoblin(ctx);
        else if (name.includes('蜘蛛')) this.drawSpider(ctx);
        else if (name.includes('石像鬼')) this.drawGargoyle(ctx);
        else if (name.includes('法师') || name.includes('法王')) this.drawMage(ctx);
        else if (name.includes('食人魔')) this.drawOgre(ctx);
        else if (name.includes('恶魔')) this.drawDemon(ctx);
        else if (name.includes('龙')) this.drawDragon(ctx);
        else if (name.includes('史莱姆')) this.drawSlime(ctx);
        else this.drawSlime(ctx); // fallback

        ctx.restore();

        // Elite/Boss markers
        if (isElite) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, my, 8 * s, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('★', cx + 7, my - 6);
        }
        if (isBoss) {
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(cx, my, 9 * s, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#FF0000';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('☠', cx + 7, my - 7);
        }
    }

    drawSlime(ctx) {
        ctx.fillStyle = '#4a8c3f';
        ctx.beginPath(); ctx.ellipse(0, 2, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6ab85a';
        ctx.beginPath(); ctx.ellipse(0, -1, 4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-2, -2, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(2, -2, 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-2, -2, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(2, -2, 0.5, 0, Math.PI * 2); ctx.fill();
    }

    drawSkeleton(ctx) {
        ctx.fillStyle = '#d4c8a0';
        ctx.beginPath(); ctx.arc(0, -3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, -3.5, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-1, -4, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1, -4, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d4c8a0'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(-3, 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(3, 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(-2, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(2, 7); ctx.stroke();
    }

    drawGoblin(ctx) {
        ctx.fillStyle = '#6b8c42';
        ctx.beginPath(); ctx.arc(0, -2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a7a35';
        ctx.fillRect(-2.5, 1, 5, 4);
        ctx.fillStyle = '#6b8c42'; ctx.beginPath();
        ctx.moveTo(-3, -3); ctx.lineTo(-5, -5); ctx.lineTo(-3, -1); ctx.fill();
        ctx.moveTo(3, -3); ctx.lineTo(5, -5); ctx.lineTo(3, -1); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-1.2, -2.5, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.2, -2.5, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath();
        ctx.arc(-1.2, -2.5, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.arc(1.2, -2.5, 0.4, 0, Math.PI * 2); ctx.fill();
    }

    drawSpider(ctx) {
        ctx.fillStyle = '#3a2040';
        ctx.beginPath(); ctx.ellipse(0, 1, 3.5, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a3060';
        ctx.beginPath(); ctx.arc(0, -1, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3a2040'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
        const legs = [[-3,-1,-5,-3],[-2,1,-5,0],[2,1,5,0],[3,-1,5,-3],[-3,2,-5,4],[-2,3,-4,5],[2,3,4,5],[3,2,5,4]];
        for (const [x1,y1,x2,y2] of legs) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
        ctx.fillStyle = '#f00'; ctx.beginPath();
        ctx.arc(-1.5, -1.5, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.arc(1.5, -1.5, 0.7, 0, Math.PI * 2); ctx.fill();
    }

    drawGargoyle(ctx) {
        ctx.fillStyle = '#6a6a7a';
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-5, -2); ctx.lineTo(-3, 4);
        ctx.lineTo(0, 5); ctx.lineTo(3, 4); ctx.lineTo(5, -2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a8a9a';
        ctx.beginPath(); ctx.arc(0, -2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff0';
        ctx.beginPath(); ctx.arc(-1.2, -2.5, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.2, -2.5, 0.8, 0, Math.PI * 2); ctx.fill();
    }

    drawMage(ctx) {
        ctx.fillStyle = '#3a2a5a';
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-5, -1); ctx.lineTo(0, -3);
        ctx.lineTo(5, -1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a4a7a';
        ctx.fillRect(-3, -2, 6, 6);
        ctx.fillStyle = '#d4c8a0';
        ctx.beginPath(); ctx.arc(0, -3, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff0';
        ctx.beginPath(); ctx.arc(-1, -3.5, 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1, -3.5, 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#aaf';
        ctx.beginPath(); ctx.arc(3, -1, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    drawOgre(ctx) {
        ctx.fillStyle = '#5a4020';
        ctx.fillRect(-3, -1, 6, 6);
        ctx.fillStyle = '#7a6040';
        ctx.beginPath(); ctx.arc(0, -3, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-1.5, -3.5, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.5, -3.5, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-1.5, -3.5, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.5, -3.5, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f44'; ctx.beginPath();
        ctx.ellipse(0, -1, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    }

    drawDemon(ctx) {
        ctx.fillStyle = '#6a2020';
        ctx.fillRect(-3, -1, 6, 6);
        ctx.fillStyle = '#8a3030';
        ctx.beginPath(); ctx.arc(0, -3, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f00';
        ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(-4, -8); ctx.lineTo(0, -6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(4, -8); ctx.lineTo(0, -6); ctx.fill();
        ctx.fillStyle = '#f80';
        ctx.beginPath(); ctx.arc(-1.2, -3.5, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.2, -3.5, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-1.2, -3.5, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.2, -3.5, 0.4, 0, Math.PI * 2); ctx.fill();
    }

    drawDragon(ctx) {
        ctx.fillStyle = '#2a6030';
        ctx.beginPath(); ctx.ellipse(0, 1, 4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a8040';
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-3, 0); ctx.lineTo(0, -1); ctx.lineTo(3, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f80';
        ctx.beginPath(); ctx.arc(-1.5, -2, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1.5, -2, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3a8040'; ctx.lineWidth = 1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(-6, -5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(6, -5); ctx.stroke();
        ctx.fillStyle = '#f44';
        ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(-1, -6); ctx.lineTo(1, -6); ctx.closePath(); ctx.fill();
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

// --- Floor Theme Colors ---
function getFloorTheme(floor) {
    if (floor <= 9) return { name:'地窖', wallEdge:'#c8a020', floorR:25,floorG:25,floorB:35, corrR:40,corrG:32,corrB:24 };
    if (floor <= 19) return { name:'矿洞', wallEdge:'#aa7744', floorR:30,floorG:28,floorB:22, corrR:45,corrG:35,corrB:20 };
    if (floor <= 29) return { name:'墓穴', wallEdge:'#6666aa', floorR:22,floorG:22,floorB:38, corrR:30,corrG:28,corrB:42 };
    if (floor <= 39) return { name:'熔岩', wallEdge:'#cc4422', floorR:38,floorG:22,floorB:18, corrR:42,corrG:28,corrB:18 };
    if (floor <= 49) return { name:'深渊', wallEdge:'#8822aa', floorR:28,floorG:18,floorB:35, corrR:32,corrG:22,corrB:38 };
    return { name:'龙巢', wallEdge:'#ff4444', floorR:32,floorG:18,floorB:20, corrR:38,corrG:22,corrB:22 };
}
