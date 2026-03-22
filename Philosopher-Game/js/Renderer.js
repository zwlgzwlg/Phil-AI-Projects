import { TILE } from './data.js';

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

                // Grid lines
                this.ctx.strokeStyle = '#222';
                this.ctx.lineWidth = 0.5;
                this.ctx.strokeRect(c * ts, r * ts, ts, ts);

                // Door indicator
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

    // Highlight reachable tiles (movement range)
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

    // Full render pass
    render(gameState) {
        this.clear();
        this.drawGrid(gameState.grid);

        // Highlight reachable tiles during player turn
        if (gameState.phase === 'player_turn' && gameState.movePoints > 0) {
            this.drawReachableHighlights(gameState.reachableTiles);
        }

        // Items
        this.drawItems(gameState.items);

        // NPCs
        for (const npc of gameState.npcs) {
            this.drawEntity(npc.col, npc.row, npc.symbol, npc.color, npc.alive);
            if (npc.alive) {
                this.drawLabel(npc.col, npc.row, npc.name, npc.color);
            }
        }

        // Player
        this.drawEntity(gameState.player.col, gameState.player.row, gameState.player.symbol, gameState.player.color);

        // Cursor
        if (gameState.cursor) {
            this.drawCursorHighlight(gameState.cursor.col, gameState.cursor.row);
        }
    }
}
