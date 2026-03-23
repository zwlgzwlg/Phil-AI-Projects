import PromptBuilder from './PromptBuilder.js';

const NPC_MOVE_POINTS = 3;
const NPC_ACTION_POINTS = 1;
const HEARING_RANGE = 99;
const MELEE_RANGE = 2;

export default class NPC {
    constructor(id, data, col, row) {
        this.id = id;
        this.col = col;
        this.row = row;
        this.alive = true;

        // --- Display ---
        this.name = data.name;
        this.symbol = data.symbol;
        this.color = data.color;

        // --- Bio (permanent traits) ---
        this.bio = {
            name: data.name,
            // appearance: brief visual description seen at a glance (used in hover pane + LLM surroundings)
            appearance: data.appearance || data.name,
            // description: full private bio for the LLM system prompt
            description: data.bio,
            baseDamage: data.baseDamage ?? 8,
            maxHp: data.hp,
            maxMovePoints: data.movePoints ?? NPC_MOVE_POINTS,
            maxActionPoints: data.actionPoints ?? NPC_ACTION_POINTS,
            hearingRange: data.hearingRange ?? HEARING_RANGE,
            dialogue: [...data.dialogue],  // fallback lines for placeholder AI
            // Special abilities unique to this NPC (e.g. summon beast, command beast)
            specialActions: [...(data.specialActions || [])],
        };

        // --- Conditions (temporary/novel traits) ---
        this.conditions = {
            hp: data.hp,
            // Arbitrary condition flags that can be added/removed at runtime
            // e.g. { poisoned: true, convinced: false, suspicious: true }
            flags: { ...(data.initialFlags || {}) },
        };

        // --- Equipment ---
        this.equipment = { head: null, body: null, feet: null, hands: null };
        if (data.initialEquipment) {
            for (const [slot, item] of Object.entries(data.initialEquipment)) {
                if (slot in this.equipment) this.equipment[slot] = item;
            }
        }

        // --- Inventory ---
        this.inventory = [...(data.items || [])];

        // --- Memory log (everything this NPC has perceived) ---
        this.memory = [];

        // --- Turn resources (set at start of each turn) ---
        this.movePoints = 0;
        this.actionPoints = 0;

        // --- Computed per turn (set by Game before decideAction) ---
        this.availableCoordinates = [];  // [{col, row, dist}] tiles reachable this turn
        this.availableActions = [];      // [{type, ...params}] actions available right now

        // Placeholder dialogue index (used when no LLM is connected)
        this._dialogueIndex = 0;

        // LLM conversation state (set when entering a zone)
        this.systemPrompt = null;
        this.conversationHistory = [];  // [{role: 'user'|'assistant', content: string}]
        this._lastSentMemoryIndex = 0;  // memory entries before this index have already been sent
    }

    // --- Turn setup (called by Game at start of NPC's turn) ---

    beginTurn(grid, occupiedSet) {
        this.movePoints = this.bio.maxMovePoints;
        this.actionPoints = this.bio.maxActionPoints;
        this._computeAvailableCoordinates(grid, occupiedSet);
    }

    _computeAvailableCoordinates(grid, occupiedSet) {
        const reachable = grid.getReachable(this.col, this.row, this.movePoints, occupiedSet);
        this.availableCoordinates = [];
        for (const [, tile] of reachable) {
            this.availableCoordinates.push({ col: tile.col, row: tile.row, dist: tile.dist });
        }
    }

