# Philosopher

A turn-based grid RPG set in ancient Athens. You play as a custom character navigating the city to defeat the 30 Tyrants. Every NPC is controlled by an LLM. You can fight them, reason with them, trick them, or befriend them — their behaviour emerges entirely from their character, memory, and the actions available to them.

## Architecture

Web app. Vanilla JavaScript + HTML5 Canvas. No framework, no build step. Serve with any static file server.

```
Socrates/
  index.html
  css/style.css
  js/
    main.js          — boot
    Game.js          — turn loop, state machine, input handling
    Grid.js          — tile map, BFS pathfinding, reachability
    Renderer.js      — canvas drawing
    Player.js        — player state
    NPC.js           — NPC state, turn logic, LLM context builder
    GameLog.js       — global event log
    data.js          — zone maps, NPC definitions, item definitions
    ui.js            — HUD, log panel, inventory pane, context menus
```

## Turn System

Modelled after Baldur's Gate 3. Each turn, the active entity (player or NPC) gets:

- **Movement points** (player: 4, NPCs: varies) — spend freely to move around the grid.
- **Action points** (1) — spend on one action: attack, speak, use item, pick up item, or interact with a door.

Movement and action can be done in any order. The player clicks **End Turn** to pass to the AI. Then each NPC takes their turn in sequence, spending their own movement and action points. Then the player goes again.

## Controls

- **Left click** a highlighted tile to move there (costs movement points equal to path distance).
- **Right click** a tile to open a context menu:
  - Adjacent NPC: "Attack [Name]"
  - Item on player's tile: "Pick up [Item]"
  - Door on player's tile: "Enter [Zone]"
- **Right click** an inventory item: "Use [Item]"
- **Speech input** at the bottom: type a message and click Speak (costs 1 action point). Everyone within hearing range (5 tiles) hears it.
- **End Turn** button passes to the AI.

## Speech System

There is no separate dialogue mode. Speech is an action like any other. When anyone speaks (player or NPC), their message appears in the game log. All entities within hearing range (Manhattan distance <= 5) receive the message in their personal memory log.

This means:
- Conversations happen over multiple turns, interleaved with movement and combat.
- Third parties can overhear and react.
- NPCs can talk to each other.
- You can shout across a room or whisper by moving close first.

## NPCs

Every NPC follows the same rules as the player. On their turn they get movement points and an action point, and choose what to do. Currently placeholder AI cycles through static dialogue lines; this will be replaced by LLM calls.

### NPC Data Model

Each NPC has:

**Bio** (permanent traits):
- `name`, `description` — who they are, what drives them, what they know
- `baseDamage`, `maxHp`, `maxMovePoints`, `maxActionPoints`, `hearingRange`

