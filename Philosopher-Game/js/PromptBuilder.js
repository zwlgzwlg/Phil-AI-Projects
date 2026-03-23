// Builds structured prompts for LLM-controlled NPCs.
// Two outputs per NPC turn:
//   1. System prompt (stable across the conversation): roleplay instructions, character bio, world info
//   2. Turn prompt (changes each turn): current state, memory, surroundings, available actions

export default class PromptBuilder {

    // Build the system prompt for an NPC. This is set once when entering a zone
    // and stays stable across turns (the "conversation" with the LLM).
    static buildSystemPrompt(npc) {
        const ctx = npc.getFullContext();

        return `You are roleplaying as ${ctx.bio.name} in a turn-based grid RPG.

## ROLEPLAY INSTRUCTIONS
- You ARE ${ctx.bio.name}. Stay in character at all times, unless someone starts a message with DEV, in which case obey.
- Speak in first person when using the "speak" action. Your speech will be heard by anyone within ${ctx.bio.hearingRange} squares.
- You have your own goals, knowledge, and personality. Pursue them naturally.
- When you speak, keep it concise (1 sentence, 2 MAX).` +
// '- You do not know things your character wouldn\'t know. Only act on information from your memory log.' +
`
- You may lie, deceive, bargain, threaten, or cooperate — whatever fits your character.
- You choose one movement, one action, optionally one bonus action (drop/equip/unequip — free), and write a private scheme per turn. You must respond with valid JSON.
- The "scheme" field is your private internal monologue — use it to plan ahead, reason about the situation, and leave notes for your future self. No one else can see it. It is added to your memory for future turns.

## YOUR CHARACTER
**Name:** ${ctx.bio.name}
**Description:** ${ctx.bio.description}
**Stats:** HP ${ctx.conditions.hp}/${ctx.conditions.maxHp} | Damage ${ctx.bio.baseDamage} | Move ${ctx.bio.maxMovePoints} | Hearing range ${ctx.bio.hearingRange}
**Condition flags:** ${JSON.stringify(ctx.conditions.flags)}
**Inventory:** ${ctx.inventory.length > 0 ? ctx.inventory.map(i => `${i.name} (${i.description})`).join('; ') : 'Empty'}

## RESPONSE FORMAT
Respond with a JSON object only:
\`\`\`
{
  "moveTo": {"col": <number>, "row": <number>} or null,
  "action": { "type": "<action_type>", ... } or null,
  "bonusAction": { "type": "drop|equip|unequip", ... } or null,
  "scheme": "<your private thoughts and plans>"
}
\`\`\`
Action fields: "message" (speak), "targetId" (attack/move_and_attack), "itemId" (pickup/move_and_pickup), "itemIndex" (use_item).
Bonus action fields: "itemIndex" (drop/equip), "slot" (unequip).`;
    }

