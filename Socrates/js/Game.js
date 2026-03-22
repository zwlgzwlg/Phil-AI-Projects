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
const HEARING_RANGE = 5;

export default class Game {
    constructor(canvas) {
        this.renderer = new Renderer(canvas, TILE_SIZE);
        this.ui = new UI();
        this.gameLog = new GameLog();
        this.canvas = canvas;

        this.turn = 1;
        this.currentZoneIndex = 0;

        // Player resources
        this.movePoints = MAX_MOVE_POINTS;
        this.actionPoints = MAX_ACTION_POINTS;

        // Phases: 'player_turn', 'select_attack', 'ai', 'gameover'
        this.phase = 'player_turn';

        this.cursor = null;
        this.reachableTiles = new Map();
        this.attackTargets = [];

        // Load first zone
        this.loadZone(0);

        // Bind UI callbacks
        this.ui.onAction = (type) => this.handleAction(type);
        this.ui.onEndTurn = () => this.endPlayerTurn();
        this.ui.onSpeak = (text) => this.handleSpeak(text);

        // Canvas click
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        this.gameLog.add('door', 'Socrates', ZONES[0].name, `Socrates enters the ${ZONES[0].name}.`);
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

    getAdjacentNPCs(col, row, alive = true) {
        const result = [];
        const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        for (const [dc, dr] of dirs) {
            const nc = col + dc;
            const nr = row + dr;
            const npc = this.getEntityAt(nc, nr);
            if (npc && (!alive || npc.alive)) result.push(npc);
        }
        return result;
    }

    // Broadcast an event to all NPCs who can perceive it
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
        this.updateActionButtons();
        this.updateHud();
        this.render();
    }

    updateActionButtons() {
        const hasAction = this.actionPoints > 0 && this.phase === 'player_turn';
        const adjNPCs = this.getAdjacentNPCs(this.player.col, this.player.row, true);
        const itemHere = this.getItemAt(this.player.col, this.player.row);
        const onDoor = this.grid.isDoor(this.player.col, this.player.row);

        this.ui.setActionButtons({
            attack: hasAction && adjNPCs.length > 0,
            speak: hasAction,
            item: hasAction && this.player.inventory.length > 0,
            interact: hasAction && !!(itemHere || onDoor),
        });
        this.ui.setSpeakEnabled(hasAction);
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

        this.gameLog.add('speak', 'Socrates', null, text, pos);
        this.broadcast('speak', 'Socrates', pos, `Socrates says: "${text}"`);

        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    // --- End turn ---

    endPlayerTurn() {
        if (this.phase !== 'player_turn') return;

        this.phase = 'ai';
        this.ui.disableAllActions();
        this.render();

        // Each NPC takes their turn
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            this.runNPCTurn(npc);
        }

        // Next player turn
        this.turn++;
        this.gameLog.setTurn(this.turn);
        this.movePoints = MAX_MOVE_POINTS;
        this.actionPoints = MAX_ACTION_POINTS;
        this.phase = 'player_turn';
        this.refreshTurnState();
        this.ui.updateLog(this.gameLog.getDisplayLines());
    }

    runNPCTurn(npc) {
        let movePoints = npc.maxMovePoints;
        let actionPoints = npc.maxActionPoints;

        // Ask NPC what to do (placeholder AI)
        const decision = npc.decideAction(this.getGameState());

        // Movement
        if (decision.moveTo && movePoints > 0) {
            const occupied = this.getOccupiedSet();
            occupied.delete(`${npc.col},${npc.row}`); // NPC's own tile isn't blocking itself
            occupied.add(`${this.player.col},${this.player.row}`); // player blocks
            const path = this.grid.getPath(npc.col, npc.row, decision.moveTo.col, decision.moveTo.row, occupied);
            if (path && path.length <= movePoints) {
                npc.moveTo(decision.moveTo.col, decision.moveTo.row);
                this.gameLog.add('move', npc.name, null, `${npc.name} moved.`, { col: npc.col, row: npc.row });
            }
        }

        // Action
        if (decision.action && actionPoints > 0) {
            switch (decision.action.type) {
                case 'speak': {
                    const msg = decision.action.message;
                    const pos = { col: npc.col, row: npc.row };
                    this.gameLog.add('speak', npc.name, null, msg, pos);

                    // Broadcast to other NPCs
                    this.broadcast('speak', npc.name, pos, `${npc.name} says: "${msg}"`);

                    // Player hears if in range
                    const playerDist = Math.abs(this.player.col - npc.col) + Math.abs(this.player.row - npc.row);
                    if (playerDist > HEARING_RANGE) {
                        // Player doesn't hear this — but it's still in the game log for omniscient view
                        // Could optionally hide from display log
                    }
                    actionPoints--;
                    break;
                }
                case 'attack': {
                    // NPC attacks an adjacent target
                    const targetId = decision.action.targetId;
                    if (targetId === 'player') {
                        const dist = Math.abs(this.player.col - npc.col) + Math.abs(this.player.row - npc.row);
                        if (dist === 1) {
                            const dmg = this.player.takeDamage(npc.baseDamage);
                            this.gameLog.add('attack', npc.name, 'Socrates', `${dmg} damage. Socrates HP: ${this.player.hp}/${this.player.maxHp}`, { col: npc.col, row: npc.row });
                            this.broadcast('attack', npc.name, { col: npc.col, row: npc.row }, `${npc.name} attacked Socrates for ${dmg} damage.`);
                            actionPoints--;
                        }
                    }
                    break;
                }
                case 'wait':
                default:
                    break;
            }
        }
    }

