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

export default class Game {
    constructor(canvas) {
        this.renderer = new Renderer(canvas, TILE_SIZE);
        this.ui = new UI();
        this.gameLog = new GameLog();
        this.canvas = canvas;

        this.turn = 1;
        this.currentZoneIndex = 0;

        // Player resources for this turn
        this.movePoints = MAX_MOVE_POINTS;
        this.actionPoints = MAX_ACTION_POINTS;

        // Phases: 'player_turn', 'select_attack', 'select_talk', 'dialogue', 'ai', 'gameover'
        this.phase = 'player_turn';

        this.cursor = null;
        this.reachableTiles = new Map(); // BFS results
        this.attackTargets = [];
        this.talkTargets = [];
        this.talkingTo = null;

        // Load first zone
        this.loadZone(0);

        // Bind UI callbacks
        this.ui.onAction = (type) => this.handleAction(type);
        this.ui.onEndTurn = () => this.endPlayerTurn();
        this.ui.onDialogueSend = (text) => this.handleDialogueSend(text);
        this.ui.onDialogueClose = () => this.handleDialogueClose();

        // Canvas click
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        this.gameLog.add('door', 'player', ZONES[0].name, `Socrates enters the ${ZONES[0].name}.`);
        this.ui.updateLog(this.gameLog.getDisplayLines());

        // Initial UI
        this.refreshTurnState();
    }

