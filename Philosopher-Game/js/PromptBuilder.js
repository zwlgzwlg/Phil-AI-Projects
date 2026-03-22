// Builds structured prompts for LLM-controlled NPCs.
// Two outputs per NPC turn:
//   1. System prompt (stable across the conversation): roleplay instructions, character bio, world info
//   2. Turn prompt (changes each turn): current state, memory, surroundings, available actions

export default class PromptBuilder {

    // Build the system prompt for an NPC. This is set once when entering a zone
    // and stays stable across turns (the "conversation" with the LLM).
    static buildSystemPrompt(npc, worldInfo) {
        const ctx = npc.getFullContext();

        return `You are roleplaying as ${ctx.bio.name} in a turn-based grid RPG called "Philosopher".

## GAME RULES
${worldInfo}

## ROLEPLAY INSTRUCTIONS
- You ARE ${ctx.bio.name}. Stay in character at all times.
- Speak in first person when using the "speak" action. Your speech will be heard by anyone within ${ctx.bio.hearingRange} squares.
- You have your own goals, knowledge, and personality. Pursue them naturally.
- You do not know things your character wouldn't know. Only act on information from your memory log.
- When you speak, keep it concise (1-3 sentences). You are in a game, not writing an essay.
- You may lie, deceive, bargain, threaten, or cooperate — whatever fits your character.
- You choose one movement and one action per turn. You must respond with valid JSON.

## YOUR CHARACTER
**Name:** ${ctx.bio.name}
**Description:** ${ctx.bio.description}
**Stats:** HP ${ctx.conditions.hp}/${ctx.conditions.maxHp} | Damage ${ctx.bio.baseDamage} | Move ${ctx.bio.maxMovePoints} | Hearing range ${ctx.bio.hearingRange}
**Condition flags:** ${JSON.stringify(ctx.conditions.flags)}
**Inventory:** ${ctx.inventory.length > 0 ? ctx.inventory.map(i => `${i.name} (${i.description})`).join('; ') : 'Empty'}`;
    }

