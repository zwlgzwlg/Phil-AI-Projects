import PromptBuilder from './PromptBuilder.js';

const NPC_MOVE_POINTS = 3;
const NPC_ACTION_POINTS = 1;
const HEARING_RANGE = 5;
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
            flags: { ...data.initialFlags },
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

        // Attack entities within melee range
        const pDist = Math.abs(this.col - gameState.player.col) + Math.abs(this.row - gameState.player.row);
        if (pDist <= MELEE_RANGE) {
            this.availableActions.push({ type: 'attack', targetId: 'player', targetName: gameState.player.name });
        }
        for (const other of gameState.npcs) {
            if (other.id !== this.id && other.alive) {
                const dist = Math.abs(this.col - other.col) + Math.abs(this.row - other.row);
                if (dist <= MELEE_RANGE) {
                    this.availableActions.push({ type: 'attack', targetId: other.id, targetName: other.name });
                }
            }
        }

        // Use or drop item (if has any)
        for (let i = 0; i < this.inventory.length; i++) {
            this.availableActions.push({ type: 'use_item', itemIndex: i, itemName: this.inventory[i].name });
            this.availableActions.push({ type: 'drop', itemIndex: i, itemName: this.inventory[i].name });
        }

        // Special actions unique to this NPC
        for (const sa of this.bio.specialActions) {
            this.availableActions.push({ type: 'special_action', name: sa.name, description: sa.description });
        }

        // Wait (always)
        this.availableActions.push({ type: 'wait' });
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

    takeDamage(amount) {
        this.conditions.hp = Math.max(0, this.conditions.hp - amount);
        if (this.conditions.hp <= 0) {
            this.alive = false;
        }
        return amount;
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

    // --- LLM conversation management ---

    // Called when entering a zone — sets up the system prompt for this NPC's LLM instance
    initConversation(zoneName) {
        this.systemPrompt = PromptBuilder.buildSystemPrompt(this, PromptBuilder.getWorldInfo(zoneName));
        this.conversationHistory = [];
    }

    // Build the messages array to send to the LLM for this turn
    buildLLMMessages(gameState) {
        const turnPrompt = PromptBuilder.buildTurnPrompt(this, gameState);
        return {
            systemPrompt: this.systemPrompt,
            messages: [
                ...this.conversationHistory,
                { role: 'user', content: turnPrompt },
            ],
        };
    }

    // Record the LLM's response in conversation history so it has context for next turn
    recordTurn(turnPrompt, response) {
        this.conversationHistory.push({ role: 'user', content: turnPrompt });
        this.conversationHistory.push({ role: 'assistant', content: response });

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
        this.playerThreatLevel = 'unknown';

        // Player
        const pDist = Math.abs(this.col - gameState.player.col) + Math.abs(this.row - gameState.player.row);
        if (pDist <= this.bio.hearingRange) {
            const playerInfo = gameState.player.getPublicInfo?.() ?? {};
            this.nearbyEntities.push({
                type: 'player',
                name: gameState.player.name,
                col: gameState.player.col,
                row: gameState.player.row,
                distance: pDist,
                hp: gameState.player.hp,
                maxHp: gameState.player.maxHp,
                appearance: playerInfo.description || gameState.player.description,
                visibleEquipment: playerInfo.visibleEquipment,
            });
            this.playerThreatLevel = this._assessThreat(gameState.player);
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
                });
            }
        }
    }

    _assessThreat(player) {
        const damage = player.getDamage();
        const armor = player.getArmor();
        const hpPercent = player.hp / player.maxHp;
        const score = damage + armor * 2 + hpPercent * 20;

        if (score >= 60) return 'deadly';
        if (score >= 40) return 'dangerous';
        if (score >= 25) return 'moderate';
        return 'low';
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
            // Threat assessment of the player
            playerThreatLevel: this.playerThreatLevel || 'unknown',
            // Available actions this turn
            availableActions: [...this.availableActions],
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
