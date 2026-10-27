// Чистая логика игры: без Phaser и DOM, чтобы её можно было гонять скриптом (scripts/simulate.ts).
//
// Правила (как в Pixel Flow): под картинкой лежит лента-прямоугольник, по которой по кругу едут коробки
// (вагончики). Внизу стоят очереди коробок. Нажатие на очередь ставит её первую коробку на свободное место
// ленты. Когда коробка проезжает под столбцом картинки, она стреляет вверх: закрашивается нижняя ещё
// не закрашенная клетка столбца, если её цвет совпал с цветом коробки. Опустевшая коробка уходит с ленты.
// Проигрыш: лента занята, и ни одна коробка на ней не может выстрелить.

// Сложность уровня:
// queues - число очередей, belt - сколько коробок помещается на ленте, minBox и maxBox - сколько шариков
// в коробке (коробка может быть меньше, если цвета нужно меньше), depth - сколько коробок в очереди видно,
// chunk - размер куска очереди, внутри которого коробки перемешаны (0 - очередь строго в порядке решения;
// чем больше кусок, тем чаще нужный цвет лежит глубоко и тем легче забить ленту)
export interface Difficulty {
    queues: number;
    belt: number;
    minBox: number;
    maxBox: number;
    depth: number;
    chunk: number;
}

export const DEFAULT_DIFFICULTY: Difficulty = { queues: 4, belt: 5, minBox: 4, maxBox: 8, depth: 3, chunk: 6 };

// Высота рамки ленты в позициях: верхняя сторона над каждым столбцом картинки, остальные стороны замыкают круг.
export const BELT_ROWS = 4;

// сколько раз пробуем другую очередь, если жадный бот не проходит уровень (см. createGame)
const SOLVABLE_ATTEMPTS = 200;

export type Status = 'playing' | 'won' | 'lost';

export interface Box {
    id: number;
    color: number;
    // сколько шариков осталось
    ammo: number;
    // сколько было в начале
    size: number;
}

export interface Shot {
    box: Box;
    carriage: number;
    column: number;
    cell: number;
    // сколько шариков осталось в коробке после выстрела
    left: number;
}

export interface DeployResult {
    moved: boolean;
    carriage: number;
}

export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class Board {
    readonly width: number;
    readonly height: number;
    // цвет клетки: индекс палитры, -1 - клетки нет
    readonly colors: number[];
    readonly filled: boolean[];
    // клетки каждого столбца снизу вверх, без пустых мест
    private readonly columns: number[][];
    private readonly progress: number[];
    // сколько столбцов ждут каждый цвет (нижняя незакрашенная клетка столбца этого цвета)
    private readonly waiting: number[];

    constructor(rows: string[], colorKeys: string) {
        this.height = rows.length;
        this.width = rows[0].length;
        if (rows.some(r => r.length !== this.width)) {
            throw new Error('Строки уровня разной длины');
        }
        this.colors = rows.flatMap(r => [...r].map(ch => (ch === '.' ? -1 : colorKeys.indexOf(ch))));
        if (this.colors.some((c, i) => c < 0 && rows[Math.floor(i / this.width)][i % this.width] !== '.')) {
            throw new Error('В уровне неизвестный цвет');
        }
        this.filled = this.colors.map(() => false);
        this.columns = Array.from({ length: this.width }, (_, x) => (
            Array.from({ length: this.height }, (_, k) => (this.height - 1 - k) * this.width + x).filter(i => this.colors[i] >= 0)
        ));
        this.progress = this.columns.map(() => 0);
        this.waiting = colorKeys.split('').map(() => 0);
        this.columns.forEach((_, x) => this.countTarget(x, 1));
    }

    get total(): number {
        return this.colors.filter(c => c >= 0).length;
    }

    get filledCount(): number {
        return this.filled.filter(f => f).length;
    }

    get isComplete(): boolean {
        return this.filledCount === this.total;
    }

    // цвета клеток каждого столбца снизу вверх, без пустых мест
    sequences(): number[][] {
        return this.columns.map(column => column.map(i => this.colors[i]));
    }

    // цвет нижней незакрашенной клетки столбца, -1 если столбец готов
    targetColor(column: number): number {
        const cell = this.columns[column][this.progress[column]];
        return cell === undefined ? -1 : this.colors[cell];
    }

    // нужен ли этот цвет хоть одному столбцу прямо сейчас
    isWanted(color: number): boolean {
        return this.waiting[color] > 0;
    }

    // скольким столбцам этот цвет нужен прямо сейчас
    wantedCount(color: number): number {
        return this.waiting[color];
    }

    // клетка, в которую выстрелит коробка, или -1
    targetCell(column: number): number {
        return this.columns[column][this.progress[column]] ?? -1;
    }

    // закрашивает нижнюю клетку столбца и возвращает её номер
    fill(column: number): number {
        this.countTarget(column, -1);
        const cell = this.columns[column][this.progress[column]];
        this.filled[cell] = true;
        this.progress[column]++;
        this.countTarget(column, 1);
        return cell;
    }

    private countTarget(column: number, delta: number): void {
        const color = this.targetColor(column);
        if (color >= 0) {
            this.waiting[color] += delta;
        }
    }
}

