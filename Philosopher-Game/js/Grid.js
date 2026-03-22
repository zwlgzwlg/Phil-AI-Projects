import { TILE } from './data.js';

export default class Grid {
    constructor(zoneData) {
        this.cols = zoneData.cols;
        this.rows = zoneData.rows;
        this.map = zoneData.map.map(row => [...row]); // deep copy
        this.doorTargets = zoneData.doorTargets;
    }

    getTile(col, row) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return TILE.WALL;
        return this.map[row][col];
    }

    isWalkable(col, row) {
        const tile = this.getTile(col, row);
        return tile === TILE.FLOOR || tile === TILE.DOOR;
    }

    isDoor(col, row) {
        return this.getTile(col, row) === TILE.DOOR;
    }

    getDoorTarget(col, row) {
        const key = `${col},${row}`;
        return this.doorTargets[key] || null;
    }

    isAdjacent(col1, row1, col2, row2) {
        const dc = Math.abs(col1 - col2);
        const dr = Math.abs(row1 - row2);
        return (dc + dr) === 1;
    }

    getAdjacentWalkable(col, row) {
        const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        const result = [];
        for (const [dc, dr] of dirs) {
            const nc = col + dc;
            const nr = row + dr;
            if (this.isWalkable(nc, nr)) {
                result.push({ col: nc, row: nr });
            }
        }
        return result;
    }

    // BFS: find all tiles reachable within `maxSteps` from (startCol, startRow).
    // `occupied` is a Set of "col,row" strings for tiles blocked by entities.
    // Returns a Map of "col,row" -> { col, row, dist, path }
    getReachable(startCol, startRow, maxSteps, occupied = new Set()) {
        const reachable = new Map();
        const queue = [{ col: startCol, row: startRow, dist: 0, path: [] }];
        const visited = new Set();
        visited.add(`${startCol},${startRow}`);

        while (queue.length > 0) {
            const cur = queue.shift();
            if (cur.dist > 0) {
                reachable.set(`${cur.col},${cur.row}`, cur);
            }
            if (cur.dist >= maxSteps) continue;

            const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
            for (const [dc, dr] of dirs) {
                const nc = cur.col + dc;
                const nr = cur.row + dr;
                const key = `${nc},${nr}`;
                if (visited.has(key)) continue;
                if (!this.isWalkable(nc, nr)) continue;
                if (occupied.has(key)) continue;
                visited.add(key);
                queue.push({
                    col: nc,
                    row: nr,
                    dist: cur.dist + 1,
                    path: [...cur.path, { col: nc, row: nr }],
                });
            }
        }
        return reachable;
    }

    // Get shortest path from start to target (BFS). Returns array of {col,row} or null.
    getPath(startCol, startRow, targetCol, targetRow, occupied = new Set()) {
        if (startCol === targetCol && startRow === targetRow) return [];
        const queue = [{ col: startCol, row: startRow, path: [] }];
        const visited = new Set();
        visited.add(`${startCol},${startRow}`);

        while (queue.length > 0) {
            const cur = queue.shift();
            const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
            for (const [dc, dr] of dirs) {
                const nc = cur.col + dc;
                const nr = cur.row + dr;
                const key = `${nc},${nr}`;
                if (visited.has(key)) continue;
                if (!this.isWalkable(nc, nr)) continue;
                if (occupied.has(key)) continue;
                visited.add(key);
                const newPath = [...cur.path, { col: nc, row: nr }];
                if (nc === targetCol && nr === targetRow) return newPath;
                queue.push({ col: nc, row: nr, path: newPath });
            }
        }
        return null;
    }
}
