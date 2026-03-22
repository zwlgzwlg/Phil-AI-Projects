export default class GameLog {
    constructor() {
        this.events = [];
    }

    add(type, actor, target, details) {
        this.events.push({
            turn: this.events.length > 0 ? this.events[this.events.length - 1].turn : 0,
            type,       // 'move', 'attack', 'kill', 'talk', 'pickup', 'use_item', 'door', 'damage', 'wait'
            actor,      // 'player' or npc id
            target,     // npc id, item id, zone name, or null
            details,    // free-form string
            timestamp: Date.now(),
        });
    }

    setTurn(turn) {
        // Update turn counter for subsequent events
        if (this.events.length > 0) {
            this.events[this.events.length - 1].turn = turn;
        }
    }

    // Get all events (for full log display)
    getAll() {
        return this.events;
    }

    // Get events relevant to a specific NPC (based on what they'd know)
    // For now returns all events; later filtered by NPC's information field
    getEventsForNPC(npcId) {
        // TODO: Filter based on NPC's information/knowledge scope
        return this.events;
    }

    // Generate a prose summary of events for LLM prompt
    getSummaryForNPC(npcId) {
        const events = this.getEventsForNPC(npcId);
        if (events.length === 0) return 'Nothing notable has happened yet.';

        const lines = [];
        for (const e of events) {
            switch (e.type) {
                case 'kill':
                    lines.push(`${e.actor === 'player' ? 'Socrates' : e.actor} killed ${e.target}.`);
                    break;
                case 'attack':
                    lines.push(`${e.actor === 'player' ? 'Socrates' : e.actor} attacked ${e.target}. ${e.details}`);
                    break;
                case 'talk':
                    lines.push(`${e.actor === 'player' ? 'Socrates' : e.actor} spoke with ${e.target}.`);
                    break;
                case 'pickup':
                    lines.push(`Socrates picked up ${e.target}.`);
                    break;
                case 'door':
                    lines.push(`Socrates entered ${e.target}.`);
                    break;
                case 'mercy':
                    lines.push(`Socrates showed mercy to ${e.target}.`);
                    break;
                default:
                    if (e.details) lines.push(e.details);
                    break;
            }
        }
        return lines.join(' ');
    }

    // Get human-readable log lines for the UI
    getDisplayLines() {
        return this.events.map(e => {
            const actor = e.actor === 'player' ? 'Socrates' : e.actor;
            switch (e.type) {
                case 'move':
                    return `[Turn ${e.turn}] ${actor} moved.`;
                case 'attack':
                    return `[Turn ${e.turn}] ${actor} attacked ${e.target}. ${e.details || ''}`;
                case 'kill':
                    return `[Turn ${e.turn}] ${actor} killed ${e.target}!`;
                case 'talk':
                    return `[Turn ${e.turn}] ${actor} began talking with ${e.target}.`;
                case 'pickup':
                    return `[Turn ${e.turn}] ${actor} picked up ${e.target}.`;
                case 'door':
                    return `[Turn ${e.turn}] ${actor} entered ${e.target}.`;
                case 'use_item':
                    return `[Turn ${e.turn}] ${actor} used ${e.target}. ${e.details || ''}`;
                case 'wait':
                    return `[Turn ${e.turn}] ${actor} waited.`;
                case 'damage':
                    return `[Turn ${e.turn}] ${e.details}`;
                default:
                    return `[Turn ${e.turn}] ${e.details || e.type}`;
            }
        });
    }
}