// Очереди коробок. Сначала строится порядок решения: случайный столбец называет нужный цвет, коробка этого
// цвета «стреляет» по всем столбцам, которым он нужен, пока хватает шариков. Потом порядок перемешивается
// внутри кусков по chunk коробок и раздаётся по очередям по кругу.
export function buildQueues(board: Board, rng: () => number, d: Difficulty): Omit<Box, 'id'>[][] {
    const sequences = board.sequences();
    const progress = sequences.map(() => 0);
    const wanting = (color: number) => sequences.map((s, x) => (s[progress[x]] === color ? x : -1)).filter(x => x >= 0);
    const boxes: Omit<Box, 'id'>[] = [];
    let remaining = board.total;
    while (remaining > 0) {
        const open = sequences.map((s, x) => (progress[x] < s.length ? x : -1)).filter(x => x >= 0);
        const first = open[Math.floor(rng() * open.length)];
        const boxColor = sequences[first][progress[first]];
        const size = d.minBox + Math.floor(rng() * (d.maxBox - d.minBox + 1));
        let ammo = 0;
        while (ammo < size) {
            const columns = wanting(boxColor);
            if (columns.length === 0) {
                break;
            }
            progress[columns[Math.floor(rng() * columns.length)]]++;
            ammo++;
            remaining--;
        }
        boxes.push({ color: boxColor, ammo, size: ammo });
    }
    const chunk = d.chunk > 0 ? d.chunk : boxes.length;
    for (let start = 0; start < boxes.length; start += chunk) {
        const end = Math.min(start + chunk, boxes.length);
        for (let i = end - 1; i > start; i--) {
            const j = start + Math.floor(rng() * (i - start + 1));
            [boxes[i], boxes[j]] = [boxes[j], boxes[i]];
        }
    }
    const queues: Omit<Box, 'id'>[][] = Array.from({ length: d.queues }, () => []);
    boxes.forEach((box, i) => queues[i % d.queues].push(box));
    return queues;
}

export class Game {
    readonly board: Board;
    readonly options: Difficulty;
    readonly queues: Box[][];
    // места ленты: коробка или null; все едут вместе, на одинаковом расстоянии друг от друга
    readonly carriages: (Box | null)[];
    // сколько позиций в круге ленты
    readonly length: number;
    phase = 0;
    private readonly base: number[];

    constructor(rows: string[], colorKeys: string, seed: number, options: Difficulty = DEFAULT_DIFFICULTY) {
        this.options = options;
        this.board = new Board(rows, colorKeys);
        let nextId = 1;
        this.queues = buildQueues(this.board, mulberry32(seed), options).map(q => q.map(b => ({ ...b, id: nextId++ })));
        this.carriages = Array.from({ length: options.belt }, () => null);
        this.length = 2 * this.board.width + 2 * BELT_ROWS - 4;
        this.base = this.carriages.map((_, j) => Math.floor((j * this.length) / options.belt));
    }

    // позиция места ленты в круге: 0..width-1 - верхняя сторона над столбцами слева направо,
    // дальше вниз по правой стороне, налево по нижней и вверх по левой
    position(carriage: number): number {
        return (this.base[carriage] + this.phase) % this.length;
    }