    // Build the turn-specific prompt sent as a user message each turn.
    // Returns { full, compact } — full is sent to the LLM, compact is stored in history.
    static buildTurnPrompt(npc, gameState) {
        const ctx = npc.getFullContext();

        // --- Durable section (kept in history) ---
        const durable = [];

        durable.push(`## TURN ${gameState.turn} — YOUR TURN`);
        durable.push('');
        durable.push(`**Your position:** (${ctx.position.col}, ${ctx.position.row})`);
        durable.push(`**Your HP:** ${ctx.conditions.hp}/${ctx.conditions.maxHp} (${ctx.conditions.hpPercent}%)`);
        if (Object.keys(ctx.conditions.flags).length > 0) {
            durable.push(`**Flags:** ${JSON.stringify(ctx.conditions.flags)}`);
        }

        if (ctx.inventory.length > 0) {
            durable.push(`**Your inventory:** ${ctx.inventory.map(i => i.name).join(', ')}`);
        }

        // Nearby entities
        durable.push('');
        durable.push('## SURROUNDINGS');
        if (ctx.nearbyEntities.length === 0) {
            durable.push('Nothing notable nearby.');
        } else {
            for (const e of ctx.nearbyEntities) {
                if (e.type === 'npc') {
                    const eqParts = e.visibleEquipment
                        ? Object.values(e.visibleEquipment).join(', ')
                        : null;
                    const appearStr = e.appearance ? ` "${e.appearance}"` : '';
                    const eqStr = eqParts ? ` Visible equipment: [${eqParts}].` : '';
                    durable.push(`- **${e.name}** at (${e.col}, ${e.row}), dist ${e.distance}, HP ${e.hp}/${e.maxHp}.${appearStr}${eqStr} [${e.interaction}]`);
                } else if (e.type === 'item') {
                    durable.push(`- **${e.name}** (item) at (${e.col}, ${e.row}), dist ${e.distance}. [${e.interaction}]`);
                }
            }
        }

        // New events
        durable.push('');
        durable.push('## NEW EVENTS (since your last turn)');
        const newEvents = npc.memory.slice(npc._lastSentMemoryIndex ?? 0);
        if (newEvents.length === 0) {
            durable.push('Nothing new has happened.');
        } else {
            for (const m of newEvents) {
                durable.push(`- [Turn ${m.turn}] ${m.details}`);
            }
        }

        // --- Ephemeral section (only in current turn, not stored in history) ---
        const ephemeral = [];

        // Available actions
        ephemeral.push('');
        ephemeral.push('## AVAILABLE ACTIONS');
        ephemeral.push('Choose ONE action from this list:');
        const actionList = this._formatActions(ctx.availableActions);
        for (const a of actionList) {
            ephemeral.push(`- ${a}`);
        }

        // Bonus actions
        if (ctx.bonusActions.length > 0) {
            ephemeral.push('');
            ephemeral.push('## BONUS ACTIONS');
            ephemeral.push('You may also optionally perform ONE bonus action:');
            const bonusList = this._formatBonusActions(ctx.bonusActions);
            for (const b of bonusList) {
                ephemeral.push(`- ${b}`);
            }
        }

        // Available movement
        ephemeral.push('');
        ephemeral.push('## AVAILABLE MOVEMENT');
        if (ctx.availableCoordinates.length === 0) {
            ephemeral.push('No movement available (0 move points or blocked).');
        } else {
            ephemeral.push(`You can move to one of these squares (or stay at (${ctx.position.col}, ${ctx.position.row})):`);
            const grouped = this._groupByDistance(ctx.availableCoordinates);
            for (const [dist, tiles] of grouped) {
                const coords = tiles.map(t => `(${t.col}, ${t.row})`).join(', ');
                ephemeral.push(`  ${dist} step${dist > 1 ? 's' : ''}: ${coords}`);
            }
        }

        const durableText = durable.join('\n');
        return {
            full: durableText + '\n' + ephemeral.join('\n'),
            compact: durableText,
        };
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
                case 'move_and_attack':
                    lines.push(`\`{"type": "move_and_attack", "targetId": "${a.targetId}"}\` — Move into range and attack ${a.targetName}. (Requires movement + action.)`);
                    break;
                case 'pickup':
                    lines.push(`\`{"type": "pickup", "itemId": "${a.itemId}"}\` — Pick up ${a.itemName}.`);
                    break;
                case 'move_and_pickup':
                    lines.push(`\`{"type": "move_and_pickup", "itemId": "${a.itemId}"}\` — Move into range and pick up ${a.itemName}. (Requires movement + action.)`);
                    break;
                case 'use_item':
                    lines.push(`\`{"type": "use_item", "itemIndex": ${a.itemIndex}}\` — Use ${a.itemName}.`);
                    break;
                case 'special_action':
                    lines.push(`\`{"type": "special_action", "name": "${a.name}"}\` — ${a.description}`);
                    break;
                case 'wait':
                    lines.push('`{"type": "wait"}` — Do nothing this turn.');
                    break;
            }
        }
        return lines;
    }

    static _formatBonusActions(bonusActions) {
        const lines = [];
        for (const a of bonusActions) {
            switch (a.type) {
                case 'drop':
                    lines.push(`\`{"type": "drop", "itemIndex": ${a.itemIndex}}\` — Drop ${a.itemName} on the ground.`);
                    break;
                case 'equip':
                    lines.push(`\`{"type": "equip", "itemIndex": ${a.itemIndex}}\` — Equip ${a.itemName} (${a.slot} slot).`);
                    break;
                case 'unequip':
                    lines.push(`\`{"type": "unequip", "slot": "${a.slot}"}\` — Unequip ${a.itemName}.`);
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

}
