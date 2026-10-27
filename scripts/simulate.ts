// Прогон уровней ботами: жадный должен проходить всё на очереди игрока, случайный и «всегда первая очередь»
// - проигрывать чаще на сложных уровнях.
// Запуск: npm run simulate
import { createGame, DEFAULT_DIFFICULTY, Game, greedyPick, mulberry32, playOut } from '../src/logic.ts';
import { COLOR_KEYS, LEVELS } from '../src/levels.ts';

const RUNS = 100;

const nonEmpty = (game: Game) => game.queues.map((q, i) => (q.length > 0 ? i : -1)).filter(i => i >= 0);
const randomPick = (rng: () => number) => (game: Game) => {
    const open = nonEmpty(game);
    return open.length > 0 ? open[Math.floor(rng() * open.length)] : -1;
};
const firstPick = (game: Game) => nonEmpty(game)[0] ?? -1;

const percent = (wins: number) => `${String(Math.round((wins * 100) / RUNS)).padStart(3)}%`;

console.log('N  уровень          клеток коробок очередей лента | сырая: жадный | очередь игрока: жадный первая случайный | создание, мс (макс)');
LEVELS.forEach((level, index) => {
    const options = { ...DEFAULT_DIFFICULTY, ...level.difficulty };
    let rawGreedy = 0;
    let greedy = 0;
    let first = 0;
    let random = 0;
    let slowest = 0;
    for (let seed = 1; seed <= RUNS; seed++) {
        if (playOut(new Game(level.rows, COLOR_KEYS, seed, options), greedyPick) === 'won') {
            rawGreedy++;
        }
        const started = performance.now();
        const game = createGame(level.rows, COLOR_KEYS, seed, options);
        slowest = Math.max(slowest, performance.now() - started);
        if (playOut(game, greedyPick) === 'won') {
            greedy++;
        }
        if (playOut(createGame(level.rows, COLOR_KEYS, seed, options), firstPick) === 'won') {
            first++;
        }
        if (playOut(createGame(level.rows, COLOR_KEYS, seed, options), randomPick(mulberry32(seed * 7 + 1))) === 'won') {
            random++;
        }
    }
    const probe = new Game(level.rows, COLOR_KEYS, 1, options);
    console.log(
        `${String(index + 1).padStart(2)} ${level.name.padEnd(16)} ${String(probe.board.total).padStart(5)} ${String(probe.queues.flat().length).padStart(6)} ` +
        `${String(options.queues).padStart(7)} ${String(options.belt).padStart(5)} | ` +
        `${percent(rawGreedy).padStart(13)} | ${percent(greedy).padStart(22)} ${percent(first).padStart(6)} ${percent(random).padStart(8)} | ${String(Math.round(slowest)).padStart(6)}`
    );
});