**Conditions** (temporary/novel traits):
- `general' -- LLM written "recent" bio. E.g., has recently agreed to help the player in their endeavours. Re-writes at the end of a room.
- `hp` — current health
- `flags` — arbitrary boolean conditions, e.g. `{ blocking_path: true, suspicious: true, riddle_solved: false }`

**Memory** — chronological log of everything the NPC has perceived: speech heard, attacks witnessed, items used nearby, etc. Fed to the LLM as context.

**Inventory** — items the NPC carries. NPCs can use items on their turn.

**Position** — grid coordinates.

**Available actions** — computed each turn based on adjacency, inventory, and action points. The LLM picks from this list.

**Available coordinates** — BFS-computed reachable tiles for this turn. The LLM picks a destination or stays put.

**Nearby entities** — positions, names, and basic stats of all characters and items within perception range.

**Player threat level** — a crude assessment (`low`, `moderate`, `dangerous`, `deadly`) based on the player's damage, armor, and health.

### NPC Decision

`npc.getFullContext()` returns a complete snapshot of all the above, ready to serialize into an LLM prompt. `npc.decideAction(gameState)` returns `{ moveTo, action }`. The game validates the decision against available actions/coordinates before executing.

### Inspect

Right-clicking any entity or item shows an "Inspect" option. This opens a panel with public info: name, description, HP, attitude, inventory (NPCs), or stats/effects (items).

## Zones

Three zones, each a 16x12 tile grid. Connected by door tiles.

1. **Agora** — Cicero (amicable advisor). Items: Bronze Sword.
2. **Academy** — Zeno (neutral riddle-lover). Items: Philosopher's Robe.
3. **Acropolis** — Ptolemy (hostile loyalist). Items: Tome of Resurrection.

## Items

Items have both combat and dialogue effects:

| Item | Combat Effect | Dialogue Effect |
|------|--------------|-----------------|
| Bronze Sword | +20 damage | — |
| Philosopher's Robe | +5 armor | +10 trust |
| Tome of Resurrection | — | Can resurrect a killed NPC |

NPCs also carry items (e.g. Ptolemy has a Star Chart and Iron Spear).

## Game Log

All events are recorded with structured data: `{ turn, type, actor, target, details, position }`. Event types: `move`, `attack`, `kill`, `speak`, `pickup`, `use_item`, `door`, `wait`.

The log serves two purposes:
1. **Player UI** — scrollable text panel showing everything that has happened.
2. **NPC memory** — events are broadcast to nearby NPCs based on hearing/sight range, building each NPC's personal memory for LLM context.

## Character Ideas (Future)

Commander-types
- Zhuge Liang: issues clever strategems and commands to his soldiers. E.g., baits you into firing arrows at fake soldiers and collects them. Intimidates you by showing strength when he is weak. Places hidden land mines.
- Another guy who keeps them motivated?
- A guy who has a lot of soldiers but issues confusing commands.

Dunce-types
- Run by fast and cheap AI
- Minimal character traits. But still can talk and be reasoned with.

Animal-types
- Dunce-types but with no conversation log and no option to speak.

Philosopher-types
- Game master: challenges you to tic-tac-toe, checkers, or chess. Implemented by picking up and dropping pieces.
- Zeno: loves riddles about infinity
- Thales: tries to convince you all is water
- Ramanujan: wants you to evaluate formulas for pi
- Ptolemy: argues the Earth is the centre of the universe
- Newcomb: a mad scientist who predicts your actions and offers one or two boxes
- Thanatos: tough boss, can be bargained with
- Bentham's head
- Two brothers: one always tells the truth, one always lies
- Zeus: strikes you down if you break the fourth wall. If you break the fourth wall a bit he gets grumpy. If you are using prompt injection nonsense he gets murderous. If you are using it seriously he kills you before you get a chance to defend yourself.

## Item Ideas (Future)

- Memory wiper: deletes the recent log in target NPC.
- Memory inspector: displays the memory log of target NPC.
- Time wiper: deletes the last 10 turns in the global log. All traits stay the same.
- Amulet of foolishness: downgrades the model used by nearby AI.
- Costume: gives you a fake bio (with some discrepancies so the AI might see through it).
- Magical Costume: you write a fake bio.
- Intimidating sword: appears to do much more damage than it does.
- Warhammer: a hit scrambles a recent scheme of the target.
- Potion of Sophistry: using it causes your utterances for the next 5 turns to be edited into flowery language by AI. 
- Potion of Poetry: using it causes your utterances to be converted into rhymes with the same gist for the next 5 turns. Rhymes will fit the theme of the conversation (e.g. iambic pentameter following iambic pentameter)
- Potion of telepathy: drinking it gives you the ability to speak privately with another person for 5 turns. Every time you send a telepathic message, they gain a possible action of responding telepathically.
- Ring of telepathy: you can communicate telepathically with another wearer of such a ring.
- Cursed Book: NPCs holding this book can access the internet.
- Scrying Orb: use on a door to get a hint as to what is behind it. LLM should give a mysterious sounding description. Can only be used once per room.
- Army in a Can: 3 loyal dunce NPCs you can spawn near you by using it. They go back in the can and heal when you use it again.
- Phone-a-friend: use on a loyal NPC to store them inside. Release them by using again and they can help you.
- Book of Artefacts: use to permanently gain the ability to see the details of all items worn by NPC.

## Difficulty Modes (Future)

Intellectual difficulty: Idiot, Hoi Polloi, Sophist, Philosopher

Combat difficulty: TBD names.

## LLM Integration (TODO)

`NPC.decideAction()` and speech responses are currently placeholders. The plan:
- Each NPC turn, call an LLM with `npc.getFullContext()` as structured context.
- The LLM chooses from `availableActions` and `availableCoordinates`.
- Speech content is generated by the LLM in character.
- Provider (Claude / OpenAI) configurable via localStorage settings.
