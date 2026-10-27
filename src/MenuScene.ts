import Phaser from 'phaser';
import { DEFAULT_DIFFICULTY } from './logic.ts';
import { COLOR_KEYS, LEVELS, PALETTE } from './levels.ts';
import { loadDone, loadLast } from './progress.ts';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, drawBackground } from './ui.ts';

const COLS = 3;
const CARD_W = 156;
const CARD_H = 116;
const GAP_X = 12;
const GAP_Y = 8;
const TOP = 150;
const LEFT = (GAME_WIDTH - (COLS * CARD_W + (COLS - 1) * GAP_X)) / 2;
const PREVIEW = 60;
const DRAG_THRESHOLD = 10;

interface Card {
    gfx: Phaser.GameObjects.Graphics;
    x: number;
    y: number;
}

export class MenuScene extends Phaser.Scene {
    private selected = 0;
    private cards: Card[] = [];
    private done = new Set<number>();
    private dragged = false;

    constructor() {
        super('MenuScene');
    }

    init(data: { selected?: number }): void {
        this.selected = data.selected ?? loadLast(LEVELS.length);
    }

    create(): void {
        this.cards = [];
        this.done = loadDone();
        this.dragged = false;

        drawBackground(this);
        this.add.text(GAME_WIDTH / 2, 56, 'Marble Sort', {
            fontFamily: FONT, fontSize: '46px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(GAME_WIDTH / 2, 102, `Выберите уровень: пройдено ${this.done.size} из ${LEVELS.length}`, {
            fontFamily: FONT, fontSize: '18px', color: COLORS.muted
        }).setOrigin(0.5);

        LEVELS.forEach((_, i) => this.createCard(i));
        this.paintCards();

        const rows = Math.ceil(LEVELS.length / COLS);
        const contentHeight = TOP + rows * (CARD_H + GAP_Y) + 50;
        const scrollable = contentHeight > GAME_HEIGHT;
        if (scrollable) {
            this.cameras.main.setBounds(0, 0, GAME_WIDTH, contentHeight);
        } else if (this.sys.game.device.os.desktop) {
            this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 28, 'Стрелки или WASD - выбор уровня, Enter - играть', {
                fontFamily: FONT, fontSize: '16px', color: '#6f789a'
            }).setOrigin(0.5);
        }
        this.setupInput(scrollable, contentHeight);
        this.ensureVisible();
    }

    private cardPos(i: number): { x: number; y: number } {
        return {
            x: LEFT + (i % COLS) * (CARD_W + GAP_X) + CARD_W / 2,
            y: TOP + Math.floor(i / COLS) * (CARD_H + GAP_Y) + CARD_H / 2
        };
    }

    private createCard(i: number): void {
        const level = LEVELS[i];
        const { x, y } = this.cardPos(i);
        const rows = level.rows;
        const width = rows[0].length;
        const cells = rows.join('').replace(/\./g, '').length;
        const belt = { ...DEFAULT_DIFFICULTY, ...level.difficulty }.belt;

        const gfx = this.add.graphics();
        this.cards.push({ gfx, x, y });

        // миниатюра картинки
        const step = Math.min(PREVIEW / width, PREVIEW / rows.length);
        const preview = this.add.graphics();
        const left = x - (step * width) / 2;
        const top = y - 20 - (step * rows.length) / 2;
        rows.forEach((row, r) => [...row].forEach((ch, c) => {
            if (ch === '.') {
                return;
            }
            preview.fillStyle(PALETTE[COLOR_KEYS.indexOf(ch)], 1);
            preview.fillCircle(left + c * step + step / 2, top + r * step + step / 2, Math.max(1.2, step * 0.42));
        }));

        this.add.text(x - CARD_W / 2 + 12, y - CARD_H / 2 + 8, String(i + 1), {
            fontFamily: FONT, fontSize: '15px', color: COLORS.muted, fontStyle: 'bold'
        });
        if (this.done.has(i)) {
            this.add.text(x + CARD_W / 2 - 12, y - CARD_H / 2 + 6, '✓', {
                fontFamily: FONT, fontSize: '20px', color: COLORS.good, fontStyle: 'bold'
            }).setOrigin(1, 0);
        }
        this.add.text(x, y + 28, level.name, {
            fontFamily: FONT, fontSize: '15px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: CARD_W - 4 }
        }).setOrigin(0.5);
        this.add.text(x, y + 46, `${cells} клеток, лента ${belt}`, {
            fontFamily: FONT, fontSize: '12px', color: COLORS.muted
        }).setOrigin(0.5);

        const hit = this.add.rectangle(x, y, CARD_W, CARD_H, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => {
            this.selected = i;
            this.paintCards();
        });
        hit.on('pointerup', () => {
            if (!this.dragged) {
                this.play(i);
            }
        });
    }

    private paintCards(): void {
        this.cards.forEach((card, i) => {
            const on = i === this.selected;
            card.gfx.clear();
            card.gfx.fillStyle(0x000000, 0.25);
            card.gfx.fillRoundedRect(card.x - CARD_W / 2, card.y - CARD_H / 2 + 4, CARD_W, CARD_H, 16);
            card.gfx.fillStyle(on ? 0x343b61 : COLORS.panel, 1);
            card.gfx.fillRoundedRect(card.x - CARD_W / 2, card.y - CARD_H / 2, CARD_W, CARD_H, 16);
            card.gfx.lineStyle(on ? 4 : 2, on ? COLORS.accent : COLORS.panelStroke, 1);
            card.gfx.strokeRoundedRect(card.x - CARD_W / 2, card.y - CARD_H / 2, CARD_W, CARD_H, 16);
        });
    }

    private setupInput(scrollable: boolean, contentHeight: number): void {
        const maxScroll = Math.max(0, contentHeight - GAME_HEIGHT);
        if (scrollable) {
            this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
                this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + dy, 0, maxScroll);
            });
            this.input.on('pointerdown', () => {
                this.dragged = false;
            });
            this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
                if (!pointer.isDown) {
                    return;
                }
                if (Math.abs(pointer.y - pointer.downY) > DRAG_THRESHOLD) {
                    this.dragged = true;
                }
                if (this.dragged) {
                    this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY - (pointer.y - pointer.prevPosition.y), 0, maxScroll);
                }
            });
        }

        const keyboard = this.input.keyboard;
        if (!keyboard) {
            return;
        }
        keyboard.addCapture('UP,DOWN,LEFT,RIGHT,ENTER');
        const onKeyDown = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.moveSelection(-1);
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.moveSelection(1);
                    break;
                case 'ArrowUp':
                case 'KeyW':
                    this.moveSelection(-COLS);
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.moveSelection(COLS);
                    break;
                case 'Enter':
                case 'NumpadEnter':
                    if (!event.repeat) {
                        this.play(this.selected);
                    }
                    break;
                default:
                    break;
            }
        };
        keyboard.on('keydown', onKeyDown);
        // сцена запускается заново при каждом входе, старый обработчик иначе остаётся и срабатывает дважды
        this.events.once('shutdown', () => keyboard.off('keydown', onKeyDown));
    }

    private moveSelection(step: number): void {
        this.selected = Phaser.Math.Clamp(this.selected + step, 0, LEVELS.length - 1);
        this.paintCards();
        this.ensureVisible();
    }

    // выбранная карточка не должна уезжать за край экрана
    private ensureVisible(): void {
        const camera = this.cameras.main;
        const { y } = this.cardPos(this.selected);
        const margin = 16;
        if (y - CARD_H / 2 - margin < camera.scrollY) {
            camera.scrollY = Math.max(0, y - CARD_H / 2 - margin);
        } else if (y + CARD_H / 2 + margin > camera.scrollY + GAME_HEIGHT) {
            camera.scrollY = y + CARD_H / 2 + margin - GAME_HEIGHT;
        }
    }

    private play(level: number): void {
        this.scene.start('GameScene', { level });
    }
}