    // Build the turn-specific prompt sent as a user message each turn.
    static buildTurnPrompt(npc, gameState) {
        const ctx = npc.getFullContext();
        const lines = [];

        // Current status
        lines.push(`## TURN ${gameState.turn} — YOUR TURN`);
        lines.push('');
        lines.push(`**Your position:** (${ctx.position.col}, ${ctx.position.row})`);
        lines.push(`**Your HP:** ${ctx.conditions.hp}/${ctx.conditions.maxHp} (${ctx.conditions.hpPercent}%)`);
        if (Object.keys(ctx.conditions.flags).length > 0) {
            lines.push(`**Flags:** ${JSON.stringify(ctx.conditions.flags)}`);
        }

        // Inventory
        if (ctx.inventory.length > 0) {
            lines.push(`**Your inventory:** ${ctx.inventory.map(i => i.name).join(', ')}`);
        }

        // Player info
        if (ctx.playerThreatLevel !== 'unknown') {
            lines.push(`**Player threat level:** ${ctx.playerThreatLevel}`);
        }

        // Nearby entities
        lines.push('');
        lines.push('## SURROUNDINGS');
        if (ctx.nearbyEntities.length === 0) {
            lines.push('Nothing notable nearby.');
        } else {
            for (const e of ctx.nearbyEntities) {
                if (e.type === 'player') {
                    lines.push(`- **${e.name}** (player) at (${e.col}, ${e.row}), distance ${e.distance}, HP ${e.hp}/${e.maxHp}`);
                } else if (e.type === 'npc') {
                    lines.push(`- **${e.name}** (npc) at (${e.col}, ${e.row}), distance ${e.distance}, HP ${e.hp}/${e.maxHp}`);
                } else if (e.type === 'item') {
                    lines.push(`- **${e.name}** (item) at (${e.col}, ${e.row}), distance ${e.distance}`);
                }
            }
        }

        // Memory
        lines.push('');
        lines.push('## MEMORY (what you have seen and heard)');
        if (ctx.memory.length === 0) {
            lines.push('Nothing has happened yet.');
        } else {
            // Show last 30 entries to keep prompt manageable
            const recent = ctx.memory.slice(-30);
            if (ctx.memory.length > 30) {
                lines.push(`(${ctx.memory.length - 30} earlier events omitted)`);
            }
            for (const m of recent) {
                lines.push(`- [Turn ${m.turn}] ${m.details}`);
            }
        }

        // Available actions
        lines.push('');
        lines.push('## AVAILABLE ACTIONS');
        lines.push('Choose ONE action from this list:');
        const actionList = this._formatActions(ctx.availableActions);
        for (const a of actionList) {
            lines.push(`- ${a}`);
        }

        // Available movement
        lines.push('');
        lines.push('## AVAILABLE MOVEMENT');
        if (ctx.availableCoordinates.length === 0) {
            lines.push('No movement available (0 move points or blocked).');
        } else {
            lines.push(`You can move to one of these squares (or stay at (${ctx.position.col}, ${ctx.position.row})):`);
            const grouped = this._groupByDistance(ctx.availableCoordinates);
            for (const [dist, tiles] of grouped) {
                const coords = tiles.map(t => `(${t.col}, ${t.row})`).join(', ');
                lines.push(`  ${dist} step${dist > 1 ? 's' : ''}: ${coords}`);
            }
        }

        // Response format
        lines.push('');
        lines.push('## RESPONSE FORMAT');
        lines.push('Respond with a JSON object. Nothing else — no markdown, no explanation.');
        lines.push('```');
        lines.push('{');
        lines.push('  "moveTo": {"col": <number>, "row": <number>} or null,');
        lines.push('  "action": {');
        lines.push('    "type": "<action_type>",');
        lines.push('    "message": "<your speech>" (only for speak),');
        lines.push('    "targetId": "<id>" (only for attack),');
        lines.push('    "itemIndex": <number> (only for use_item/drop)');
        lines.push('  } or null');
        lines.push('}');
        lines.push('```');

        return lines.join('\n');
    }

    static _formatActions(actions) {
        const lines = [];
        for (const a of actions) {
            switch (a.type) {
                case 'speak':
                    lines.push('`{"type": "speak", "message": "<what you say>"}` — Say something aloud. Everyone nearby hears it.');
                    break;
                case 'attack':
                    lines.push(`\`{"type": "attack", "targetId": "${a.targetId}"}\` — Attack ${a.targetName}.`);
                    break;
                case 'use_item':
                    lines.push(`\`{"type": "use_item", "itemIndex": ${a.itemIndex}}\` — Use ${a.itemName}.`);
                    break;
                case 'drop':
                    lines.push(`\`{"type": "drop", "itemIndex": ${a.itemIndex}}\` — Drop ${a.itemName} on the ground nearby.`);
                    break;
                case 'wait':
                    lines.push('`{"type": "wait"}` — Do nothing this turn.');
                    break;
            }
        }
        return lines;
    }

    static _groupByDistance(coords) {
        const groups = new Map();
        for (const c of coords) {
            if (!groups.has(c.dist)) groups.set(c.dist, []);
            groups.get(c.dist).push(c);
        }
        return [...groups.entries()].sort((a, b) => a[0] - b[0]);
    }

    // World info string — stable background about the game world
    static getWorldInfo(zoneName) {
        return `"Philosopher" is a turn-based grid RPG set in ancient Athens. The city is ruled by the 30 Tyrants.
Each turn, every character (player and NPCs) gets movement points and 1 action point.
Actions: speak (say something aloud), attack (melee range 2 squares), use_item, drop (put an item on the ground), or wait.
Speech is heard by everyone within hearing range. Melee attacks reach 2 squares by default (Manhattan distance).
The player is a wandering philosopher trying to navigate the city. NPCs are independent characters with their own goals.
You are currently in the ${zoneName}.`;
    }
}