    // --- Input handling ---

    handleCanvasClick(e) {
        if (this.ui.isInventoryActive()) return;
        if (this.phase === 'ai' || this.phase === 'gameover') return;

        const rect = this.canvas.getBoundingClientRect();
        const col = Math.floor((e.clientX - rect.left) / TILE_SIZE);
        const row = Math.floor((e.clientY - rect.top) / TILE_SIZE);
        this.cursor = { col, row };

        if (this.phase === 'player_turn') {
            this.handlePlayerClick(col, row);
        } else if (this.phase === 'select_attack') {
            this.handleAttackClick(col, row);
        }

        this.render();
    }

    handlePlayerClick(col, row) {
        const key = `${col},${row}`;
        const target = this.reachableTiles.get(key);
        if (target && this.movePoints > 0) {
            const cost = target.dist;
            if (cost <= this.movePoints) {
                this.player.moveTo(col, row);
                this.movePoints -= cost;
                this.gameLog.add('move', 'Socrates', null, `Socrates moved (${cost} steps).`, { col, row });
                this.broadcast('move', 'Socrates', { col, row }, 'Socrates moved.');
                this.ui.updateLog(this.gameLog.getDisplayLines());
                this.refreshTurnState();
            }
        }
    }

    handleAction(type) {
        if (this.actionPoints <= 0 && type !== 'interact') return;

        switch (type) {
            case 'attack': {
                const targets = this.getAdjacentNPCs(this.player.col, this.player.row, true);
                if (targets.length === 1) {
                    this.doAttack(targets[0]);
                } else if (targets.length > 1) {
                    this.phase = 'select_attack';
                    this.attackTargets = targets.map(n => ({ col: n.col, row: n.row }));
                    this.render();
                }
                break;
            }
            case 'use_item': {
                this.ui.openInventory(this.player.inventory);
                break;
            }
            case 'interact': {
                this.doInteract();
                break;
            }
        }
    }

    handleAttackClick(col, row) {
        const npc = this.getEntityAt(col, row);
        if (npc && npc.alive && this.attackTargets.some(t => t.col === col && t.row === row)) {
            this.doAttack(npc);
        } else {
            this.phase = 'player_turn';
            this.attackTargets = [];
            this.refreshTurnState();
        }
    }

    // --- Actions ---

    doAttack(npc) {
        this.actionPoints--;
        this.phase = 'player_turn';
        this.attackTargets = [];

        const dmg = this.player.getDamage();
        npc.takeDamage(dmg);
        const pos = { col: this.player.col, row: this.player.row };

        this.gameLog.add('attack', 'Socrates', npc.name, `${dmg} damage. ${npc.name} HP: ${npc.hp}/${npc.maxHp}`, pos);
        this.broadcast('attack', 'Socrates', pos, `Socrates attacked ${npc.name} for ${dmg} damage.`);

        if (!npc.alive) {
            this.gameLog.add('kill', 'Socrates', npc.name, `${npc.name} has been slain.`, pos);
            this.broadcast('kill', 'Socrates', pos, `Socrates killed ${npc.name}.`);
        }

        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    doInteract() {
        const item = this.getItemAt(this.player.col, this.player.row);
        if (item) {
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
            this.gameLog.add('pickup', 'Socrates', item.name, `Socrates picked up ${item.name}.`, pos);
            this.broadcast('pickup', 'Socrates', pos, `Socrates picked up ${item.name}.`);
            this.ui.updateLog(this.gameLog.getDisplayLines());
            this.refreshTurnState();
            return;
        }

        if (this.grid.isDoor(this.player.col, this.player.row)) {
            const target = this.grid.getDoorTarget(this.player.col, this.player.row);
            if (target) {
                const targetZoneName = ZONES[target.zone].name;
                this.gameLog.add('door', 'Socrates', targetZoneName, `Socrates entered ${targetZoneName}.`);
                this.ui.updateLog(this.gameLog.getDisplayLines());
                this.loadZone(target.zone);
                this.player.moveTo(target.col, target.row);
                this.movePoints = MAX_MOVE_POINTS;
                this.actionPoints = MAX_ACTION_POINTS;
                this.refreshTurnState();
                return;
            }
        }
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
            attackTargets: this.attackTargets,
            cursor: this.cursor,
            zoneName: ZONES[this.currentZoneIndex].name,
        };
    }

    render() {
        this.renderer.render(this.getGameState());
    }
}
