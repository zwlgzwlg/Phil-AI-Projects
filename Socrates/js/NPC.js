export default class NPC {
    constructor(id, data, col, row) {
        this.id = id;
        this.name = data.name;
        this.symbol = data.symbol;
        this.color = data.color;
        this.hp = data.hp;
        this.maxHp = data.hp;
        this.col = col;
        this.row = row;
        this.alive = true;
        this.baseDamage = 8;

        // Character data for LLM prompts
        this.bio = data.bio;
        this.motivation = data.motivation;
        this.attitude = data.attitude;
        this.knowledge = data.knowledge;
        this.passCondition = data.passCondition;

        // Placeholder dialogue
        this.dialogueLines = [...data.dialogue];
        this.dialogueIndex = 0;

        // Conversation history for this NPC (persists across talks)
        this.conversationHistory = [];
    }

    moveTo(col, row) {
        this.col = col;
        this.row = row;
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) {
            this.alive = false;
        }
        return amount;
    }

    isAlive() {
        return this.alive;
    }

    // Placeholder: returns next static dialogue line
    // TODO: Replace with LLM API call
    getResponse(playerMessage, gameLog) {
        this.conversationHistory.push({ role: 'player', text: playerMessage });

        if (this.dialogueIndex >= this.dialogueLines.length) {
            this.dialogueIndex = 0;
        }
        const response = this.dialogueLines[this.dialogueIndex++];

        this.conversationHistory.push({ role: 'npc', text: response });
        return response;
    }

    // Placeholder: NPC AI decision for their turn
    // TODO: Replace with LLM API call
    // Returns { move: {col, row} | null, action: {type, target} | null }
    decideAction(gameState, gameLog) {
        // Placeholder: NPCs do nothing
        return { move: null, action: null };
    }

    // Get the opening line when player initiates conversation
    getOpeningLine() {
        if (this.conversationHistory.length === 0) {
            // First time talking
            return this.dialogueLines[0] || 'Greetings.';
        }
        // Returning to conversation
        return 'You return. What do you want?';
    }

    // Build context summary for LLM prompt (used later)
    getPromptContext() {
        return {
            name: this.name,
            bio: this.bio,
            motivation: this.motivation,
            attitude: this.attitude,
            knowledge: this.knowledge,
            passCondition: this.passCondition,
            hp: this.hp,
            maxHp: this.maxHp,
            alive: this.alive,
            conversationHistory: this.conversationHistory,
        };
    }
}
