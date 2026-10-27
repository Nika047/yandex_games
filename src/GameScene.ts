import Phaser from 'phaser';
import { BELT_ROWS, DEFAULT_DIFFICULTY, createGame, type Box, type Game, type Shot } from './logic.ts';
import { COLOR_KEYS, LEVELS, PALETTE } from './levels.ts';
import { isTutorialDone, markDone, markTutorialDone, saveLast } from './progress.ts';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, drawBackground, drawPanel, makeButton } from './ui.ts';

// сколько миллисекунд лента едет на одну позицию
const TICK_MS = 70;

const AREA_TOP = 112;
const QUEUE_TOP = 672;
const QUEUE_PANEL_H = 236;
const PANEL_X = 15;
const PANEL_W = GAME_WIDTH - 30;
const QUEUE_BOX = 62;
const QUEUE_STEP = 50;
const HEAD_OFFSET = 74;
const SELECT_COLOR = 0xffd54a;

// Обучение на первом уровне: подсказка сменяется после каждой отправленной коробки
const HINT_Y = 648;
const TUTORIAL_HINTS = ['Нажмите на очередь', 'Коробка стреляет в клетки с кольцом', 'Ненужный цвет займёт место на ленте'];
const TUTORIAL_HINT_DESKTOP = 'Нажмите на очередь или Enter';

type Pos = { x: number; y: number };

// коробка в очереди или на ленте: контейнер с цветом и числом шариков
interface BoxView {
    box: Phaser.GameObjects.Container;
    gfx: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    color: number;
    size: number;
}

export class GameScene extends Phaser.Scene {
    private levelIndex = 0;
    private game_!: Game;
    private cellViews: Phaser.GameObjects.Arc[] = [];
    private cellGloss: Phaser.GameObjects.Arc[] = [];
    private cellPos: Pos[] = [];
    private cellR = 10;
    private targetCells = new Set<number>();
    private path: Pos[] = [];
    private carSize = 34;
    private beltTop = 0;
    private holders: Phaser.GameObjects.Graphics[] = [];
    // метки на ленте: едут вместе с ней и показывают направление
    private treads: { dot: Phaser.GameObjects.Arc; base: number }[] = [];
    private carriageViews: (BoxView | null)[] = [];
    private carriageLayer!: Phaser.GameObjects.Container[];
    private queueViews = new Map<number, BoxView>();
    private moreTexts: Phaser.GameObjects.Text[] = [];
    private selected = 0;
    private tutorialStep = -1;
    private hint: Phaser.GameObjects.Container | null = null;
    private hintArrow: Phaser.GameObjects.Text | null = null;
    private counter!: Phaser.GameObjects.Text;
    private acc = 0;
    private ending = false;
    private overlayAction: (() => void) | null = null;

    constructor() {
        super('GameScene');
    }

    init(data: { level?: number }): void {
        this.levelIndex = data.level ?? 0;
    }

    create(): void {
        this.setupKeyboard();
        this.startLevel();
    }

    // Управление с клавиатуры: стрелки и WASD выбирают очередь, Enter отправляет её первую коробку на ленту,
    // Esc открывает выбор уровней. Когда открыто окно победы или поражения, Enter нажимает его главную кнопку.
    private setupKeyboard(): void {
        const keyboard = this.input.keyboard;
        if (!keyboard) {
            return;
        }
        keyboard.addCapture('UP,DOWN,LEFT,RIGHT,ENTER');
        const onKeyDown = (event: KeyboardEvent) => {
            const enter = event.code === 'Enter' || event.code === 'NumpadEnter';
            if (event.code === 'Escape') {
                this.openMenu();
                return;
            }
            // удержание стрелки листает очереди, а удержание Enter не должно отправлять коробки пачкой
            if (enter && event.repeat) {
                return;
            }
            if (this.overlayAction) {
                if (enter) {
                    this.overlayAction();
                }
                return;
            }
            switch (event.code) {
                case 'ArrowLeft':
                case 'ArrowUp':
                case 'KeyA':
                case 'KeyW':
                    this.moveSelection(-1);
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                case 'KeyD':
                case 'KeyS':
                    this.moveSelection(1);
                    break;
                case 'Enter':
                case 'NumpadEnter':
                    this.deploy(this.selected);
                    break;
                default:
                    break;
            }
        };
        keyboard.on('keydown', onKeyDown);
        // сцена запускается заново при каждом входе, старый обработчик иначе остаётся и срабатывает дважды
        this.events.once('shutdown', () => keyboard.off('keydown', onKeyDown));
    }

