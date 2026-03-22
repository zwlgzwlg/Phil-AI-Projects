const NPC_MOVE_POINTS = 3;
const NPC_ACTION_POINTS = 1;
const HEARING_RANGE = 5;

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

        this.maxMovePoints = NPC_MOVE_POINTS;
        this.maxActionPoints = NPC_ACTION_POINTS;

        // Character data for LLM prompts
        this.bio = data.bio;
        this.motivation = data.motivation;
        this.attitude = data.attitude;
        this.knowledge = data.knowledge;
        this.passCondition = data.passCondition;

        // Placeholder dialogue lines (used by placeholder AI)
        this.dialogueLines = [...data.dialogue];
        this.dialogueIndex = 0;

        // Personal log: everything this NPC has seen and heard
        this.personalLog = [];
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

    // Record something this NPC witnessed
    addToLog(entry) {
        this.personalLog.push({
            ...entry,
            timestamp: Date.now(),
        });
    }

    // Check if a position is within hearing range
    canHear(col, row) {
        const dist = Math.abs(this.col - col) + Math.abs(this.row - row);
        return dist <= HEARING_RANGE;
    }

    // Check if a position is within sight (same range for now)
    canSee(col, row) {
        const dist = Math.abs(this.col - col) + Math.abs(this.row - row);
        return dist <= HEARING_RANGE;
    }

    // Placeholder AI: decide what to do on this NPC's turn
    // TODO: Replace with LLM API call
    // Returns { moveTo: {col, row} | null, action: { type, message?, targetId? } | null }
    decideAction(gameState) {
        // Placeholder: if player is nearby and NPC hasn't spoken recently, speak
        const playerDist = Math.abs(this.col - gameState.player.col) + Math.abs(this.row - gameState.player.row);

        if (playerDist <= HEARING_RANGE) {
            // Say next dialogue line
            if (this.dialogueIndex >= this.dialogueLines.length) {
                this.dialogueIndex = 0;
            }
            const message = this.dialogueLines[this.dialogueIndex++];
            return {
                moveTo: null,
                action: { type: 'speak', message },
            };
        }

        // Otherwise do nothing
        return { moveTo: null, action: null };
    }

    // Build full context for LLM prompt (used later)
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
            personalLog: this.personalLog,
        };
    }
}
