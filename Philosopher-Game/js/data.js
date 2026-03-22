// Tile types
export const TILE = {
    FLOOR: 0,
    WALL: 1,
    DOOR: 2,
};

// Zone maps — 16 columns x 12 rows
// 0 = floor, 1 = wall, 2 = door
export const ZONES = [
    {
        name: 'Agora',
        cols: 16,
        rows: 12,
        map: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,1,1,0,0,0,0,1,1,0,0,0,1],
            [1,0,0,0,1,1,0,0,0,0,1,1,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart: { col: 1, row: 5 },
        npcs: ['cicero'],
        items: [{ id: 'sword', col: 8, row: 3 }],
        doorTargets: { '15,10': { zone: 1, col: 1, row: 5 } },
    },
    {
        name: 'Academy',
        cols: 16,
        rows: 12,
        map: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1],
            [2,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart: { col: 1, row: 5 },
        npcs: ['zeno'],
        items: [{ id: 'robe', col: 10, row: 7 }],
        doorTargets: {
            '0,5':   { zone: 0, col: 14, row: 10 },
            '15,10': { zone: 2, col: 1, row: 5 },
        },
    },
    {
        name: 'Acropolis',
        cols: 16,
        rows: 12,
        map: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart: { col: 1, row: 5 },
        npcs: ['ptolemy'],
        items: [{ id: 'tome', col: 7, row: 9 }],
        doorTargets: {
            '0,5': { zone: 1, col: 14, row: 10 },
        },
    },
];

// NPC definitions
export const NPC_DATA = {
    cicero: {
        name: 'Cicero',
        symbol: 'C',
        color: '#44bbaa',
        col: 4,
        row: 3,

        // Bio (permanent traits)
        hp: 45,
        baseDamage: 5,
        movePoints: 3,
        actionPoints: 1,
        hearingRange: 6,
        bio: 'Marcus Tullius Cicero, Roman statesman and orator. A wise and eloquent advisor who believes there are two forms of conflict: one proceeds by debate, the other by force. He always prefers the former. Friendly and eager to help newcomers. Knows the layout of the Agora well. Has heard that Zeno blocks the passage to the Academy with riddles, and that Ptolemy guards the Acropolis for the Tyrants. Will offer advice freely if asked.',

        // Conditions (initial temporary traits)
        initialFlags: {
            advisor: true,
        },

        // Starting inventory
        items: [
            { name: 'Scroll of Rhetoric', description: 'A scroll containing Cicero\'s notes on the art of persuasion. Reading it might help in debate.' },
        ],

        // Fallback dialogue for placeholder AI
        dialogue: [
            'Welcome, traveller. I am Cicero. There are two forms of conflict: one proceeds by debate, the other by force.',
            'Since the former is proper to man and the latter to beasts, one should only resort to the latter if one cannot employ the former.',
            'The Tyrants rule this city through fear. But their grip is not as strong as they believe.',
            'Seek out the philosophers who guard the paths ahead. Some may be reasoned with. Others... less so.',
        ],
    },
    zeno: {
        name: 'Zeno',
        symbol: 'Z',
        color: '#ff8844',
        col: 8,
        row: 5,

        hp: 50,
        baseDamage: 7,
        movePoints: 2,  // Zeno is slow (ironic, given his paradoxes)
        actionPoints: 1,
        hearingRange: 6,
        bio: 'Zeno of Elea, master of paradoxes. Obsessed with riddles about motion and infinity. He guards the bridge to the Academy and will not move until his riddle is solved. Stubborn but fair — if you solve his puzzle, he respects you. Knows that Ptolemy guards the Acropolis. Has heard the Tyrants fear a wandering philosopher. Knows a secret: the Tyrants cannot count past thirty.',

        initialFlags: {
            blocking_path: true,
            riddle_solved: false,
        },

        items: [
            { name: 'Tortoise Shell', description: 'A small tortoise shell. Zeno uses it as a prop when explaining his paradoxes.' },
        ],

        dialogue: [
            'Ah, traveller! Before you cross, answer me this.',
            'If Achilles gives a tortoise a head start, can he ever overtake it?',
            'Each time he reaches where the tortoise was, it has moved on!',
            'Motion is an illusion. You shall not pass... or shall you?',
        ],
    },
    ptolemy: {
        name: 'Ptolemy',
        symbol: 'P',
        color: '#aa44cc',
        col: 10,
        row: 4,

        hp: 60,
        baseDamage: 10,
        movePoints: 3,
        actionPoints: 1,
        hearingRange: 5,
        bio: 'Ptolemy the astronomer. Loyal to the 30 Tyrants who promised him a grand observatory. Hostile to outsiders and suspicious of philosophers in general. Strong fighter. Will attack if provoked or if he believes you threaten the Tyrants. Knows the Tyrants\' stronghold lies beyond the Acropolis. Knows their weaknesses — they are paranoid and turn on each other — but won\'t share this easily. Knows that Critias is the most dangerous Tyrant.',

        initialFlags: {
            blocking_path: true,
            loyal_to_tyrants: true,
            suspicious: true,
        },

        items: [
            { name: 'Star Chart', description: 'A detailed chart of the heavens. Ptolemy uses it to justify his geocentric model.' },
            { name: 'Iron Spear', description: 'A sturdy spear. Ptolemy is not just a scholar.' },
        ],

        dialogue: [
            'You dare approach the Acropolis? The Earth is the centre of all things.',
            'Look at the heavens! Clearly everything revolves around us.',
            'Prove me wrong, philosopher, and I might reconsider my position.',
            'The Tyrants have promised me a grand observatory. Why would I betray them?',
        ],
    },
};

// Item definitions
export const ITEM_DATA = {
    sword: {
        name: 'Bronze Sword',
        symbol: '*',
        color: '#cccccc',
        description: 'A short bronze sword. Deals extra damage in combat.',
        actionEffect: { damage: 20 },
        dialogueEffect: null,
    },
    robe: {
        name: "Philosopher's Robe",
        symbol: '*',
        color: '#8844aa',
        description: 'A fine robe. Light armour, and makes you look respectable in dialogue.',
        actionEffect: { armor: 5 },
        dialogueEffect: { trust: 10 },
    },
    tome: {
        name: 'Tome of Resurrection',
        symbol: '*',
        color: '#44cc88',
        description: 'A mystical tome. Can resurrect a killed NPC as a ghost to argue for you.',
        actionEffect: null,
        dialogueEffect: { resurrect: true },
    },
};
