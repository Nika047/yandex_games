// Прогресс в localStorage: последний выбранный уровень и пройденные уровни.
// Хранилище может быть недоступно (приватное окно, запрет) - тогда прогресс просто не сохраняется.
const LAST_KEY = 'marble-sort-level';
const DONE_KEY = 'marble-sort-done';
const TUTORIAL_KEY = 'marble-sort-tutorial';

export function loadLast(levelCount: number): number {
    try {
        const saved = Number(localStorage.getItem(LAST_KEY));
        return Number.isInteger(saved) && saved >= 0 && saved < levelCount ? saved : 0;
    } catch {
        return 0;
    }
}

export function saveLast(level: number): void {
    try {
        localStorage.setItem(LAST_KEY, String(level));
    } catch {
        // не сохраняем
    }
}

export function loadDone(): Set<number> {
    try {
        const saved: unknown = JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]');
        return new Set(Array.isArray(saved) ? saved.filter((v): v is number => Number.isInteger(v)) : []);
    } catch {
        return new Set();
    }
}

export function markDone(level: number): void {
    try {
        const done = loadDone();
        done.add(level);
        localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
    } catch {
        // не сохраняем
    }
}

export function isTutorialDone(): boolean {
    try {
        return localStorage.getItem(TUTORIAL_KEY) === '1';
    } catch {
        return false;
    }
}

export function markTutorialDone(): void {
    try {
        localStorage.setItem(TUTORIAL_KEY, '1');
    } catch {
        // не сохраняем
    }
}
