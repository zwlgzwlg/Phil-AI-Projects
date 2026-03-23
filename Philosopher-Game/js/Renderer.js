import { TILE } from './data.js';

const BUBBLE_MAX_CHARS = 90;
const BUBBLE_PAD_X = 8;
const BUBBLE_PAD_Y = 5;
const BUBBLE_FONT = '11px monospace';
const BUBBLE_LINE_HEIGHT = 14;
const BUBBLE_MAX_WIDTH = 220;

export default class Renderer {
    constructor(canvas, tileSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = tileSize;
    }

    resize(cols, rows) {
        this.canvas.width = cols * this.tileSize;
        this.canvas.height = rows * this.tileSize;
    }

    clear() {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid(grid) {
        const ts = this.tileSize;
        for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
                const tile = grid.getTile(c, r);
                let color;
                switch (tile) {
                    case TILE.WALL:  color = '#333'; break;
                    case TILE.DOOR:  color = '#553311'; break;
                    case TILE.FLOOR:
                    default:         color = '#1a1a2e'; break;
                }
                this.ctx.fillStyle = color;
                this.ctx.fillRect(c * ts, r * ts, ts, ts);

                this.ctx.strokeStyle = '#222';
                this.ctx.lineWidth = 0.5;
                this.ctx.strokeRect(c * ts, r * ts, ts, ts);

                if (tile === TILE.DOOR) {
                    this.ctx.fillStyle = '#aa8833';
                    this.ctx.font = `${ts * 0.5}px monospace`;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText('⊞', c * ts + ts / 2, r * ts + ts / 2);
                }
            }
        }
    }

    drawEntity(col, row, symbol, color, alive = true) {
        const ts = this.tileSize;
        const cx = col * ts + ts / 2;
        const cy = row * ts + ts / 2;

        this.ctx.fillStyle = alive ? color : '#444';
        this.ctx.font = `bold ${ts * 0.6}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(symbol, cx, cy);

        if (!alive) {
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(cx - 8, cy - 8);
            this.ctx.lineTo(cx + 8, cy + 8);
            this.ctx.moveTo(cx + 8, cy - 8);
            this.ctx.lineTo(cx - 8, cy + 8);
            this.ctx.stroke();
        }
    }

    drawItems(items) {
        for (const item of items) {
            if (item.collected) continue;
            this.drawEntity(item.col, item.row, item.symbol, item.color);
        }
    }

    drawReachableHighlights(reachableTiles) {
        const ts = this.tileSize;
        for (const [, tile] of reachableTiles) {
            this.ctx.fillStyle = 'rgba(100, 200, 100, 0.15)';
            this.ctx.fillRect(tile.col * ts, tile.row * ts, ts, ts);
            this.ctx.strokeStyle = 'rgba(100, 200, 100, 0.35)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(tile.col * ts, tile.row * ts, ts, ts);
        }
    }

    drawAttackHighlights(tiles) {
        const ts = this.tileSize;
        this.ctx.fillStyle = 'rgba(255, 80, 80, 0.25)';
        this.ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
        this.ctx.lineWidth = 1;
        for (const { col, row } of tiles) {
            this.ctx.fillRect(col * ts, row * ts, ts, ts);
            this.ctx.strokeRect(col * ts, row * ts, ts, ts);
        }
    }

    drawCursorHighlight(col, row) {
        const ts = this.tileSize;
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(col * ts + 1, row * ts + 1, ts - 2, ts - 2);
    }

    drawLabel(col, row, text, color) {
        const ts = this.tileSize;
        this.ctx.fillStyle = color;
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(text, col * ts + ts / 2, row * ts - 2);
    }

    // --- Door entities ---

    drawDoorEntities(doors) {
        const ts = this.tileSize;
        for (const door of doors) {
            this.ctx.fillStyle = '#553311';
            this.ctx.fillRect(door.col * ts, door.row * ts, ts, ts);
            this.ctx.strokeStyle = '#222';
            this.ctx.lineWidth = 0.5;
            this.ctx.strokeRect(door.col * ts, door.row * ts, ts, ts);
            this.ctx.fillStyle = '#aa8833';
            this.ctx.font = `${ts * 0.5}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('⊞', door.col * ts + ts / 2, door.row * ts + ts / 2);
        }
    }

    // --- Movement trail arrows ---

    drawMovementTrails(trails) {
        const ts = this.tileSize;
        const ctx = this.ctx;

        for (const trail of trails) {
            if (trail.fromCol === trail.toCol && trail.fromRow === trail.toRow) continue;

            const x1 = trail.fromCol * ts + ts / 2;
            const y1 = trail.fromRow * ts + ts / 2;
            const x2 = trail.toCol  * ts + ts / 2;
            const y2 = trail.toRow  * ts + ts / 2;

            const angle = Math.atan2(y2 - y1, x2 - x1);
            // Shorten so the line doesn't extend into entity glyphs
            const shorten = ts * 0.28;
            const sx1 = x1 + Math.cos(angle) * shorten;
            const sy1 = y1 + Math.sin(angle) * shorten;
            const sx2 = x2 - Math.cos(angle) * shorten;
            const sy2 = y2 - Math.sin(angle) * shorten;

            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = trail.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx2, sy2);
            ctx.stroke();

            // Arrowhead
            ctx.setLineDash([]);
            ctx.lineWidth = 2;
            const head = 9;
            ctx.beginPath();
            ctx.moveTo(sx2, sy2);
            ctx.lineTo(sx2 - head * Math.cos(angle - Math.PI / 5), sy2 - head * Math.sin(angle - Math.PI / 5));
            ctx.moveTo(sx2, sy2);
            ctx.lineTo(sx2 - head * Math.cos(angle + Math.PI / 5), sy2 - head * Math.sin(angle + Math.PI / 5));
            ctx.stroke();

            ctx.restore();
        }
    }

    // --- Speech bubbles ---

    drawSpeechBubbles(bubbles) {
        const ts = this.tileSize;
        const ctx = this.ctx;

        ctx.save();
        ctx.font = BUBBLE_FONT;

        for (const bubble of bubbles) {
            // Truncate text
            let text = bubble.text;
            if (text.length > BUBBLE_MAX_CHARS) {
                text = text.slice(0, BUBBLE_MAX_CHARS - 1) + '…';
            }

            // Word-wrap to BUBBLE_MAX_WIDTH
            const lines = this._wrapText(ctx, text, BUBBLE_MAX_WIDTH - BUBBLE_PAD_X * 2);
            const boxW = Math.min(BUBBLE_MAX_WIDTH,
                Math.max(...lines.map(l => ctx.measureText(l).width)) + BUBBLE_PAD_X * 2);
            const boxH = lines.length * BUBBLE_LINE_HEIGHT + BUBBLE_PAD_Y * 2;

            const cx = bubble.col * ts + ts / 2;
            const tipY = bubble.row * ts - 2;   // bottom of bubble above tile
            const boxX = cx - boxW / 2;
            const boxY = tipY - boxH - 7;       // 7px pointer height

            // Clamp horizontally inside canvas
            const clampedX = Math.max(2, Math.min(this.canvas.width - boxW - 2, boxX));
            // If near top edge, flip below the entity
            const flipped = boxY < 2;
            const finalY = flipped ? (bubble.row * ts + ts + 6) : Math.max(2, boxY);

            // Text with dark outline for legibility over any background
            ctx.font = BUBBLE_FONT;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.lineJoin = 'round';
            for (let i = 0; i < lines.length; i++) {
                ctx.strokeText(lines[i], clampedX + BUBBLE_PAD_X, finalY + BUBBLE_PAD_Y + i * BUBBLE_LINE_HEIGHT);
            }
            ctx.fillStyle = '#fff';
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], clampedX + BUBBLE_PAD_X, finalY + BUBBLE_PAD_Y + i * BUBBLE_LINE_HEIGHT);
            }
        }

        ctx.restore();
    }

    _wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let current = '';
        for (const word of words) {
            const test = current ? current + ' ' + word : word;
            if (ctx.measureText(test).width > maxWidth && current) {
                lines.push(current);
                current = word;
            } else {
                current = test;
            }
        }
        if (current) lines.push(current);
        return lines.length ? lines : [text];
    }

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    drawThinkingIndicator({ col, row, color, dots }) {
        const ts = this.tileSize;
        const ctx = this.ctx;
        const text = 'thinking' + '.'.repeat(dots + 1);

        ctx.save();
        ctx.font = 'italic 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const cx = col * ts + ts / 2;
        // Draw above the name label (which sits at row * ts - 2)
        const y = row * ts - 15;

        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineJoin = 'round';
        ctx.strokeText(text, cx, y);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.75;
        ctx.fillText(text, cx, y);

        ctx.restore();
    }

    // Full render pass
    render(gameState) {
        this.clear();
        this.drawGrid(gameState.grid);

        if (gameState.phase === 'player_turn' && gameState.movePoints > 0) {
            this.drawReachableHighlights(gameState.reachableTiles);
        }

        // Door entities (below items and characters)
        this.drawDoorEntities(gameState.doors || []);

        // Movement trails (below entities)
        this.drawMovementTrails(gameState.movementTrails || []);

        this.drawItems(gameState.items);

        for (const npc of gameState.npcs) {
            this.drawEntity(npc.col, npc.row, npc.symbol, npc.color, npc.alive);
            if (npc.alive) {
                this.drawLabel(npc.col, npc.row, npc.name, npc.color);
            }
        }

        this.drawEntity(gameState.player.col, gameState.player.row, gameState.player.symbol, gameState.player.color);

        if (gameState.cursor) {
            this.drawCursorHighlight(gameState.cursor.col, gameState.cursor.row);
        }

        // Speech bubbles (on top of everything)
        this.drawSpeechBubbles(gameState.speechBubbles || []);

        // Thinking indicator (topmost)
        if (gameState.thinkingNpc) {
            this.drawThinkingIndicator(gameState.thinkingNpc);
        }
    }
}
