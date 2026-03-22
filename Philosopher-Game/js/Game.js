import Grid from './Grid.js';
import Player from './Player.js';
import NPC from './NPC.js';
import GameLog from './GameLog.js';
import Renderer from './Renderer.js';
import UI from './ui.js';
import { ZONES, NPC_DATA, ITEM_DATA } from './data.js';

const TILE_SIZE = 40;
const MAX_MOVE_POINTS = 4;
const MAX_ACTION_POINTS = 1;
const MELEE_RANGE = 2;

export default class Game {
    constructor(canvas) {
        this.renderer = new Renderer(canvas, TILE_SIZE);
        this.ui = new UI();
        this.gameLog = new GameLog();
        this.canvas = canvas;

        this.turn = 1;
        this.currentZoneIndex = 0;

        this.movePoints = MAX_MOVE_POINTS;
        this.actionPoints = MAX_ACTION_POINTS;

        // Phases: 'player_turn', 'ai', 'gameover'
        this.phase = 'player_turn';

        this.cursor = null;
        this.reachableTiles = new Map();

        this.loadZone(0);

        // Bind UI callbacks
        this.ui.onEndTurn = () => this.endPlayerTurn();
        this.ui.onSpeak = (text) => this.handleSpeak(text);

        // Left click: move
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Right click: context menu
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleCanvasRightClick(e);
        });

        this.gameLog.add('door', this.player.name, ZONES[0].name, `${this.player.name} enters the ${ZONES[0].name}.`);
        this.ui.updateLog(this.gameLog.getDisplayLines());

        this.refreshTurnState();
    }

    loadZone(zoneIndex) {
        const zoneData = ZONES[zoneIndex];
        this.currentZoneIndex = zoneIndex;
        this.grid = new Grid(zoneData);
        this.renderer.resize(zoneData.cols, zoneData.rows);

        this.player = this.player || new Player(zoneData.playerStart.col, zoneData.playerStart.row);
        this.player.moveTo(zoneData.playerStart.col, zoneData.playerStart.row);

        this.npcs = [];
        for (const npcId of zoneData.npcs) {
            const data = NPC_DATA[npcId];
            if (data) {
                this.npcs.push(new NPC(npcId, data, data.col, data.row));
            }
        }

        this.items = [];
        for (const itemPlacement of zoneData.items) {
            const data = ITEM_DATA[itemPlacement.id];
            if (data) {
                this.items.push({
                    id: itemPlacement.id,
                    col: itemPlacement.col,
                    row: itemPlacement.row,
                    symbol: data.symbol,
                    color: data.color,
                    name: data.name,
                    description: data.description,
                    actionEffect: data.actionEffect,
                    dialogueEffect: data.dialogueEffect,
                    collected: false,
                });
            }
        }

        this.phase = 'player_turn';
    }

    // --- Helpers ---

    getOccupiedSet() {
        const set = new Set();
        for (const npc of this.npcs) {
            if (npc.alive) set.add(`${npc.col},${npc.row}`);
        }
        return set;
    }

    computeReachable() {
        if (this.movePoints > 0) {
            this.reachableTiles = this.grid.getReachable(
                this.player.col, this.player.row,
                this.movePoints,
                this.getOccupiedSet()
            );
        } else {
            this.reachableTiles = new Map();
        }
    }

    getEntityAt(col, row) {
        for (const npc of this.npcs) {
            if (npc.alive && npc.col === col && npc.row === row) return npc;
        }
        return null;
    }

    getItemAt(col, row) {
        for (const item of this.items) {
            if (!item.collected && item.col === col && item.row === row) return item;
        }
        return null;
    }

    isInMeleeRange(col, row) {
        return (Math.abs(this.player.col - col) + Math.abs(this.player.row - row)) <= MELEE_RANGE;
    }

    broadcast(type, actorName, position, details) {
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            const canPerceive = (type === 'speak')
                ? npc.canHear(position.col, position.row)
                : npc.canSee(position.col, position.row);
            if (canPerceive) {
                npc.addToLog({ turn: this.turn, type, actor: actorName, details });
            }
        }
    }

    refreshTurnState() {
        this.computeReachable();
        this.updateControls();
        this.updateHud();
        this.ui.updateInventory(this.player.inventory, (index) => this.handleUseItem(index), (index) => this.handleDropItem(index));
        this.render();
    }

    updateControls() {
        const isPlayerTurn = this.phase === 'player_turn';
        const hasAction = this.actionPoints > 0 && isPlayerTurn;
        this.ui.setSpeakEnabled(hasAction);
        this.ui.setEndTurnEnabled(isPlayerTurn);
    }

    updateHud() {
        const zoneName = ZONES[this.currentZoneIndex].name;
        this.ui.updateHud(
            this.player.hp, this.player.maxHp,
            zoneName, this.turn,
            this.movePoints, MAX_MOVE_POINTS,
            this.actionPoints, MAX_ACTION_POINTS,
        );
    }

    // --- Player speech ---

    handleSpeak(text) {
        if (this.actionPoints <= 0 || this.phase !== 'player_turn') return;

        this.actionPoints--;
        const pos = { col: this.player.col, row: this.player.row };

        this.gameLog.add('speak', this.player.name, null, text, pos);
        this.broadcast('speak', this.player.name, pos, `${this.player.name} says: "${text}"`);

        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    // --- End turn ---

    endPlayerTurn() {
        if (this.phase !== 'player_turn') return;

        this.phase = 'ai';
        this.ui.disableAllActions();
        this.render();

        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            this.runNPCTurn(npc);
        }

        this.turn++;
        this.gameLog.setTurn(this.turn);
        this.movePoints = MAX_MOVE_POINTS;
        this.actionPoints = MAX_ACTION_POINTS;
        this.phase = 'player_turn';
        this.refreshTurnState();
        this.ui.updateLog(this.gameLog.getDisplayLines());
    }

    runNPCTurn(npc) {
        // Set up turn: compute reachable tiles and available actions
        const occupied = this.getOccupiedSet();
        occupied.delete(`${npc.col},${npc.row}`);
        occupied.add(`${this.player.col},${this.player.row}`);
        npc.beginTurn(this.grid, occupied);
        npc.computeAvailableActions(this.getGameState());
        npc.computeSurroundings(this.getGameState());

        // Ask NPC what to do (placeholder AI; later: LLM with npc.getFullContext())
        const turnContext = this.getGameState();
        const decision = npc.decideAction(turnContext);

        // Execute movement
        if (decision.moveTo) {
            const valid = npc.availableCoordinates.some(
                c => c.col === decision.moveTo.col && c.row === decision.moveTo.row
            );
            if (valid) {
                npc.moveTo(decision.moveTo.col, decision.moveTo.row);
                this.gameLog.add('move', npc.name, null, `${npc.name} moved.`, { col: npc.col, row: npc.row });
            }
        }

        // Re-compute available actions after movement (adjacency may have changed)
        npc.computeAvailableActions(this.getGameState());

        // Execute action
        if (decision.action) {
            const actionAllowed = npc.availableActions.some(a => a.type === decision.action.type);
            if (!actionAllowed) return;

            switch (decision.action.type) {
                case 'speak': {
                    const msg = decision.action.message;
                    const pos = { col: npc.col, row: npc.row };
                    this.gameLog.add('speak', npc.name, null, msg, pos);
                    this.broadcast('speak', npc.name, pos, `${npc.name} says: "${msg}"`);
                    break;
                }
                case 'attack': {
                    const targetId = decision.action.targetId;
                    if (targetId === 'player') {
                        const dist = Math.abs(this.player.col - npc.col) + Math.abs(this.player.row - npc.row);
                        if (dist <= MELEE_RANGE) {
                            const dmg = this.player.takeDamage(npc.bio.baseDamage);
                            this.gameLog.add('attack', npc.name, this.player.name, `${dmg} damage. ${this.player.name} HP: ${this.player.hp}/${this.player.maxHp}`, { col: npc.col, row: npc.row });
                            this.broadcast('attack', npc.name, { col: npc.col, row: npc.row }, `${npc.name} attacked ${this.player.name} for ${dmg} damage.`);
                        }
                    } else {
                        // NPC attacking another NPC
                        const targetNpc = this.npcs.find(n => n.id === targetId);
                        if (targetNpc && targetNpc.alive) {
                            const dist = Math.abs(targetNpc.col - npc.col) + Math.abs(targetNpc.row - npc.row);
                            if (dist <= MELEE_RANGE) {
                                const dmg = targetNpc.takeDamage(npc.bio.baseDamage);
                                this.gameLog.add('attack', npc.name, targetNpc.name, `${dmg} damage. ${targetNpc.name} HP: ${targetNpc.conditions.hp}/${targetNpc.bio.maxHp}`, { col: npc.col, row: npc.row });
                                this.broadcast('attack', npc.name, { col: npc.col, row: npc.row }, `${npc.name} attacked ${targetNpc.name} for ${dmg} damage.`);
                                if (!targetNpc.alive) {
                                    this.gameLog.add('kill', npc.name, targetNpc.name, `${targetNpc.name} has been slain.`, { col: npc.col, row: npc.row });
                                    this.broadcast('kill', npc.name, { col: npc.col, row: npc.row }, `${npc.name} killed ${targetNpc.name}.`);
                                }
                            }
                        }
                    }
                    break;
                }
                case 'use_item': {
                    const idx = decision.action.itemIndex;
                    if (idx >= 0 && idx < npc.inventory.length) {
                        const item = npc.removeItem(idx);
                        this.gameLog.add('use_item', npc.name, item.name, `${npc.name} used ${item.name}.`, { col: npc.col, row: npc.row });
                        this.broadcast('use_item', npc.name, { col: npc.col, row: npc.row }, `${npc.name} used ${item.name}.`);
                    }
                    break;
                }
                case 'drop': {
                    const idx = decision.action.itemIndex;
                    if (idx >= 0 && idx < npc.inventory.length) {
                        const dropTile = this.findDropTile(npc.col, npc.row);
                        if (dropTile) {
                            const item = npc.removeItem(idx);
                            this.items.push({
                                id: item.id || item.name.toLowerCase().replace(/\s+/g, '_'),
                                col: dropTile.col,
                                row: dropTile.row,
                                symbol: '*',
                                color: '#cccccc',
                                name: item.name,
                                description: item.description,
                                actionEffect: item.actionEffect || null,
                                dialogueEffect: item.dialogueEffect || null,
                                collected: false,
                            });
                            this.gameLog.add('drop', npc.name, item.name, `${npc.name} dropped ${item.name}.`, { col: npc.col, row: npc.row });
                            this.broadcast('drop', npc.name, { col: npc.col, row: npc.row }, `${npc.name} dropped ${item.name}.`);
                        }
                    }
                    break;
                }
            }
        }
    }

    // --- Input: left click = move ---

    handleCanvasClick(e) {
        if (this.phase !== 'player_turn') return;
        this.ui.closeContextMenu();

        const rect = this.canvas.getBoundingClientRect();
        const col = Math.floor((e.clientX - rect.left) / TILE_SIZE);
        const row = Math.floor((e.clientY - rect.top) / TILE_SIZE);
        this.cursor = { col, row };

        // Move to clicked tile if reachable
        const key = `${col},${row}`;
        const target = this.reachableTiles.get(key);
        if (target && this.movePoints > 0 && target.dist <= this.movePoints) {
            this.player.moveTo(col, row);
            this.movePoints -= target.dist;
            this.gameLog.add('move', this.player.name, null, `${this.player.name} moved (${target.dist} steps).`, { col, row });
            this.broadcast('move', this.player.name, { col, row }, `${this.player.name} moved.`);
            this.ui.updateLog(this.gameLog.getDisplayLines());
            this.refreshTurnState();
        }

        this.render();
    }

    // --- Input: right click = context menu ---

    handleCanvasRightClick(e) {
        if (this.phase !== 'player_turn') return;

        const rect = this.canvas.getBoundingClientRect();
        const col = Math.floor((e.clientX - rect.left) / TILE_SIZE);
        const row = Math.floor((e.clientY - rect.top) / TILE_SIZE);

        const options = this.buildContextOptions(col, row);
        if (options.length > 0) {
            this.ui.showContextMenu(e.clientX, e.clientY, options);
        }
    }

    buildContextOptions(col, row) {
        const options = [];
        const hasAction = this.actionPoints > 0;
        const inMelee = this.isInMeleeRange(col, row);
        const onPlayer = (col === this.player.col && row === this.player.row);

        // Player's own tile
        if (onPlayer) {
            options.push({
                label: 'Inspect self',
                action: () => this.ui.showInspect({
                    name: this.player.name,
                    description: this.player.description || 'You.',
                    hp: `${this.player.hp}/${this.player.maxHp}`,
                    damage: this.player.getDamage(),
                    armor: this.player.getArmor(),
                    inventory: this.player.inventory.map(i => i.name),
                }),
            });
        }

        // NPC on this tile?
        const npc = this.getEntityAt(col, row);
        if (npc) {
            options.push({
                label: `Inspect ${npc.name}`,
                action: () => this.ui.showInspect(npc.getPublicInfo()),
            });
            if (npc.alive && inMelee) {
                options.push({
                    label: `Attack ${npc.name}`,
                    disabled: !hasAction,
                    action: () => this.doAttack(npc),
                });
            }
        }

        // Item on this tile?
        const item = this.getItemAt(col, row);
        if (item) {
            options.push({
                label: `Inspect ${item.name}`,
                action: () => this.ui.showInspect({
                    name: item.name,
                    description: item.description,
                    actionEffect: item.actionEffect,
                    dialogueEffect: item.dialogueEffect,
                }),
            });
            if (onPlayer) {
                options.push({
                    label: `Pick up ${item.name}`,
                    disabled: !hasAction,
                    action: () => this.doPickup(item),
                });
            }
        }

        // Door on this tile?
        if (this.grid.isDoor(col, row) && onPlayer) {
            const doorTarget = this.grid.getDoorTarget(col, row);
            if (doorTarget) {
                const targetName = ZONES[doorTarget.zone].name;
                options.push({
                    label: `Enter ${targetName}`,
                    action: () => this.doDoor(doorTarget),
                });
            }
        }

        if (options.length > 0) {
            options.push({ label: 'Cancel', action: () => {} });
        }

        return options;
    }

    // --- Actions ---

    doAttack(npc) {
        if (this.actionPoints <= 0) return;
        this.actionPoints--;

        const dmg = this.player.getDamage();
        npc.takeDamage(dmg);
        const pos = { col: this.player.col, row: this.player.row };

        this.gameLog.add('attack', this.player.name, npc.name, `${dmg} damage. ${npc.name} HP: ${npc.conditions.hp}/${npc.bio.maxHp}`, pos);
        this.broadcast('attack', this.player.name, pos, `${this.player.name} attacked ${npc.name} for ${dmg} damage.`);

        if (!npc.alive) {
            this.gameLog.add('kill', this.player.name, npc.name, `${npc.name} has been slain.`, pos);
            this.broadcast('kill', this.player.name, pos, `${this.player.name} killed ${npc.name}.`);
        }

        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    doPickup(item) {
        if (this.actionPoints <= 0) return;
        this.actionPoints--;
        item.collected = true;
        this.player.addItem({
            id: item.id,
            name: item.name,
            description: item.description,
            actionEffect: item.actionEffect,
            dialogueEffect: item.dialogueEffect,
        });

        const pos = { col: this.player.col, row: this.player.row };
        this.gameLog.add('pickup', this.player.name, item.name, `${this.player.name} picked up ${item.name}.`, pos);
        this.broadcast('pickup', this.player.name, pos, `${this.player.name} picked up ${item.name}.`);
        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    doDoor(doorTarget) {
        const targetZoneName = ZONES[doorTarget.zone].name;
        this.gameLog.add('door', this.player.name, targetZoneName, `${this.player.name} entered ${targetZoneName}.`);
        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.loadZone(doorTarget.zone);
        this.player.moveTo(doorTarget.col, doorTarget.row);
        this.movePoints = MAX_MOVE_POINTS;
        this.actionPoints = MAX_ACTION_POINTS;
        this.refreshTurnState();
    }

    handleUseItem(index) {
        if (this.actionPoints <= 0 || this.phase !== 'player_turn') return;

        const item = this.player.inventory[index];
        if (!item) return;

        // Placeholder: log usage, remove from inventory
        this.actionPoints--;
        this.player.inventory.splice(index, 1);

        const pos = { col: this.player.col, row: this.player.row };
        this.gameLog.add('use_item', this.player.name, item.name, `${this.player.name} used ${item.name}.`, pos);
        this.broadcast('use_item', this.player.name, pos, `${this.player.name} used ${item.name}.`);
        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    handleDropItem(index) {
        if (this.phase !== 'player_turn') return;

        const item = this.player.inventory[index];
        if (!item) return;

        const dropTile = this.findDropTile(this.player.col, this.player.row);
        if (!dropTile) return; // no space

        this.player.inventory.splice(index, 1);
        this.items.push({
            id: item.id,
            col: dropTile.col,
            row: dropTile.row,
            symbol: '*',
            color: '#cccccc',
            name: item.name,
            description: item.description,
            actionEffect: item.actionEffect,
            dialogueEffect: item.dialogueEffect,
            collected: false,
        });

        const pos = { col: this.player.col, row: this.player.row };
        this.gameLog.add('drop', this.player.name, item.name, `${this.player.name} dropped ${item.name}.`, pos);
        this.broadcast('drop', this.player.name, pos, `${this.player.name} dropped ${item.name}.`);
        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    findDropTile(col, row) {
        const dirs = [[0,-1],[0,1],[-1,0],[1,0],[0,0]];
        for (const [dc, dr] of dirs) {
            const nc = col + dc;
            const nr = row + dr;
            if (!this.grid.isWalkable(nc, nr)) continue;
            if (this.getEntityAt(nc, nr)) continue;
            if (nc === this.player.col && nr === this.player.row && dc !== 0 && dr !== 0) continue;
            // Check no item already there
            if (this.getItemAt(nc, nr)) continue;
            return { col: nc, row: nr };
        }
        return null;
    }

    // --- State ---

    getGameState() {
        return {
            grid: this.grid,
            player: this.player,
            npcs: this.npcs,
            items: this.items,
            turn: this.turn,
            phase: this.phase,
            movePoints: this.movePoints,
            actionPoints: this.actionPoints,
            reachableTiles: this.reachableTiles,
            attackTargets: [],
            cursor: this.cursor,
            zoneName: ZONES[this.currentZoneIndex].name,
        };
    }

    render() {
        this.renderer.render(this.getGameState());
    }
}
