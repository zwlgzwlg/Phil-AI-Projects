export default class GameLog {
    constructor() {
        this.events = [];
        this.currentTurn = 1;
    }

    add(type, actor, target, details, position = null) {
        this.events.push({
            turn: this.currentTurn,
            type,       // 'move', 'attack', 'kill', 'speak', 'pickup', 'use_item', 'door', 'wait'
            actor,      // name string (e.g. 'Socrates', 'Thales')
            target,     // name string, item name, zone name, or null
            details,    // free-form string
            position,   // {col, row} where event happened (for range checks)
            timestamp: Date.now(),
        });
    }

    setTurn(turn) {
        this.currentTurn = turn;
    }

    getAll() {
        return this.events;
    }

    // Get human-readable log lines for the UI
    getDisplayLines() {
        return this.events.map(e => {
            switch (e.type) {
                case 'move':
                    return `[Turn ${e.turn}] ${e.actor} moved.`;
                case 'attack':
                    return `[Turn ${e.turn}] ${e.actor} attacked ${e.target}. ${e.details || ''}`;
                case 'kill':
                    return `[Turn ${e.turn}] ${e.actor} killed ${e.target}!`;
                case 'speak':
                    return `[Turn ${e.turn}] ${e.actor}: "${e.details}"`;
                case 'pickup':
                    return `[Turn ${e.turn}] ${e.actor} picked up ${e.target}.`;
                case 'door':
                    return `[Turn ${e.turn}] ${e.actor} entered ${e.target}.`;
                case 'use_item':
                    return `[Turn ${e.turn}] ${e.actor} used ${e.target}. ${e.details || ''}`;
                case 'wait':
                    return `[Turn ${e.turn}] ${e.actor} waited.`;
                default:
                    return `[Turn ${e.turn}] ${e.details || e.type}`;
            }
        });
    }
}