    get status(): Status {
        if (this.board.isComplete) {
            return 'won';
        }
        if (this.canProgress()) {
            return 'playing';
        }
        return this.freeCarriage() >= 0 && this.queues.some(q => q.length > 0) ? 'playing' : 'lost';
    }

    // может ли хоть одна коробка на ленте когда-нибудь выстрелить без участия игрока
    canProgress(): boolean {
        return this.carriages.some(box => box !== null && this.board.isWanted(box.color));
    }

    // свободное место ленты, которое раньше всех доедет до начала верхней стороны, или -1
    freeCarriage(): number {
        let best = -1;
        let bestDistance = Infinity;
        this.carriages.forEach((box, j) => {
            const distance = (this.length - this.position(j)) % this.length;
            if (box === null && distance < bestDistance) {
                best = j;
                bestDistance = distance;
            }
        });
        return best;
    }

    // Первая коробка очереди встаёт на свободное место ленты.
    deploy(queue: number): DeployResult {
        const box = this.queues[queue]?.[0];
        const carriage = this.freeCarriage();
        if (box === undefined || carriage < 0) {
            return { moved: false, carriage: -1 };
        }
        this.queues[queue].shift();
        this.carriages[carriage] = box;
        return { moved: true, carriage };
    }

    // Один шаг ленты: коробки над столбцами стреляют, потом лента едет на одну позицию.
    tick(): Shot[] {
        const shots: Shot[] = [];
        this.carriages.forEach((box, carriage) => {
            const column = this.position(carriage);
            if (box === null || column >= this.board.width || this.board.targetColor(column) !== box.color) {
                return;
            }
            const cell = this.board.fill(column);
            box.ammo--;
            shots.push({ box, carriage, column, cell, left: box.ammo });
            if (box.ammo === 0) {
                this.carriages[carriage] = null;
            }
        });
        this.phase = (this.phase + 1) % this.length;
        return shots;
    }

    // Крутит ленту, пока коробки на ней могут стрелять.
    settle(): void {
        let guard = (this.board.total + 1) * (this.length + 1);
        while (this.canProgress() && guard-- > 0) {
            this.tick();
        }
    }
}

// Жадная стратегия: ставить на ленту коробку, цвет которой нужен прямо сейчас, и лучше ту, что опустеет
// сразу (остаток надолго занимает место на ленте). Если нужной нет, ставить самую маленькую коробку.
export function greedyPick(game: Game): number {
    let best = -1;
    let bestLeft = Infinity;
    let smallest = -1;
    let smallestAmmo = Infinity;
    game.queues.forEach((queue, i) => {
        if (queue.length === 0) {
            return;
        }
        const box = queue[0];
        const wanted = game.board.wantedCount(box.color);
        if (wanted > 0 && Math.max(0, box.ammo - wanted) < bestLeft) {
            best = i;
            bestLeft = Math.max(0, box.ammo - wanted);
        }
        if (box.ammo < smallestAmmo) {
            smallest = i;
            smallestAmmo = box.ammo;
        }
    });
    return best >= 0 ? best : smallest;
}

export function playOut(game: Game, pick: (game: Game) => number): Status {
    let guard = 10000;
    while (guard-- > 0) {
        game.settle();
        if (game.status !== 'playing') {
            break;
        }
        const queue = pick(game);
        if (queue < 0 || !game.deploy(queue).moved) {
            break;
        }
    }
    return game.status;
}

// Игра для игрока: берётся первая очередь, которую проходит жадная стратегия (она видит только первые коробки),
// поэтому уровень всегда проходим простой разумной игрой, а ошибки (занять ленту ненужными коробками) наказываются.
export function createGame(rows: string[], colorKeys: string, seed: number, options: Difficulty = DEFAULT_DIFFICULTY): Game {
    for (let attempt = 0; attempt < SOLVABLE_ATTEMPTS; attempt++) {
        const attemptSeed = seed + attempt * 7919;
        if (playOut(new Game(rows, colorKeys, attemptSeed, options), greedyPick) === 'won') {
            return new Game(rows, colorKeys, attemptSeed, options);
        }
    }
    return new Game(rows, colorKeys, seed, options);
}
