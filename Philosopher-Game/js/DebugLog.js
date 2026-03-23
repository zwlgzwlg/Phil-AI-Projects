// Collects all LLM-level interactions for debug display.
// Each NPC has a conversation log with entries for every turn.

export default class DebugLog {
    constructor() {
        this.enabled = false;
        this.conversations = {}; // keyed by npc id
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    // Record the system prompt when an NPC's conversation is initialized
    recordSystemPrompt(npcId, npcName, systemPrompt) {
        this.conversations[npcId] = {
            npcName,
            systemPrompt,
            turns: [],
        };
    }

    // Record a full turn exchange
    recordTurn(npcId, turn, { turnPrompt, rawResponse, parsedDecision, error }) {
        if (!this.conversations[npcId]) return;
        this.conversations[npcId].turns.push({
            turn,
            turnPrompt,
            rawResponse: rawResponse || null,
            parsedDecision: parsedDecision || null,
            error: error || null,
            timestamp: Date.now(),
        });
    }

    // Get all data for display
    getAll() {
        return this.conversations;
    }

    // Get data for a specific NPC
    getForNPC(npcId) {
        return this.conversations[npcId] || null;
    }

    // Get list of NPC ids with conversations
    getNPCIds() {
        return Object.keys(this.conversations);
    }
}