    computeAvailableActions(gameState) {
        this.availableActions = [];
        if (this.actionPoints <= 0) return;

        // Speak (always available if has action point)
        this.availableActions.push({ type: 'speak' });

        // Attack entities within melee range, or flag move_and_attack if reachable
        const pDist = Math.abs(this.col - gameState.player.col) + Math.abs(this.row - gameState.player.row);
        const playerId = gameState.player.name.toLowerCase().replace(/\s+/g, '_');
        if (pDist <= MELEE_RANGE) {
            this.availableActions.push({ type: 'attack', targetId: playerId, targetName: gameState.player.name });
        } else if (this.movePoints > 0 && this._canReachMelee(gameState.player.col, gameState.player.row)) {
            this.availableActions.push({ type: 'move_and_attack', targetId: playerId, targetName: gameState.player.name });
        }
        for (const other of gameState.npcs) {
            if (other.id !== this.id && other.alive) {
                const dist = Math.abs(this.col - other.col) + Math.abs(this.row - other.row);
                if (dist <= MELEE_RANGE) {
                    this.availableActions.push({ type: 'attack', targetId: other.id, targetName: other.name });
                } else if (this.movePoints > 0 && this._canReachMelee(other.col, other.row)) {
                    this.availableActions.push({ type: 'move_and_attack', targetId: other.id, targetName: other.name });
                }
            }
        }

        // Pick up items within melee range, or move_and_pickup if reachable
        for (const item of gameState.items) {
            if (item.collected) continue;
            const dist = Math.abs(this.col - item.col) + Math.abs(this.row - item.row);
            if (dist <= MELEE_RANGE) {
                this.availableActions.push({ type: 'pickup', itemId: item.id, itemName: item.visibleName || item.name });
            } else if (this.movePoints > 0 && this._canReachMelee(item.col, item.row)) {
                this.availableActions.push({ type: 'move_and_pickup', itemId: item.id, itemName: item.visibleName || item.name });
            }
        }

        // Use item (if has any)
        for (let i = 0; i < this.inventory.length; i++) {
            this.availableActions.push({ type: 'use_item', itemIndex: i, itemName: this.inventory[i].name });
        }

        // Special actions unique to this NPC
        for (const sa of this.bio.specialActions) {
            this.availableActions.push({ type: 'special_action', name: sa.name, description: sa.description });
        }

        // Wait (always)
        this.availableActions.push({ type: 'wait' });
    }

    // Compute bonus actions (free actions that don't cost an action point)
    computeBonusActions() {
        this.bonusActions = [];

        // Drop inventory items
        for (let i = 0; i < this.inventory.length; i++) {
            this.bonusActions.push({ type: 'drop', itemIndex: i, itemName: this.inventory[i].name });
            // Equip if item has an equip slot
            if (this.inventory[i].equipSlot) {
                this.bonusActions.push({ type: 'equip', itemIndex: i, itemName: this.inventory[i].name, slot: this.inventory[i].equipSlot });
            }
        }

        // Unequip equipped items
        for (const [slot, item] of Object.entries(this.equipment)) {
            if (item) {
                this.bonusActions.push({ type: 'unequip', slot, itemName: item.name });
            }
        }
    }

    // Check if any of the NPC's reachable tiles are within melee range of (targetCol, targetRow)
    _canReachMelee(targetCol, targetRow) {
        for (const coord of this.availableCoordinates) {
            const dist = Math.abs(coord.col - targetCol) + Math.abs(coord.row - targetRow);
            if (dist <= MELEE_RANGE) return true;
        }
        return false;
    }

    // Find the closest reachable tile within melee range of (targetCol, targetRow)
    _findClosestMeleePosition(targetCol, targetRow) {
        let best = null;
        for (const coord of this.availableCoordinates) {
            const dist = Math.abs(coord.col - targetCol) + Math.abs(coord.row - targetRow);
            if (dist > MELEE_RANGE) continue;
            if (!best || coord.dist < best.dist) {
                best = { col: coord.col, row: coord.row, dist: coord.dist };
            }
        }
        return best;
    }

    // --- Perception ---

    canHear(col, row) {
        return (Math.abs(this.col - col) + Math.abs(this.row - row)) <= this.bio.hearingRange;
    }

    canSee(col, row) {
        return (Math.abs(this.col - col) + Math.abs(this.row - row)) <= this.bio.hearingRange;
    }

    addMemory(entry) {
        this.memory.push({ ...entry, timestamp: Date.now() });
    }

    // --- State changes ---

    moveTo(col, row) {
        this.col = col;
        this.row = row;
    }

    getDamage() {
        let dmg = this.bio.baseDamage;
        for (const item of Object.values(this.equipment)) {
            if (item?.actionEffect?.damage) dmg += item.actionEffect.damage;
        }
        return dmg;
    }

    getArmor() {
        let armor = 0;
        for (const item of Object.values(this.equipment)) {
            if (item?.actionEffect?.armor) armor += item.actionEffect.armor;
        }
        return armor;
    }