    private openMenu(): void {
        this.scene.start('MenuScene', { selected: this.levelIndex });
    }

    // следующая непустая очередь в нужную сторону
    private moveSelection(step: number): void {
        const count = this.game_.queues.length;
        for (let n = 1; n <= count; n++) {
            const next = (this.selected + step * n + count * n) % count;
            if (this.game_.queues[next].length > 0) {
                this.selected = next;
                break;
            }
        }
        this.refreshSelection();
    }

    private startLevel(): void {
        this.tweens.killAll();
        this.time.removeAllEvents();
        this.children.removeAll(true);
        this.cellViews = [];
        this.cellGloss = [];
        this.cellPos = [];
        this.targetCells = new Set();
        this.holders = [];
        this.hint = null;
        this.hintArrow = null;
        this.treads = [];
        this.carriageViews = [];
        this.queueViews.clear();
        this.moreTexts = [];
        this.overlayAction = null;
        this.ending = false;
        this.acc = 0;
        this.selected = 0;
        saveLast(this.levelIndex);

        const level = LEVELS[this.levelIndex];
        const options = { ...DEFAULT_DIFFICULTY, ...level.difficulty };
        this.game_ = createGame(level.rows, COLOR_KEYS, Date.now() & 0xffffff, options);
        const board = this.game_.board;

        drawBackground(this);

        // шапка: название по центру, кнопки по краям
        this.add.text(GAME_WIDTH / 2, 26, `УРОВЕНЬ ${this.levelIndex + 1}`, {
            fontFamily: FONT, fontSize: '14px', color: COLORS.muted, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(GAME_WIDTH / 2, 56, level.name, {
            fontFamily: FONT, fontSize: '28px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.counter = this.add.text(GAME_WIDTH / 2, 92, '', {
            fontFamily: FONT, fontSize: '17px', color: COLORS.muted
        }).setOrigin(0.5);
        makeButton(this, 70, 44, 108, 40, 'Уровни', () => this.openMenu(), { fontSize: '18px' });
        makeButton(this, GAME_WIDTH - 70, 44, 108, 40, 'Заново', () => this.startLevel(), { fontSize: '18px' });

        // картинка и лента под ней по центру свободной области
        const step = Math.min(480 / board.width, 380 / board.height, 34);
        this.carSize = Math.max(30, Math.min(40, step * 1.7));
        const gap = this.carSize / 2 + 14;
        const beltHeight = (BELT_ROWS - 1) * step;
        const groupHeight = board.height * step + gap + beltHeight + this.carSize / 2 + 8;
        const areaHeight = QUEUE_TOP - 6 - AREA_TOP;
        const top = AREA_TOP + Math.max(0, (areaHeight - groupHeight) / 2);
        const left = (GAME_WIDTH - step * board.width) / 2;
        this.cellR = step * 0.4;
        board.colors.forEach((color, i) => {
            const x = left + (i % board.width) * step + step / 2;
            const y = top + Math.floor(i / board.width) * step + step / 2;
            this.cellPos.push({ x, y });
            if (color < 0) {
                this.cellViews.push(undefined as unknown as Phaser.GameObjects.Arc);
                this.cellGloss.push(undefined as unknown as Phaser.GameObjects.Arc);
                return;
            }
            this.cellViews.push(this.add.circle(x, y, this.cellR, PALETTE[color], 0.38));
            this.cellGloss.push(this.add.circle(x - this.cellR * 0.32, y - this.cellR * 0.32, this.cellR * 0.28, 0xffffff, 0));
        });
        this.beltTop = top + board.height * step + gap;
        this.buildBelt(left + step / 2, this.beltTop, step, board.width);

        this.createQueuePanel();
        if (this.sys.game.device.os.desktop) {
            this.add.text(GAME_WIDTH / 2, 936, 'Стрелки или WASD - очередь, Enter - на ленту, Esc - уровни', {
                fontFamily: FONT, fontSize: '15px', color: '#6f789a'
            }).setOrigin(0.5);
        }

        this.refreshTargets();
        this.syncQueues(true);
        this.refreshSelection();
        this.refreshCounter();
        this.tutorialStep = this.levelIndex === 0 && !isTutorialDone() ? 0 : -1;
        this.showHint();
    }

    // Подсказка обучения: жёлтая плашка над очередями; на первом шаге стрелка над выбранной очередью.
    private showHint(): void {
        this.hint?.destroy();
        this.hintArrow?.destroy();
        this.hint = null;
        this.hintArrow = null;
        if (this.tutorialStep < 0) {
            return;
        }
        const desktop = this.sys.game.device.os.desktop;
        const message = this.tutorialStep === 0 && desktop ? TUTORIAL_HINT_DESKTOP : TUTORIAL_HINTS[this.tutorialStep];
        const text = this.add.text(0, 0, message, {
            fontFamily: FONT, fontSize: '17px', color: '#1b1f2e', fontStyle: 'bold'
        }).setOrigin(0.5);
        const width = text.width + 36;
        const bubble = this.add.graphics();
        bubble.fillStyle(0x000000, 0.25);
        bubble.fillRoundedRect(-width / 2, -15 + 3, width, 32, 16);
        bubble.fillStyle(SELECT_COLOR, 1);
        bubble.fillRoundedRect(-width / 2, -15, width, 32, 16);
        this.hint = this.add.container(GAME_WIDTH / 2, HINT_Y, [bubble, text]).setDepth(15);
        this.hint.setScale(0.8).setAlpha(0);
        this.tweens.add({ targets: this.hint, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
        if (this.tutorialStep === 0) {
            this.hintArrow = this.add.text(this.queueX(this.selected), QUEUE_TOP + 36, '▼', {
                fontFamily: FONT, fontSize: '14px', color: '#ffd54a'
            }).setOrigin(0.5).setDepth(15);
            this.tweens.add({ targets: this.hintArrow, y: QUEUE_TOP + 31, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
    }

    // каждая отправленная коробка двигает обучение на шаг; после последней подсказки оно заканчивается
    private advanceTutorial(): void {
        if (this.tutorialStep < 0) {
            return;
        }
        this.tutorialStep++;
        if (this.tutorialStep >= TUTORIAL_HINTS.length) {
            this.finishTutorial();
        } else {
            this.showHint();
        }
    }

    private finishTutorial(): void {
        if (this.tutorialStep < 0) {
            return;
        }
        this.tutorialStep = -1;
        markTutorialDone();
        this.showHint();
    }

    // Лента: путь по периметру прямоугольника (позиции как в логике: сначала верхняя сторона над столбцами),
    // рамка дорожки и места для коробок.
    private buildBelt(x0: number, y0: number, step: number, width: number): void {
        const bottom = y0 + (BELT_ROWS - 1) * step;
        const right = x0 + (width - 1) * step;
        const points: Pos[] = [];
        for (let i = 0; i < width; i++) {
            points.push({ x: x0 + i * step, y: y0 });
        }
        for (let k = 1; k <= BELT_ROWS - 1; k++) {
            points.push({ x: right, y: y0 + k * step });
        }
        for (let c = width - 2; c >= 0; c--) {
            points.push({ x: x0 + c * step, y: bottom });
        }
        for (let k = BELT_ROWS - 2; k >= 1; k--) {
            points.push({ x: x0, y: y0 + k * step });
        }
        this.path = points;

        const half = this.carSize / 2 + 6;
        const track = this.add.graphics();
        track.fillStyle(0x000000, 0.25);
        track.fillRoundedRect(x0 - half, y0 - half + 4, right - x0 + half * 2, bottom - y0 + half * 2, 22);
        track.fillStyle(0x20243b, 1);
        track.fillRoundedRect(x0 - half, y0 - half, right - x0 + half * 2, bottom - y0 + half * 2, 22);
        track.lineStyle(2, COLORS.panelStroke, 1);
        track.strokeRoundedRect(x0 - half, y0 - half, right - x0 + half * 2, bottom - y0 + half * 2, 22);
        track.fillStyle(0x14172a, 1);
        const hole = Math.max(4, half - 0);
        track.fillRoundedRect(x0 + hole, y0 + hole, Math.max(2, right - x0 - hole * 2), Math.max(2, bottom - y0 - hole * 2), 10);
        track.lineStyle(2, COLORS.panelStroke, 1);
        track.strokeRoundedRect(x0 + hole, y0 + hole, Math.max(2, right - x0 - hole * 2), Math.max(2, bottom - y0 - hole * 2), 10);

        for (let i = 0; i < points.length; i += 2) {
            this.treads.push({ dot: this.add.circle(0, 0, 2.4, 0x4a5280).setDepth(2), base: i });
        }

        // места для коробок едут по ленте и показывают, сколько их помещается
        this.carriageViews = this.game_.carriages.map(() => null);
        this.carriageLayer = this.game_.carriages.map(() => this.add.container(0, 0).setDepth(6));
        this.game_.carriages.forEach((_, j) => {
            const holder = this.add.graphics();
            const s = this.carSize;
            holder.fillStyle(0x0f1220, 1);
            holder.fillRoundedRect(-s / 2, -s / 2, s, s, 9);
            holder.lineStyle(2, 0x3b4262, 1);
            holder.strokeRoundedRect(-s / 2, -s / 2, s, s, 9);
            this.holders.push(holder);
            this.carriageLayer[j].add(holder);
        });
        this.renderCarriages(0);
    }

    private createQueuePanel(): void {
        drawPanel(this, PANEL_X, QUEUE_TOP, PANEL_W, QUEUE_PANEL_H);
        this.add.text(PANEL_X + 18, QUEUE_TOP + 10, 'ОЧЕРЕДИ', {
            fontFamily: FONT, fontSize: '13px', color: COLORS.muted, fontStyle: 'bold'
        });
        const queues = this.game_.queues;
        queues.forEach((_, q) => {
            // вся колонка очереди нажимается: первая коробка уходит на ленту
            const hit = this.add.rectangle(this.queueX(q), QUEUE_TOP + QUEUE_PANEL_H / 2 + 6, this.queueWidth() - 8, QUEUE_PANEL_H - 36, 0xffffff, 0.001);
            hit.setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => this.onQueueTap(q));
            this.moreTexts.push(this.add.text(this.queueX(q), QUEUE_TOP + HEAD_OFFSET + QUEUE_STEP * (this.game_.options.depth - 1) + 44, '', {
                fontFamily: FONT, fontSize: '14px', color: COLORS.muted, fontStyle: 'bold'
            }).setOrigin(0.5));
        });
    }

    private queueWidth(): number {
        return (PANEL_W - 24) / this.game_.queues.length;
    }

    private queueX(q: number): number {
        return PANEL_X + 12 + this.queueWidth() * (q + 0.5);
    }

    private queueY(index: number): number {
        return QUEUE_TOP + HEAD_OFFSET + QUEUE_STEP * index;
    }

    // точка пути между позициями index и index + 1; frac - доля шага
    private pathPoint(index: number, frac: number): Pos {
        const a = this.path[index];
        const b = this.path[(index + 1) % this.path.length];
        return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    }

    // позиция места ленты на экране
    private carriagePos(carriage: number, frac: number): Pos {
        return this.pathPoint(this.game_.position(carriage), frac);
    }

    private renderCarriages(frac: number): void {
        this.carriageLayer.forEach((layer, j) => {
            const p = this.carriagePos(j, frac);
            layer.setPosition(p.x, p.y);
        });
        this.treads.forEach(tread => {
            const p = this.pathPoint((tread.base + this.game_.phase) % this.path.length, frac);
            tread.dot.setPosition(p.x, p.y);
        });
    }

    // рисует коробку: тень, цвет, блик сверху и рамку (золотая у выбранной)
    private paintBox(gfx: Phaser.GameObjects.Graphics, color: number, size: number, selected: boolean): void {
        const h = size / 2;
        const r = Math.max(8, size * 0.19);
        gfx.clear();
        gfx.fillStyle(0x000000, 0.3);
        gfx.fillRoundedRect(-h, -h + 3, size, size, r);
        gfx.fillStyle(PALETTE[color], 1);
        gfx.fillRoundedRect(-h, -h, size, size, r);
        gfx.fillStyle(0xffffff, 0.2);
        gfx.fillRoundedRect(-h + 3, -h + 3, size - 6, size * 0.38, r * 0.6);
        gfx.lineStyle(selected ? 5 : 2, selected ? SELECT_COLOR : 0xffffff, selected ? 1 : 0.35);
        gfx.strokeRoundedRect(-h, -h, size, size, r);
    }

    private createBoxView(box: Box, size: number): BoxView {
        const gfx = this.add.graphics();
        this.paintBox(gfx, box.color, size, false);
        const label = this.add.text(0, 2, String(box.ammo), {
            fontFamily: FONT, fontSize: `${Math.round(size * 0.46)}px`, color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: Math.max(3, Math.round(size / 13))
        }).setOrigin(0.5);
        const container = this.add.container(0, 0, [gfx, label]);
        return { box: container, gfx, label, color: box.color, size };
    }

    // подсветка клеток, в которые сейчас может попасть выстрел: нижняя незакрашенная клетка каждого столбца
    private refreshTargets(): void {
        const board = this.game_.board;
        this.targetCells.forEach(cell => this.cellViews[cell]?.setStrokeStyle(0));
        this.targetCells.clear();
        for (let column = 0; column < board.width; column++) {
            const cell = board.targetCell(column);
            if (cell >= 0) {
                this.targetCells.add(cell);
                this.cellViews[cell].setStrokeStyle(2, 0xffffff, 0.85);
            }
        }
    }

    private refreshCounter(): void {
        const board = this.game_.board;
        this.counter.setText(`Собрано ${board.filledCount} из ${board.total}`);
    }

    // рамка и увеличение у первой коробки выбранной очереди
    private refreshSelection(): void {
        this.game_.queues.forEach((queue, q) => {
            const head = queue[0];
            const view = head ? this.queueViews.get(head.id) : undefined;
            if (!view) {
                return;
            }
            const on = q === this.selected;
            this.paintBox(view.gfx, view.color, view.size, on);
            this.tweens.add({ targets: view.box, scale: on ? 1.1 : 1, duration: 120 });
        });
        this.hintArrow?.setX(this.queueX(this.selected));
    }

    // создаёт картинки видимых коробок очередей и переставляет остальные на свои места
    private syncQueues(instant = false): void {
        const depth = this.game_.options.depth;
        this.game_.queues.forEach((queue, q) => {
            queue.slice(0, depth).forEach((box, i) => {
                let view = this.queueViews.get(box.id);
                const x = this.queueX(q);
                const y = this.queueY(i);
                if (!view) {
                    view = this.createBoxView(box, QUEUE_BOX);
                    view.box.setPosition(x, y);
                    this.queueViews.set(box.id, view);
                    if (!instant) {
                        view.box.setScale(0);
                        this.tweens.add({ targets: view.box, scale: i === 0 ? 1 : 0.9, duration: 200, ease: 'Back.easeOut' });
                    }
                }
                view.box.setDepth(depth - i);
                const scale = i === 0 ? 1 : 0.9;
                if (instant) {
                    view.box.setPosition(x, y).setScale(scale);
                } else if (view.box.x !== x || view.box.y !== y) {
                    this.tweens.add({ targets: view.box, x, y, scale, duration: 180, ease: 'Sine.easeOut' });
                }
            });
            const hidden = Math.max(0, queue.length - depth);
            this.moreTexts[q].setText(hidden > 0 ? `ещё ${hidden}` : '');
        });
    }

    private onQueueTap(q: number): void {
        if (this.overlayAction || this.ending || this.game_.queues[q].length === 0) {
            return;
        }
        this.selected = q;
        this.deploy(q);
    }

    // если выбранная очередь опустела, выбор переходит на следующую непустую
    private keepSelection(): void {
        if (this.game_.queues[this.selected].length === 0) {
            this.moveSelection(1);
        }
    }

    private deploy(q: number): void {
        const head = this.game_.queues[q][0];
        if (!head || this.overlayAction || this.ending) {
            return;
        }
        const view = this.queueViews.get(head.id)!;
        const result = this.game_.deploy(q);
        if (!result.moved) {
            this.tweens.add({ targets: view.box, x: view.box.x + 8, duration: 50, yoyo: true, repeat: 2 });
            return;
        }
        this.queueViews.delete(head.id);
        this.paintBox(view.gfx, view.color, view.size, false);
        this.flyToCarriage(view, result.carriage, head);
        this.syncQueues();
        this.keepSelection();
        this.refreshSelection();
        this.advanceTutorial();
        this.checkEnd();
    }

    // коробка летит из очереди на место ленты; на ленте она появляется сразу, чтобы лента могла стрелять
    private flyToCarriage(ghost: BoxView, carriage: number, box: Box): void {
        const view = this.createBoxView(box, this.carSize);
        this.carriageViews[carriage] = view;
        this.carriageLayer[carriage].add(view.box);
        view.box.setScale(0.5);
        this.tweens.add({ targets: view.box, scale: 1, duration: 220, ease: 'Back.easeOut' });

        const from = { x: ghost.box.x, y: ghost.box.y };
        ghost.box.setDepth(12);
        const state = { t: 0 };
        this.tweens.add({
            targets: state,
            t: 1,
            duration: 220,
            ease: 'Sine.easeIn',
            onUpdate: () => {
                const to = this.carriagePos(carriage, this.acc / TICK_MS);
                ghost.box.setPosition(from.x + (to.x - from.x) * state.t, from.y + (to.y - from.y) * state.t);
                ghost.box.setScale(1 - 0.4 * state.t);
            },
            onComplete: () => ghost.box.destroy()
        });
    }

    update(_time: number, delta: number): void {
        if (this.ending) {
            return;
        }
        this.acc += Math.min(delta, 200);
        while (this.acc >= TICK_MS && !this.ending) {
            this.acc -= TICK_MS;
            this.onTick();
        }
        this.renderCarriages(this.acc / TICK_MS);
    }

    private onTick(): void {
        const shots = this.game_.tick();
        if (shots.length > 0) {
            shots.forEach(shot => this.fire(shot));
            this.refreshTargets();
            this.refreshCounter();
        }
        this.checkEnd();
    }

    // выстрел: шарик летит вверх от ленты по столбцу к клетке
    private fire(shot: Shot): void {
        const view = this.carriageViews[shot.carriage];
        const from = this.path[shot.column];
        const to = this.cellPos[shot.cell];
        const bullet = this.add.circle(from.x, from.y - this.carSize / 2, Math.max(3, this.cellR * 0.6), PALETTE[shot.box.color]);
        bullet.setStrokeStyle(1, 0xffffff, 0.6).setDepth(8);
        this.tweens.add({
            targets: bullet,
            y: to.y,
            radius: this.cellR,
            duration: Math.min(380, Math.max(120, (from.y - to.y) / 1.4)),
            ease: 'Sine.easeIn',
            onComplete: () => {
                this.cellViews[shot.cell].setFillStyle(PALETTE[shot.box.color], 1);
                this.cellGloss[shot.cell].setAlpha(0.5);
                bullet.destroy();
            }
        });
        if (!view) {
            return;
        }
        view.label.setText(String(shot.left));
        if (shot.left === 0) {
            this.carriageViews[shot.carriage] = null;
            this.tweens.add({
                targets: view.box,
                alpha: 0,
                scale: 0.5,
                duration: 160,
                onComplete: () => view.box.destroy()
            });
        }
    }

    private checkEnd(): void {
        if (this.ending) {
            return;
        }
        const status = this.game_.status;
        if (status === 'playing') {
            return;
        }
        this.ending = true;
        this.overlayAction = () => undefined;
        this.time.delayedCall(status === 'won' ? 700 : 500, () => this.showEnd(status === 'won'));
    }

    private showEnd(won: boolean): void {
        const last = this.levelIndex === LEVELS.length - 1;
        if (won) {
            markDone(this.levelIndex);
            this.finishTutorial();
        }
        const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(20);
        dim.setInteractive();
        drawPanel(this, 80, 320, GAME_WIDTH - 160, 300, 22).setDepth(21);
        this.add.text(GAME_WIDTH / 2, 380, won ? 'Победа!' : 'Лента занята', {
            fontFamily: FONT, fontSize: '42px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(22);
        this.add.text(GAME_WIDTH / 2, 428, won ? `Картинка собрана: ${this.game_.board.total} клеток` : 'Ни одна коробка на ленте не может стрелять', {
            fontFamily: FONT, fontSize: '16px', color: COLORS.muted
        }).setOrigin(0.5).setDepth(22);

        const nextLevel = () => {
            this.levelIndex++;
            this.startLevel();
        };
        const primary = won ? (last ? () => this.openMenu() : nextLevel) : () => this.startLevel();
        const primaryLabel = won ? (last ? 'К уровням' : 'Дальше') : 'Ещё раз';
        makeButton(this, GAME_WIDTH / 2, 498, 240, 56, primaryLabel, primary, { primary: true }).setDepth(22);
        if (!(won && last)) {
            makeButton(this, GAME_WIDTH / 2, 566, 240, 46, 'К уровням', () => this.openMenu(), { fontSize: '17px' }).setDepth(22);
        }
        this.overlayAction = primary;
    }
}
