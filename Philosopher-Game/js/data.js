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
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart: { col: 1, row: 5 },
        npcs: ['cicero'],
        items: [{ id: 'sword', col: 8, row: 3 }],
        doors: [
            { id: 'agora_east', col: 15, row: 10, locked: true, target: { zone: 1, col: 1, row: 5 }, keyId: 'agora_key', description: 'A heavy wooden door set into the city wall.' },
        ],
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
            [0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart: { col: 1, row: 5 },
        npcs: ['plato', 'aristotle', 'zeno'],
        items: [{ id: 'robe', col: 10, row: 7 }],
        doors: [
            { id: 'academy_west', col: 0, row: 5, locked: false, target: { zone: 0, col: 14, row: 10 }, keyId: null, description: 'A weathered stone archway, worn smooth by years of use.' },
            { id: 'academy_east', col: 15, row: 10, locked: true, target: { zone: 2, col: 1, row: 5 }, keyId: 'academy_key', description: 'A heavy iron door. The metal is cold to the touch.' },
        ],
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
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
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
        doors: [
            { id: 'acropolis_west', col: 0, row: 5, locked: false, target: { zone: 1, col: 14, row: 10 }, keyId: null, description: 'An ancient stone gateway, its lintel carved with old inscriptions.' },
        ],
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
        appearance: 'A dignified Roman orator.',
        bio: 'Marcus Tullius Cicero, Roman statesman and orator. A wise and eloquent advisor who believes there are two forms of conflict: one proceeds by debate, the other by force. He always prefers the former. Friendly and eager to help newcomers. Knows the layout of the Agora well. Has heard that Zeno blocks the passage to the Academy with riddles, and that Ptolemy guards the Acropolis for the Tyrants. Will offer advice freely if asked.',

        // Conditions (initial temporary traits)
        initialFlags: {
            advisor: true,
        },

        // Starting equipment
        initialEquipment: {
            body: { name: 'Senatorial Toga', visibleName: 'Senatorial Toga', description: 'A pristine white toga marking its wearer as a senator of Rome.', equipSlot: 'body' },
        },

        // Starting inventory
        items: [
            { name: 'Scroll of Rhetoric', description: 'A scroll containing Cicero\'s notes on the art of persuasion. Reading it might help in debate.' },
            { name: 'Agora Gate Key', description: 'The key to the eastern gate of the Agora.', unlocks: 'agora_east' },
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
        appearance: 'A wiry Greek with an intense, unsettling gaze.',
        bio: 'Zeno of Elea, master of paradoxes. Obsessed with riddles about motion and infinity. He guards the bridge to the Academy and will not move until his riddle is solved. Stubborn but fair — if you solve his puzzle, he respects you. Knows that Ptolemy guards the Acropolis. Has heard the Tyrants fear a wandering philosopher. Knows a secret: the Tyrants cannot count past thirty.',

        initialFlags: {
            blocking_path: true,
            riddle_solved: false,
        },

        initialEquipment: {
            body: { name: "Philosopher's Himation", visibleName: "Worn himation", description: 'A coarse woollen cloak, worn with the indifference of a man who thinks clothing is an illusion.', equipSlot: 'body' },
            feet: { name: 'Old Sandals', visibleName: 'Old sandals', description: 'Battered leather sandals, much walked-in.', equipSlot: 'feet' },
        },

        items: [
            { name: 'Tortoise Shell', description: 'A small tortoise shell. Zeno uses it as a prop when explaining his paradoxes.' },
            { id: 'academy_key', name: 'Academy Key', description: 'A heavy iron key. It opens the passage from the Academy to the Acropolis.', unlocks: 'academy_east' },
        ],

        dialogue: [
            'Ah, traveller! Before you cross, answer me this.',
            'If Achilles gives a tortoise a head start, can he ever overtake it?',
            'Each time he reaches where the tortoise was, it has moved on!',
            'Motion is an illusion. You shall not pass... or shall you?',
        ],
    },
    plato: {
        name: 'Plato',
        symbol: 'Π',
        color: '#5599ff',
        col: 4,
        row: 3,

        hp: 55,
        baseDamage: 4,
        movePoints: 3,
        actionPoints: 1,
        appearance: 'A broad-shouldered man with a calm, searching gaze.',
        bio: 'Plato of Athens, founder of this Academy. Believes the visible world is merely a shadow of a higher realm of perfect, eternal Forms — the Form of Beauty, of Justice, of the Good. The physical world is real only insofar as it participates in these Forms. Has a deep but complicated relationship with Aristotle, his most gifted student, who rejects the Theory of Forms and insists universals are merely patterns abstracted from things. Plato finds Aristotle\'s view clever but ultimately blind to the deeper truth. Finds Zeno\'s paradoxes interesting but considers them a distraction — motion is less real than the unchanging Forms anyway. Was once involved in a disastrous attempt to install a philosopher-king in Syracuse; does not speak of it freely. Is troubled by the Tyrants but believes the answer is philosophical education, not violence. Happy to debate with Aristotle and Zeno at length; they have been arguing for years.',

        initialFlags: {
            founding_academic: true,
        },

        initialEquipment: {
            body: { name: 'Academic Himation', visibleName: 'Fine himation', description: 'A well-made woollen cloak befitting the head of a philosophical school.', equipSlot: 'body' },
        },

        items: [
            { name: 'Writing Tablet', description: 'A wax writing tablet covered in dense philosophical notes. Several passages are crossed out and rewritten.' },
        ],

        dialogue: [
            'The things you see around you — they are shadows on the wall of a cave.',
            'Aristotle insists the Forms do not exist apart from things. He will learn.',
            'What is justice? Not the giving back of what one has borrowed, surely.',
            'The unexamined life is not worth living. Neither, I suspect, is this conversation.',
        ],
    },
    aristotle: {
        name: 'Aristotle',
        symbol: 'A',
        color: '#ffcc44',
        col: 11,
        row: 7,

        hp: 55,
        baseDamage: 6,
        movePoints: 4,
        actionPoints: 1,
        appearance: 'A sharp-eyed man who moves with purposeful energy.',
        bio: 'Aristotle of Stagira, student of Plato and increasingly convinced his teacher is wrong. The Forms do not exist in some separate realm — universals are real patterns that exist within particular things, abstracted by the mind. You learn about justice by studying just acts, not by contemplating a disembodied Form of Justice. Has been cataloguing the animals, plants, and political constitutions of Greece and considers empirical observation the foundation of all knowledge. Respects Plato enormously as a person and thinker, even while disagreeing with him on nearly everything of substance. Finds Zeno\'s paradoxes a genuine puzzle but believes they are dissolved by proper analysis of continuous quantity and potential versus actual infinity. Is not especially concerned with the Tyrants as a political matter — believes good government is about the right constitution for a given people, not about who holds power at any moment. Will argue a point at length and with considerable pleasure.',

        initialFlags: {
            studying_nature: true,
        },

        initialEquipment: {
            body: { name: "Traveller's Cloak", visibleName: "Traveller's cloak", description: 'A practical cloak, slightly worn at the hem. Aristotle has walked a great deal.', equipSlot: 'body' },
        },

        items: [
            { name: 'Scroll of Natural Philosophy', description: 'A scroll dense with observations: the gait of crabs, the flight of swallows, the growth of onions. Aristotle\'s handwriting is very small.' },
        ],

        dialogue: [
            'Plato says the horse participates in the Form of Horse. I say: look at the horse.',
            'The whole is greater than the sum of its parts. Usually.',
            'Zeno\'s arrow never moves, he says. Yet it arrives. That should tell us something.',
            'Man is by nature a political animal. Even in a city run by thirty fools.',
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
        appearance: 'A heavyset, broad-shouldered man with a calculating stare.',
        bio: 'Ptolemy the astronomer. Loyal to the 30 Tyrants who promised him a grand observatory. Hostile to outsiders and suspicious of philosophers in general. Strong fighter. Will attack if provoked or if he believes you threaten the Tyrants. Knows the Tyrants\' stronghold lies beyond the Acropolis. Knows their weaknesses — they are paranoid and turn on each other — but won\'t share this easily. Knows that Critias is the most dangerous Tyrant.',

        initialFlags: {
            blocking_path: true,
            loyal_to_tyrants: true,
            suspicious: true,
        },

        initialEquipment: {
            body:  { name: 'Legionary Breastplate', visibleName: 'Legionary breastplate', description: 'A battered iron breastplate. Dented but functional.', equipSlot: 'body', actionEffect: { armor: 8 } },
            hands: { name: 'Iron Spear', visibleName: 'Iron spear', description: 'A sturdy iron-tipped spear. Ptolemy is not merely a scholar.', equipSlot: 'hands', actionEffect: { damage: 30 } },
        },

        items: [
            { name: 'Star Chart', description: 'A detailed chart of the heavens. Ptolemy uses it to justify his geocentric model.' },
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
// visibleName / visibleDescription: what observers see from the outside.
// If omitted, falls back to name / description.
export const ITEM_DATA = {
    sword: {
        name: 'Bronze Sword',
        visibleName: 'Bronze Sword',
        symbol: '*',
        color: '#cccccc',
        description: 'A short bronze sword. +20 damage in combat.',
        visibleDescription: 'A short bronze sword.',
        equipSlot: 'hands',
        actionEffect: { damage: 20 },
        dialogueEffect: null,
    },
    robe: {
        name: "Philosopher's Robe",
        visibleName: 'Fine Robe',
        symbol: '*',
        color: '#8844aa',
        description: "A philosopher's robe. +5 armor, +10 trust in dialogue.",
        visibleDescription: 'A fine robe that marks its wearer as a man of learning.',
        equipSlot: 'body',
        actionEffect: { armor: 5 },
        dialogueEffect: { trust: 10 },
    },
    agora_key: {
        name: 'Agora Gate Key',
        visibleName: 'Iron Key',
        symbol: '✦',
        color: '#ddaa44',
        description: 'The key to the eastern gate of the Agora.',
        visibleDescription: 'A heavy iron key.',
        equipSlot: null,
        actionEffect: null,
        dialogueEffect: null,
        unlocks: 'agora_east',
    },
    academy_key: {
        name: 'Academy Key',
        visibleName: 'Iron Key',
        symbol: '✦',
        color: '#ddaa44',
        description: 'A heavy iron key. It opens the passage from the Academy to the Acropolis.',
        visibleDescription: 'A heavy iron key.',
        equipSlot: null,
        actionEffect: null,
        dialogueEffect: null,
        unlocks: 'academy_east',
    },
    tome: {
        name: 'Tome of Resurrection',
        visibleName: 'Worn Tome',
        symbol: '*',
        color: '#44cc88',
        description: 'A mystical tome. Can resurrect a killed NPC as a ghost to argue for you.',
        visibleDescription: 'A weathered tome bound in dark leather.',
        equipSlot: null,
        actionEffect: null,
        dialogueEffect: { resurrect: true },
    },
};