    takeDamage(amount) {
        const reduced = Math.max(1, amount - this.getArmor());
        this.conditions.hp = Math.max(0, this.conditions.hp - reduced);
        if (this.conditions.hp <= 0) {
            this.alive = false;
        }
        return reduced;
    }

    setCondition(key, value) {
        this.conditions.flags[key] = value;
    }

    removeCondition(key) {
        delete this.conditions.flags[key];
    }

    addItem(item) {
        this.inventory.push(item);
    }

    removeItem(index) {
        return this.inventory.splice(index, 1)[0];
    }

    equipItem(item, inventoryIndex) {
        const slot = item.equipSlot;
        if (!slot || !(slot in this.equipment)) return null;
        const swapped = this.equipment[slot];
        this.equipment[slot] = item;
        this.inventory.splice(inventoryIndex, 1);
        return swapped;
    }

    unequipItem(slot) {
        const item = this.equipment[slot];
        if (!item) return null;
        this.equipment[slot] = null;
        this.inventory.push(item);
        return item;
    }

    // --- LLM conversation management ---

    // Called when entering a zone — sets up the system prompt for this NPC's LLM instance
    initConversation() {
        this.systemPrompt = PromptBuilder.buildSystemPrompt(this);
        this.conversationHistory = [];
        this._lastSentMemoryIndex = 0;
    }

    // Build the messages array to send to the LLM for this turn
    buildLLMMessages(gameState) {
        const { full, compact } = PromptBuilder.buildTurnPrompt(this, gameState);
        this._lastCompactPrompt = compact;
        return {
            systemPrompt: this.systemPrompt,
            messages: [
                ...this.conversationHistory,
                { role: 'user', content: full },
            ],
        };
    }

    // Record the LLM's response in conversation history so it has context for next turn.
    // Stores the compact prompt (without ephemeral actions/movement/format) to save tokens.
    recordTurn(turnPrompt, response) {
        this.conversationHistory.push({ role: 'user', content: this._lastCompactPrompt || turnPrompt });
        this.conversationHistory.push({ role: 'assistant', content: response });

        // Mark all current memory as sent — next turn prompt will only show new events
        this._lastSentMemoryIndex = this.memory.length;

        // Trim old turns to keep context manageable (keep last 20 exchanges)
        const maxMessages = 40; // 20 turns * 2 messages each
        if (this.conversationHistory.length > maxMessages) {
            this.conversationHistory = this.conversationHistory.slice(-maxMessages);
        }
    }

    // Parse the LLM's JSON response into a decision.
    // Returns { moveTo, action, scheme } on success, or null on invalid JSON (turn skipped).
    static parseLLMResponse(responseText) {
        try {
            // Strip markdown code fences if present
            let cleaned = responseText.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            const parsed = JSON.parse(cleaned);
            return {
                moveTo: parsed.moveTo || null,
                action: parsed.action || null,
                bonusAction: parsed.bonusAction || null,
                scheme: parsed.scheme || null,
            };
        } catch (e) {
            // Invalid JSON — turn is skipped
            return null;
        }
    }

    // --- AI decision ---
    // Called by Game. If no LLM is connected, falls back to placeholder.
    // When LLM is connected, Game will call buildLLMMessages() instead and
    // pass the parsed result to executeLLMDecision().

    decideAction(turnContext) {
        // Placeholder: if player is within hearing range, speak next line
        const playerDist = Math.abs(this.col - turnContext.player.col) + Math.abs(this.row - turnContext.player.row);

        if (playerDist <= this.bio.hearingRange && this.bio.dialogue.length > 0) {
            if (this._dialogueIndex >= this.bio.dialogue.length) {
                this._dialogueIndex = 0;
            }
            const message = this.bio.dialogue[this._dialogueIndex++];
            return {
                moveTo: null,
                action: { type: 'speak', message },
                scheme: null,
            };
        }

        return { moveTo: null, action: null, scheme: null };
    }

    // --- Surroundings (computed by Game before decideAction) ---

