import Grid from './Grid.js';
import Player from './Player.js';
import NPC from './NPC.js';
import GameLog from './GameLog.js';
import Renderer from './Renderer.js';
import UI from './ui.js';
import DebugLog from './DebugLog.js';
import LLMClient from './LLMClient.js';
import { ZONES, NPC_DATA, ITEM_DATA } from './data.js';

const TILE_SIZE = 56;
const MAX_MOVE_POINTS = 4;
const MAX_ACTION_POINTS = 1;
const MELEE_RANGE = 2;

export default class Game {
    constructor(canvas) {
        this.renderer = new Renderer(canvas, TILE_SIZE);
        this.ui = new UI();
        this.gameLog = new GameLog();
        this.debugLog = new DebugLog();
        this.canvas = canvas;

        this.turn = 1;
        this.currentZoneIndex = 0;

        this.movePoints = MAX_MOVE_POINTS;
        this.actionPoints = MAX_ACTION_POINTS;

        // Phases: 'player_turn', 'ai', 'gameover'
        this.phase = 'player_turn';

        // Thinking animation state (set while waiting for LLM response)
        this.thinkingNpc = null;   // { col, row, color }
        this._thinkingDots = 0;
        this._thinkingInterval = null;

        this.cursor = null;
        this.reachableTiles = new Map();

        // Visual overlays — cleared at the start of each End Turn, so player sees
        // their own movement and then NPC movements throughout their next turn.
        this.speechBubbles   = [];  // { col, row, text, color, entityId }
        this.movementTrails  = [];  // { fromCol, fromRow, toCol, toRow, color }

        this.loadZone(0);

        // Bind UI callbacks
        this.ui.onEndTurn = () => this.endPlayerTurn();
        this.ui.onSpeak = (text) => this.handleSpeak(text);
        this.ui.onToggleDebug = () => {
            const enabled = this.debugLog.toggle();
            if (enabled) {
                this.ui.showDebugPanel(this.debugLog.getAll());
            } else {
                this.ui.hideDebugPanel();
            }
        };

        // Left click: move
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Right click: context menu
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleCanvasRightClick(e);
        });

        // Hover: update info pane
        this._hoverKey = null;
        canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
        canvas.addEventListener('mouseleave', () => {
            this._hoverKey = null;
            this.ui.clearInfoPane();
        });

        // Tab: end turn (skip when any input or button is focused)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const tag = document.activeElement?.tagName;
                if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA') return;
                e.preventDefault();
                if (this.phase === 'player_turn') this.endPlayerTurn();
            }
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
                const npc = new NPC(npcId, data, data.col, data.row);
                npc.initConversation(zoneData.name);
                this.debugLog.recordSystemPrompt(npcId, data.name, npc.systemPrompt);
                this.npcs.push(npc);
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
                    visibleName: data.visibleName || data.name,
                    description: data.description,
                    visibleDescription: data.visibleDescription || data.description,
                    equipSlot: data.equipSlot || null,
                    actionEffect: data.actionEffect,
                    dialogueEffect: data.dialogueEffect,
                    unlocks: data.unlocks || null,
                    collected: false,
                });
            }
        }

        this.doors = [];
        for (const doorData of (zoneData.doors || [])) {
            this.doors.push({ ...doorData });
        }

        this.phase = 'player_turn';
    }

    // --- Helpers ---

    getOccupiedSet() {
        const set = new Set();
        for (const npc of this.npcs) {
            if (npc.alive) set.add(`${npc.col},${npc.row}`);
        }
        for (const item of this.items) {
            if (!item.collected) set.add(`${item.col},${item.row}`);
        }
        for (const door of this.doors) {
            set.add(`${door.col},${door.row}`);
        }
        return set;
    }

    getDoorAt(col, row) {
        return this.doors.find(d => d.col === col && d.row === row) || null;
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
            if (npc.col === col && npc.row === row) return npc;
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
                npc.addMemory({ turn: this.turn, type, actor: actorName, details });
            }
        }
    }

    refreshTurnState() {
        this.computeReachable();
        this.updateControls();
        this.updateHud();
        this.ui.updateInventory(
            this.player.inventory,
            (index) => this.handleUseItem(index),
            (index) => this.handleDropItem(index),
            (index) => this.handleEquipItem(index),
        );
        this.ui.updateEquipment(
            this.player.equipment,
            (slot) => this.handleUnequipItem(slot),
        );
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

        // Show speech bubble above player
        this._setSpeechBubble('player', this.player.col, this.player.row, text, this.player.color);

        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    // --- End turn ---

    async endPlayerTurn() {
        if (this.phase !== 'player_turn') return;

        // Clear player's trails/bubbles from their turn; NPCs will add fresh ones below
        this.speechBubbles  = [];
        this.movementTrails = [];

        this.phase = 'ai';
        this.ui.disableAllActions();
        this.render();

        for (const npc of this.npcs) {
            if (!npc.alive) continue;
            await this.runNPCTurn(npc);
            this.render();
        }

        this.turn++;
        this.gameLog.setTurn(this.turn);
        this.movePoints = MAX_MOVE_POINTS;
        this.actionPoints = MAX_ACTION_POINTS;
        this.phase = 'player_turn';
        this.refreshTurnState();
        this.ui.updateLog(this.gameLog.getDisplayLines());

        if (this.debugLog.enabled) {
            this.ui.showDebugPanel(this.debugLog.getAll());
        }
    }

    async runNPCTurn(npc) {
        // Set up turn: compute reachable tiles and available actions
        const occupied = this.getOccupiedSet();
        occupied.delete(`${npc.col},${npc.row}`);
        occupied.add(`${this.player.col},${this.player.row}`);
        npc.beginTurn(this.grid, occupied);
        npc.computeAvailableActions(this.getGameState());
        npc.computeSurroundings(this.getGameState());

        const turnContext = this.getGameState();
        const { systemPrompt, messages } = npc.buildLLMMessages(turnContext);
        const turnPrompt = messages[messages.length - 1].content;

        let decision = null;
        let rawResponse = null;
        let errorMsg = null;

        // Show thinking animation while waiting for LLM
        this.thinkingNpc = { col: npc.col, row: npc.row, color: npc.color };
        this._thinkingDots = 0;
        this._thinkingInterval = setInterval(() => {
            this._thinkingDots = (this._thinkingDots + 1) % 3;
            this.render();
        }, 400);

        try {
            rawResponse = await LLMClient.chat({ systemPrompt, messages });
            decision = NPC.parseLLMResponse(rawResponse);
            if (!decision) errorMsg = 'Response was not valid JSON.';
        } catch (err) {
            errorMsg = err.message;
            // Fall back to placeholder AI so the turn isn't just skipped
            decision = npc.decideAction(turnContext);
            rawResponse = JSON.stringify(decision, null, 2);
        } finally {
            clearInterval(this._thinkingInterval);
            this._thinkingInterval = null;
            this.thinkingNpc = null;
        }

        npc.recordTurn(turnPrompt, rawResponse ?? '');
        this.debugLog.recordTurn(npc.id, this.turn, {
            turnPrompt,
            rawResponse,
            parsedDecision: decision,
            error: errorMsg,
        });

        // Null decision means invalid JSON — skip this NPC's turn
        if (!decision) {
            this.gameLog.add('wait', npc.name, null, `${npc.name}'s turn was skipped (invalid response).`, { col: npc.col, row: npc.row });
            return;
        }

        // Store scheme in NPC's private memory (only they can see it)
        if (decision.scheme) {
            npc.addMemory({ turn: this.turn, type: 'scheme', actor: npc.name, details: `[Private thought] ${decision.scheme}` });
        }

        // Execute movement
        if (decision.moveTo) {
            const targetCol = Number(decision.moveTo.col);
            const targetRow = Number(decision.moveTo.row);
            const valid = Number.isFinite(targetCol) && Number.isFinite(targetRow)
                && npc.availableCoordinates.some(c => c.col === targetCol && c.row === targetRow);
            if (valid) {
                const fromCol = npc.col, fromRow = npc.row;
                npc.moveTo(targetCol, targetRow);
                this.movementTrails.push({ fromCol, fromRow, toCol: npc.col, toRow: npc.row, color: npc.color });
                this.gameLog.add('move', npc.name, null, `${npc.name} moved.`, { col: npc.col, row: npc.row });
            }
        }

        // Re-compute available actions after movement (adjacency may have changed)
        npc.computeAvailableActions(this.getGameState());

        // Execute action
        if (decision.action) {
            const act = decision.action;
            // Validate that this specific action (type + target/item) was offered
            const actionAllowed = npc.availableActions.some(a => {
                if (a.type !== act.type) return false;
                if (a.type === 'attack') return a.targetId === act.targetId;
                if (a.type === 'use_item' || a.type === 'drop') return a.itemIndex === Number(act.itemIndex);
                if (a.type === 'special_action') return a.name === act.name;
                return true;
            });
            if (!actionAllowed) return;

            switch (act.type) {
                case 'speak': {
                    const msg = act.message;
                    const pos = { col: npc.col, row: npc.row };
                    this.gameLog.add('speak', npc.name, null, msg, pos);
                    this.broadcast('speak', npc.name, pos, `${npc.name} says: "${msg}"`);
                    this._setSpeechBubble(npc.id, npc.col, npc.row, msg, npc.color);
                    break;
                }
                case 'attack': {
                    const targetId = act.targetId;
                    if (targetId === 'player') {
                        const dist = Math.abs(this.player.col - npc.col) + Math.abs(this.player.row - npc.row);
                        if (dist <= MELEE_RANGE) {
                            const dmg = this.player.takeDamage(npc.getDamage());
                            this.gameLog.add('attack', npc.name, this.player.name, `${dmg} damage. ${this.player.name} HP: ${this.player.hp}/${this.player.maxHp}`, { col: npc.col, row: npc.row });
                            this.broadcast('attack', npc.name, { col: npc.col, row: npc.row }, `${npc.name} attacked ${this.player.name} for ${dmg} damage.`);
                        }
                    } else {
                        const targetNpc = this.npcs.find(n => n.id === targetId);
                        if (targetNpc && targetNpc.alive) {
                            const dist = Math.abs(targetNpc.col - npc.col) + Math.abs(targetNpc.row - npc.row);
                            if (dist <= MELEE_RANGE) {
                                const dmg = targetNpc.takeDamage(npc.getDamage());
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
                    const idx = Number(act.itemIndex);
                    if (idx >= 0 && idx < npc.inventory.length) {
                        const item = npc.inventory[idx];
                        this.gameLog.add('use_item', npc.name, item.name, `${npc.name} used ${item.name}.`, { col: npc.col, row: npc.row });
                        this.broadcast('use_item', npc.name, { col: npc.col, row: npc.row }, `${npc.name} used ${item.name}.`);
                    }
                    break;
                }
                case 'drop': {
                    const idx = Number(act.itemIndex);
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
                                equipSlot: item.equipSlot || null,
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
                case 'special_action': {
                    const spec = npc.bio.specialActions.find(s => s.name === act.name);
                    if (spec) {
                        this.gameLog.add('special_action', npc.name, null, `${npc.name} used ${spec.name}.`, { col: npc.col, row: npc.row });
                        this.broadcast('special_action', npc.name, { col: npc.col, row: npc.row }, `${npc.name} used ${spec.name}.`);
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
            const fromCol = this.player.col, fromRow = this.player.row;
            this.player.moveTo(col, row);
            this.movementTrails.push({ fromCol, fromRow, toCol: col, toRow: row, color: this.player.color });
            this.movePoints -= target.dist;
            this.gameLog.add('move', this.player.name, null, `${this.player.name} moved (${target.dist} steps).`, { col, row });
            this.broadcast('move', this.player.name, { col, row }, `${this.player.name} moved.`);
            this.ui.updateLog(this.gameLog.getDisplayLines());
            this.refreshTurnState();
        }

        this.render();
    }

    // --- Input: hover = info pane ---

    handleCanvasHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        const col = Math.floor((e.clientX - rect.left) / TILE_SIZE);
        const row = Math.floor((e.clientY - rect.top) / TILE_SIZE);
        const key = `${col},${row}`;
        if (key === this._hoverKey) return;
        this._hoverKey = key;

        // Player tile
        if (col === this.player.col && row === this.player.row) {
            this.ui.updateInfoPane({
                ...this.player.getPublicInfo(),
                damage: this.player.getDamage(),
                armor: this.player.getArmor(),
                equipment: this.player.equipment,
            });
            return;
        }

        // NPC (alive or dead)
        const npc = this.getEntityAt(col, row);
        if (npc) {
            if (npc.alive) {
                this.ui.updateInfoPane(npc.getPublicInfo());
            } else {
                const lootable = [...npc.inventory, ...Object.values(npc.equipment).filter(Boolean)];
                this.ui.updateInfoPane({
                    name: `Corpse of ${npc.name}`,
                    description: lootable.length > 0
                        ? `Carrying: ${lootable.map(i => i.name).join(', ')}.`
                        : 'Nothing to take.',
                    alive: false,
                    worldItem: true,
                });
            }
            return;
        }

        // Item on ground — show world-visible info only
        const item = this.getItemAt(col, row);
        if (item) {
            this.ui.updateInfoPane({
                name: item.visibleName || item.name,
                description: item.visibleDescription || item.description,
                equipSlot: item.equipSlot || null,
                worldItem: true,
            });
            return;
        }

        // Door entity
        const door = this.getDoorAt(col, row);
        if (door) {
            this.ui.updateInfoPane({
                name: 'Door',
                description: door.description || null,
                worldItem: true,
            });
            return;
        }

        this.ui.clearInfoPane();
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
        const dist = Math.abs(this.player.col - col) + Math.abs(this.player.row - row);
        const inMelee = dist <= MELEE_RANGE;

        // --- NPC on this tile ---
        const npc = this.getEntityAt(col, row);
        if (npc) {
            if (npc.alive) {
                // Attack — always first, greyed if out of range or no action
                const canAttack = inMelee && hasAction;
                options.push({
                    label: !inMelee ? `Attack ${npc.name}  (too far)` : `Attack ${npc.name}`,
                    disabled: !canAttack,
                    action: () => this.doAttack(npc),
                });

                // Inventory items that can be used on an entity
                for (let i = 0; i < this.player.inventory.length; i++) {
                    const invItem = this.player.inventory[i];
                    if (!invItem.onEntityUse) continue;
                    const label = invItem.onEntityUse.label
                        ? `${invItem.onEntityUse.label} ${npc.name}`
                        : `Use ${invItem.name} on ${npc.name}`;
                    const canUse = inMelee && hasAction;
                    options.push({
                        label: !inMelee ? `${label}  (too far)` : label,
                        disabled: !canUse,
                        action: () => this.handleItemOnEntity(i, npc),
                    });
                }
            } else {
                // Loot dead body
                const lootable = [...npc.inventory];
                for (const [slot, item] of Object.entries(npc.equipment)) {
                    if (item) lootable.push({ ...item, _fromSlot: slot });
                }
                if (lootable.length === 0) {
                    options.push({ label: `${npc.name}'s body (nothing to take)`, disabled: true, action: () => {} });
                } else {
                    for (const lootItem of lootable) {
                        const canLoot = inMelee && hasAction;
                        options.push({
                            label: !inMelee ? `Take ${lootItem.name}  (too far)` : `Take ${lootItem.name}`,
                            disabled: !canLoot,
                            action: () => this.doLootNpc(npc, lootItem),
                        });
                    }
                }
            }
        }

        // --- Item on this tile ---
        const item = this.getItemAt(col, row);
        if (item) {
            const displayName = item.visibleName || item.name;
            const canPickup = inMelee && hasAction;
            options.push({
                label: !inMelee ? `Pick up ${displayName}  (too far)` : `Pick up ${displayName}`,
                disabled: !canPickup,
                action: () => this.doPickup(item),
            });
        }

        // --- Door entity on this tile ---
        const door = this.getDoorAt(col, row);
        if (door) {
            options.push({
                label: !inMelee ? 'Traverse  (too far)' : 'Traverse',
                disabled: !inMelee,
                action: () => this.doTraverse(door),
            });
        }

        if (options.length > 0) {
            options.push({ label: 'Cancel', action: () => {} });
        }

        return options;
    }

    // Placeholder for inventory-item-on-entity actions (e.g. mind reader, poison dart)
    handleItemOnEntity(itemIndex, targetNpc) {
        const item = this.player.inventory[itemIndex];
        if (!item?.onEntityUse || this.actionPoints <= 0) return;
        this.actionPoints--;
        const pos = { col: this.player.col, row: this.player.row };
        this.gameLog.add('use_item', this.player.name, item.name, `${this.player.name} used ${item.name} on ${targetNpc.name}.`, pos);
        this.broadcast('use_item', this.player.name, pos, `${this.player.name} used ${item.name} on ${targetNpc.name}.`);
        // item.onEntityUse.apply(targetNpc) — to be implemented per item
        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    // --- Actions ---

    doAttack(npc) {
        if (this.actionPoints <= 0) return;
        this.actionPoints--;

        const dmg = npc.takeDamage(this.player.getDamage());
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

    doLootNpc(npc, lootItem) {
        if (this.actionPoints <= 0) return;
        this.actionPoints--;

        // Remove from equipment slot or inventory
        if (lootItem._fromSlot) {
            npc.equipment[lootItem._fromSlot] = null;
        } else {
            const idx = npc.inventory.indexOf(lootItem);
            if (idx >= 0) npc.inventory.splice(idx, 1);
        }

        const { _fromSlot, ...item } = lootItem;
        this.player.addItem(item);

        const pos = { col: this.player.col, row: this.player.row };
        this.gameLog.add('pickup', this.player.name, item.name, `${this.player.name} took ${item.name} from ${npc.name}'s body.`, pos);
        this.broadcast('pickup', this.player.name, pos, `${this.player.name} looted ${item.name} from ${npc.name}.`);
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
            equipSlot: item.equipSlot || null,
            actionEffect: item.actionEffect,
            dialogueEffect: item.dialogueEffect,
            unlocks: item.unlocks || null,
        });

        const pos = { col: this.player.col, row: this.player.row };
        this.gameLog.add('pickup', this.player.name, item.name, `${this.player.name} picked up ${item.name}.`, pos);
        this.broadcast('pickup', this.player.name, pos, `${this.player.name} picked up ${item.name}.`);
        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    doTraverse(door) {
        if (door.locked) {
            // Try to auto-use a matching key from inventory
            const keyIndex = this.player.inventory.findIndex(i => i.unlocks === door.id);
            if (keyIndex < 0) {
                const msg = `${this.player.name} tries to open the door, but it won't budge.`;
                this.gameLog.add('event', this.player.name, null, msg, { col: this.player.col, row: this.player.row });
                this.broadcast('event', this.player.name, { col: this.player.col, row: this.player.row }, msg);
                this.ui.updateLog(this.gameLog.getDisplayLines());
                return;
            }
            const key = this.player.inventory.splice(keyIndex, 1)[0];
            door.locked = false;
            const pos = { col: this.player.col, row: this.player.row };
            this.gameLog.add('use_item', this.player.name, key.name, `${this.player.name} used ${key.name}. The door swings open.`, pos);
            this.broadcast('use_item', this.player.name, pos, `${this.player.name} unlocked a door.`);
        }
        const targetZoneName = ZONES[door.target.zone].name;
        this.gameLog.add('door', this.player.name, targetZoneName, `${this.player.name} entered ${targetZoneName}.`);
        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.loadZone(door.target.zone);
        this.player.moveTo(door.target.col, door.target.row);
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

    handleEquipItem(index) {
        if (this.phase !== 'player_turn') return;
        const item = this.player.inventory[index];
        if (!item || !item.equipSlot) return;

        const swapped = this.player.equipItem(item, index);
        if (swapped) {
            this.player.addItem(swapped);
            this.gameLog.add('equip', this.player.name, item.name, `${this.player.name} equipped ${item.name}, unequipping ${swapped.name}.`);
        } else {
            this.gameLog.add('equip', this.player.name, item.name, `${this.player.name} equipped ${item.name}.`);
        }
        this.ui.updateLog(this.gameLog.getDisplayLines());
        this.refreshTurnState();
    }

    handleUnequipItem(slot) {
        if (this.phase !== 'player_turn') return;
        const item = this.player.unequipItem(slot);
        if (item) {
            this.gameLog.add('unequip', this.player.name, item.name, `${this.player.name} unequipped ${item.name}.`);
            this.ui.updateLog(this.gameLog.getDisplayLines());
            this.refreshTurnState();
        }
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
            equipSlot: item.equipSlot || null,
            actionEffect: item.actionEffect,
            dialogueEffect: item.dialogueEffect,
            unlocks: item.unlocks || null,
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
            const entityThere = this.getEntityAt(nc, nr);
            if (entityThere?.alive) continue;
            if (nc === this.player.col && nr === this.player.row && dc !== 0 && dr !== 0) continue;
            // Check no item already there
            if (this.getItemAt(nc, nr)) continue;
            return { col: nc, row: nr };
        }
        return null;
    }

    // --- Visual overlays ---

    // One bubble per entity; if the entity speaks again this turn the bubble is replaced.
    _setSpeechBubble(entityId, col, row, text, color) {
        const idx = this.speechBubbles.findIndex(b => b.entityId === entityId);
        const bubble = { entityId, col, row, text, color };
        if (idx >= 0) {
            this.speechBubbles[idx] = bubble;
        } else {
            this.speechBubbles.push(bubble);
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
            attackTargets: [],
            cursor: this.cursor,
            zoneName: ZONES[this.currentZoneIndex].name,
            speechBubbles: this.speechBubbles,
            movementTrails: this.movementTrails,
            doors: this.doors,
            thinkingNpc: this.thinkingNpc
                ? { ...this.thinkingNpc, dots: this._thinkingDots }
                : null,
        };
    }

    render() {
        this.renderer.render(this.getGameState());
    }
}