    loadZone(zoneIndex) {
        const zoneData = ZONES[zoneIndex];
        this.currentZoneIndex = zoneIndex;
        this.grid = new Grid(zoneData);
        this.renderer.resize(zoneData.cols, zoneData.rows);

        // Player
        this.player = this.player || new Player(zoneData.playerStart.col, zoneData.playerStart.row);
        this.player.moveTo(zoneData.playerStart.col, zoneData.playerStart.row);

        // NPCs
        this.npcs = [];
        for (const npcId of zoneData.npcs) {
            const data = NPC_DATA[npcId];
            if (data) {
                this.npcs.push(new NPC(npcId, data, data.col, data.row));
            }
        }

        // Items on the ground
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

    // --- Turn resource helpers ---

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

    getAdjacentNPCs(alive = true) {
        const result = [];
        const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        for (const [dc, dr] of dirs) {
            const nc = this.player.col + dc;
            const nr = this.player.row + dr;
            const npc = this.getEntityAt(nc, nr);
            if (npc && (!alive || npc.alive)) result.push(npc);
        }
        return result;
    }

    // Refresh everything: reachable tiles, action buttons, HUD, render
    refreshTurnState() {
        this.computeReachable();
        this.updateActionButtons();
        this.updateHud();
        this.render();
    }

    updateActionButtons() {
        const hasAction = this.actionPoints > 0 && this.phase === 'player_turn';
        const adjNPCs = this.getAdjacentNPCs(true);
        const itemHere = this.getItemAt(this.player.col, this.player.row);
        const onDoor = this.grid.isDoor(this.player.col, this.player.row);

        this.ui.setActionButtons({
            attack: hasAction && adjNPCs.length > 0,
            talk: hasAction && adjNPCs.length > 0,
            item: hasAction && this.player.inventory.length > 0,
            interact: hasAction && !!(itemHere || onDoor),
        });
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

    // --- End turn ---

    endPlayerTurn() {
        if (this.phase !== 'player_turn') return;

        this.phase = 'ai';
        this.ui.disableAllActions();
        this.render();

        // AI turns (placeholder: all NPCs idle)
        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            const decision = npc.decideAction(this.getGameState(), this.gameLog);
            if (decision.move) {
                npc.moveTo(decision.move.col, decision.move.row);
            }
        }

        // Next turn
        this.turn++;
        this.movePoints = MAX_MOVE_POINTS;
        this.actionPoints = MAX_ACTION_POINTS;
        this.phase = 'player_turn';
        this.refreshTurnState();

        this.ui.updateLog(this.gameLog.getDisplayLines());
    }

    // --- Input handling ---

    handleCanvasClick(e) {
        if (this.ui.isDialogueActive() || this.ui.isInventoryActive()) return;
        if (this.phase === 'ai' || this.phase === 'gameover') return;

        const rect = this.canvas.getBoundingClientRect();
        const col = Math.floor((e.clientX - rect.left) / TILE_SIZE);
        const row = Math.floor((e.clientY - rect.top) / TILE_SIZE);
        this.cursor = { col, row };

        if (this.phase === 'player_turn') {
            this.handlePlayerClick(col, row);
        } else if (this.phase === 'select_attack') {
            this.handleAttackClick(col, row);
        } else if (this.phase === 'select_talk') {
            this.handleTalkClick(col, row);
        }

        this.render();
    }

    handlePlayerClick(col, row) {
        // Try to move to clicked tile
        const key = `${col},${row}`;
        const target = this.reachableTiles.get(key);
        if (target && this.movePoints > 0) {
            const cost = target.dist;
            if (cost <= this.movePoints) {
                this.player.moveTo(col, row);
                this.movePoints -= cost;
                this.gameLog.add('move', 'player', null, `Socrates moved (${cost} steps).`);
                this.ui.updateLog(this.gameLog.getDisplayLines());
                this.refreshTurnState();
            }
        }
    }

    handleAction(type) {
        if (this.actionPoints <= 0) return;

        switch (type) {
            case 'attack': {
                const targets = this.getAdjacentNPCs(true);
                if (targets.length === 1) {
                    this.doAttack(targets[0]);
                } else if (targets.length > 1) {
                    this.phase = 'select_attack';
                    this.attackTargets = targets.map(n => ({ col: n.col, row: n.row }));
                    this.render();
                }
                break;
            }
            case 'talk': {
                const targets = this.getAdjacentNPCs(true);
                if (targets.length === 1) {
                    this.doTalk(targets[0]);
                } else if (targets.length > 1) {
                    this.phase = 'select_talk';
                    this.talkTargets = targets.map(n => ({ col: n.col, row: n.row }));
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
            // Cancel selection
            this.phase = 'player_turn';
            this.attackTargets = [];
            this.refreshTurnState();
        }
    }

    handleTalkClick(col, row) {
        const npc = this.getEntityAt(col, row);
        if (npc && npc.alive && this.talkTargets.some(t => t.col === col && t.row === row)) {
            this.doTalk(npc);
        } else {
            this.phase = 'player_turn';
            this.talkTargets = [];
            this.refreshTurnState();
        }
    }

    // --- Actions (each costs 1 action point) ---

    doAttack(npc) {
        this.actionPoints--;
        this.phase = 'player_turn';
        this.attackTargets = [];

        const dmg = this.player.getDamage();
        npc.takeDamage(dmg);

        this.gameLog.add('attack', 'player', npc.name, `${dmg} damage. ${npc.name} HP: ${npc.hp}/${npc.maxHp}`);
        if (!npc.alive) {
            this.gameLog.add('kill', 'player', npc.name, `${npc.name} has been slain.`);
        }

        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    doTalk(npc) {
        this.actionPoints--;
        this.phase = 'dialogue';
        this.talkingTo = npc;
        this.talkTargets = [];

        this.gameLog.add('talk', 'player', npc.name, `Socrates speaks with ${npc.name}.`);
        this.ui.updateLog(this.gameLog.getDisplayLines());

        const opening = npc.getOpeningLine();
        this.ui.openDialogue(npc.name, opening);
        this.updateHud();
        this.render();
    }

    doInteract() {
        // Pick up item
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

            this.gameLog.add('pickup', 'player', item.name, `Socrates picked up ${item.name}.`);
            this.ui.updateLog(this.gameLog.getDisplayLines());
            this.refreshTurnState();
            return;
        }

        // Use door (free action — doesn't cost action point, transitions zone)
        if (this.grid.isDoor(this.player.col, this.player.row)) {
            const target = this.grid.getDoorTarget(this.player.col, this.player.row);
            if (target) {
                const targetZoneName = ZONES[target.zone].name;
                this.gameLog.add('door', 'player', targetZoneName, `Socrates entered ${targetZoneName}.`);
                this.ui.updateLog(this.gameLog.getDisplayLines());
                this.loadZone(target.zone);
                this.player.moveTo(target.col, target.row);
                // Reset resources for new zone
                this.movePoints = MAX_MOVE_POINTS;
                this.actionPoints = MAX_ACTION_POINTS;
                this.refreshTurnState();
                return;
            }
        }
    }

    handleDialogueSend(text) {
        if (!this.talkingTo) return;

        this.ui.addChatMessage('Socrates', text);

        // Get NPC response (placeholder — cycles static lines)
        const response = this.talkingTo.getResponse(text, this.gameLog);
        setTimeout(() => {
            if (this.talkingTo) {
                this.ui.addChatMessage(this.talkingTo.name, response);
            }
        }, 300);
    }

    handleDialogueClose() {
        this.talkingTo = null;
        this.phase = 'player_turn';
        this.refreshTurnState();
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
            talkTargets: this.talkTargets,
            cursor: this.cursor,
            zoneName: ZONES[this.currentZoneIndex].name,
        };
    }

    render() {
        this.renderer.render(this.getGameState());
    }
}
