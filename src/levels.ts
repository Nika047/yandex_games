import type { Difficulty } from './logic.ts';
import {
    aquarium, bouquet, butterfly, cat, city, forest, house, rainbow, sea, space, sunset, watermelon
} from './pictures.ts';

// Буква в карте уровня - цвет клетки (порядок букв = порядок цветов в PALETTE), точка - пустое место.
export const COLOR_KEYS = 'rpygbovwnksdltmac';

export const PALETTE: number[] = [
    0xe74c3c, // r - красный
    0xff8fb1, // p - розовый
    0xf1c40f, // y - жёлтый
    0x2ecc71, // g - зелёный
    0x3498db, // b - синий
    0xe67e22, // o - оранжевый
    0x9b59b6, // v - фиолетовый
    0xecf0f1, // w - белый
    0x8d5524, // n - коричневый
    0x2c3e50, // k - тёмно-синий
    0x9bd7ff, // s - небесный
    0x1e8449, // d - тёмно-зелёный
    0xb8e04a, // l - салатовый
    0x1abc9c, // t - бирюзовый
    0xd81b60, // m - малиновый
    0x95a5a6, // a - серый
    0xf3d9a4  // c - песочный
];

export interface LevelDef {
    name: string;
    rows: string[];
    // что отличается от DEFAULT_DIFFICULTY
    difficulty?: Partial<Difficulty>;
}

export const LEVELS: LevelDef[] = [
    {
        name: 'Ёлка',
        rows: [
            '....y....',
            '...ggg...',
            '..ggggg..',
            '...ggg...',
            '..ggggg..',
            '.ggggggg.',
            '....n....',
            '....n....'
        ],
        difficulty: { minBox: 2, maxBox: 5 }
    },
    {
        name: 'Гриб',
        rows: [
            '...rrrr...',
            '.rrwrrwrr.',
            'rrrrrrrrrr',
            'rwrrrrrrwr',
            'rrrrrwrrrr',
            '...wwww...',
            '...wnnw...',
            '...wwww...'
        ],
        difficulty: { minBox: 2, maxBox: 5 }
    },
    {
        name: 'Цветок',
        rows: [
            '..pp.pp..',
            '.pppppppp',
            'pppyyyppp',
            'pppyyyppp',
            '.pppyppp.',
            '..pppppp.',
            '....g....',
            '..gggg...',
            '....g....'
        ],
        difficulty: { minBox: 2, maxBox: 5 }
    },
    {
        name: 'Смайлик',
        rows: [
            '...yyyyy...',
            '.yyyyyyyyy.',
            '.yyyyyyyyy.',
            'yyynyyynyyy',
            'yyynyyynyyy',
            'yyyyyyyyyyy',
            'yryyyyyyyry',
            'yyrrrrrrryy',
            '.yyyyyyyyy.',
            '.yyyyyyyyy.',
            '...yyyyy...'
        ],
        difficulty: { minBox: 2, maxBox: 5 }
    },
    {
        name: 'Бабочка',
        rows: butterfly(),
        difficulty: { belt: 8, chunk: 3 }
    },
    {
        name: 'Город ночью',
        rows: city(),
        difficulty: { belt: 7, chunk: 8 }
    },
    {
        name: 'Кот',
        rows: cat(),
        difficulty: { belt: 7, chunk: 3 }
    },
    {
        name: 'Море',
        rows: sea(),
        difficulty: { belt: 7, chunk: 3 }
    },
    {
        name: 'Арбуз',
        rows: watermelon(),
        difficulty: { belt: 7, chunk: 8 }
    },
    {
        name: 'Космос',
        rows: space(),
        difficulty: { belt: 8, chunk: 3 }
    },
    {
        name: 'Аквариум',
        rows: aquarium(),
        difficulty: { belt: 7, chunk: 3 }
    },
    {
        name: 'Лес ночью',
        rows: forest(),
        difficulty: { belt: 7, chunk: 8 }
    },
    {
        name: 'Радуга',
        rows: rainbow(),
        difficulty: { belt: 7, chunk: 8 }
    },
    {
        name: 'Букет',
        rows: bouquet(),
        difficulty: { belt: 6, chunk: 8 }
    },
    {
        name: 'Домик',
        rows: house(),
        difficulty: { belt: 5, chunk: 3 }
    },
    {
        name: 'Закат',
        rows: sunset(),
        difficulty: { belt: 5, chunk: 3 }
    }
];