    // gameState: { player, npcs, items }
    computeSurroundings(gameState) {
        this.nearbyEntities = [];

        // Player
        const pDist = Math.abs(this.col - gameState.player.col) + Math.abs(this.row - gameState.player.row);
        if (pDist <= this.bio.hearingRange) {
            const playerInfo = gameState.player.getPublicInfo?.() ?? {};
            this.nearbyEntities.push({
                type: 'npc',
                name: gameState.player.name,
                col: gameState.player.col,
                row: gameState.player.row,
                distance: pDist,
                hp: gameState.player.hp,
                maxHp: gameState.player.maxHp,
                appearance: playerInfo.description || gameState.player.description,
                visibleEquipment: playerInfo.visibleEquipment,
                interaction: this._describeInteraction(gameState.player.col, gameState.player.row, pDist, 'attack'),
            });
        }

        // Other NPCs
        for (const other of gameState.npcs) {
            if (other.id === this.id || !other.alive) continue;
            const dist = Math.abs(this.col - other.col) + Math.abs(this.row - other.row);
            if (dist <= this.bio.hearingRange) {
                const pubInfo = other.getPublicInfo();
                this.nearbyEntities.push({
                    type: 'npc',
                    name: other.name,
                    col: other.col,
                    row: other.row,
                    distance: dist,
                    hp: other.conditions.hp,
                    maxHp: other.bio.maxHp,
                    appearance: pubInfo.description,
                    visibleEquipment: pubInfo.visibleEquipment,
                    interaction: this._describeInteraction(other.col, other.row, dist, 'attack'),
                });
            }
        }

        // Nearby items on the ground
        for (const item of gameState.items) {
            if (item.collected) continue;
            const dist = Math.abs(this.col - item.col) + Math.abs(this.row - item.row);
            if (dist <= this.bio.hearingRange) {
                this.nearbyEntities.push({
                    type: 'item',
                    name: item.name,
                    col: item.col,
                    row: item.row,
                    distance: dist,
                    interaction: this._describeInteraction(item.col, item.row, dist, 'pick up'),
                });
            }
        }
    }

    // Describe what this NPC can currently do with a target at (col, row)
    _describeInteraction(col, row, dist, verb) {
        if (dist <= MELEE_RANGE) return `can ${verb} now`;
        if (this.movePoints > 0 && this._canReachMelee(col, row)) return `can move and ${verb} this turn`;
        return `out of range — would need to move closer`;
    }

    // --- Full context snapshot (for LLM prompt) ---

    getFullContext() {
        return {
            // Bio (permanent)
            bio: { ...this.bio },
            // Conditions (temporary)
            conditions: {
                hp: this.conditions.hp,
                maxHp: this.bio.maxHp,
                hpPercent: Math.round((this.conditions.hp / this.bio.maxHp) * 100),
                alive: this.alive,
                flags: { ...this.conditions.flags },
            },
            // Memory log
            memory: [...this.memory],
            // Inventory
            inventory: this.inventory.map(i => ({ name: i.name, description: i.description })),
            // Equipment
            equipment: {
                head: this.equipment.head?.name || null,
                body: this.equipment.body?.name || null,
                feet: this.equipment.feet?.name || null,
                hands: this.equipment.hands?.name || null,
            },
            // Position
            position: { col: this.col, row: this.row },
            // Nearby entities and items within perception range
            nearbyEntities: [...(this.nearbyEntities || [])],
            // Available actions this turn
            availableActions: [...this.availableActions],
            // Bonus actions (free, don't cost action point)
            bonusActions: [...(this.bonusActions || [])],
            // Available movement coordinates this turn
            availableCoordinates: this.availableCoordinates.map(c => ({ col: c.col, row: c.row, dist: c.dist })),
        };
    }

    // --- Public info (shown on world hover — only what is visibly apparent) ---

    getPublicInfo() {
        const EMPTY_LABELS = { head: 'bare head', body: 'bare body', feet: 'bare feet', hands: 'empty handed' };
        const visibleEquipment = {};
        for (const slot of ['head', 'body', 'feet', 'hands']) {
            const item = this.equipment[slot];
            visibleEquipment[slot] = item ? (item.visibleName || item.name) : EMPTY_LABELS[slot];
        }
        return {
            name: this.name,
            description: this.bio.appearance,   // brief glance description only
            hp: `${this.conditions.hp}/${this.bio.maxHp}`,
            alive: this.alive,
            visibleEquipment,
        };
    }
}
