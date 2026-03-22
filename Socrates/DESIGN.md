# Socrates: A Dialogue-Based Platformer

## Concept

A platformer/action game set in ancient Athens. You play as Socrates, fighting and reasoning your way through the city to defeat the 30 Tyrants. The core gimmick: philosopher NPCs are powered by an LLM, and you must reason with them — solving riddles, debating, and persuading — to progress.

## Core Mechanics

### Mode Switching

The game alternates between two modes:

- **Action mode** — standard platformer gameplay: movement, combat, item use. 
- **Dialogue mode** — turn-based conversation with an NPC, triggered by an "Initiate Conversation" key.

When you initiate a conversation, the game pauses action and enters dialogue. You must convince, outwit, or satisfy the NPC to proceed. Otherwise you might have to fight. If an NPC realises they have lost they might beg for their life.

You can have conversation with multiple NPCs. E.g., sometimes you must adjudicate philosophical disputes. You can also set them against each other, or recruit them to your team.

### Dual-Purpose Items

Every item has both a combat/action function and an intellectual/dialogue function:

| Item | Action Use | Dialogue Use |
|------|-----------|--------------|
| Sword | Deal damage to enemies | — |
| Boots | Increase movement speed | — |
| Philosopher's Robe | Light armour | Makes you look more respectable, increasing NPC trust |
| Tome of Resurrection | — | Resurrects a killed NPC as a ghost to argue on your behalf |
| Mind-Reading Device | — | Reveals a random thought from the NPC's head during conversation |
| Eye-catching Rings | -- | Intrigues distractable NPCs but makes greedy ones want to rob you.
| Random kill button | -- | It kills a random player or NPC. Only usable once. Can be used to threaten the morally sensitive. |

More items TBD — the design space here is wide. Items that bridge both modes are the most interesting (e.g., an item that is both a weapon and a rhetorical tool).

### Character Ideas

Zeno: loves riddles about infinity.
Thales: tries to convince you that all is water.
Ramanujan: wants you to evaluate complicated formulas for pi.
Ptolemy: argues that that the Earth is the centre of the universe.
Newcomb: a mad scientist who predicts your action and offers one or two boxes. Prediction is made as you walk through a strange area (LLM predicts based on your previous answers).
Thanatos: tough boss who tries to death in damascus you. Can be bargained with.
Bentham's head
Two brothers, one of whom always tells the truth and one always lies.
Zeus: periodically surveys whether you have been breaking the fourth wall and strikes you down.



### NPC Motivations (Hidden)

Each philosopher NPC has a hidden motivation that shapes how they respond in dialogue. This is given by a summary sheet the LLM uses in the context. Part of the summary is their character. Another part are traits like their health, inventory, and history with player.

- **Riddle-lover** — wants you to solve their riddle; satisfied by correct answers.
- **Conversationalist** — just wants an interesting, stimulating discussion; no single "right answer."
- **Contrarian** — disagrees with everything; you must find a way to make them argue themselves into agreeing with you.
- **Bribable** — can be swayed by items or flattery more than logic.
- **Loyalist** — loyal to the Tyrants; must be genuinely persuaded or tricked.
- **Special knowledge** - know location of treasure, motivation of others, weakness of a tyrant, secret code to open a door, etc.
- **Information** - what parts of the player's story do they know? E.g. if you kill a lot of people and they find out they might be hostile.

Also:
- **Attitude toward player** Amicable, Neutral, Hostile, Enraged, Fearful.

The player doesn't know the motivation upfront — they must read cues from the NPC's responses and adapt.

### Play log
We record conversations, killings, who shows mercy, etc. NPCs get some or all of this info in their context.

### Riddles

NPCs pose riddles that include both period-appropriate and deliberately anachronistic ones (e.g., a philosopher asking a logic puzzle that references modern concepts). This is part of the game's comedic tone.

## Setting

Ancient Athens, stylised. Levels progress through the city toward the Tyrants. Each area is guarded by philosopher NPCs who block the path until dealt with — through combat, conversation, or both.

## Difficulty modes:
Intellectual difficulty:
Idiot, Hoi Polloi, Sophist, Philosopher

Action difficulty, easy to hard. Think of good names.
