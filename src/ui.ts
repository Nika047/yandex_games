import Phaser from 'phaser';

export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;
export const FONT = 'Arial, sans-serif';

export const COLORS = {
    panel: 0x282d49,
    panelStroke: 0x3c4468,
    slot: 0x161929,
    slotStroke: 0x3b4262,
    muted: '#9aa3c0',
    accent: 0xffd54a,
    good: '#4cd37b'
};

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

// Вертикальный градиент полосами: Graphics.fillGradientStyle зависит от рендерера, полосы работают везде.
export function drawBackground(scene: Phaser.Scene): void {
    const steps = 48;
    const g = scene.add.graphics();
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        g.fillStyle((lerp(0x28, 0x11, t) << 16) | (lerp(0x2d, 0x14, t) << 8) | lerp(0x4a, 0x20, t), 1);
        g.fillRect(0, (GAME_HEIGHT / steps) * i, GAME_WIDTH, GAME_HEIGHT / steps + 1);
    }
}

export function drawPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, radius = 18): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(x, y + 4, w, h, radius);
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(x, y, w, h, radius);
    g.lineStyle(2, COLORS.panelStroke, 1);
    g.strokeRoundedRect(x, y, w, h, radius);
    return g;
}

interface ButtonOptions {
    primary?: boolean;
    fontSize?: string;
}

// Кнопка со скруглением; x, y - центр. Возвращает контейнер, чтобы задавать глубину одной строкой.
export function makeButton(
    scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, options: ButtonOptions = {}
): Phaser.GameObjects.Container {
    const gfx = scene.add.graphics();
    const paint = (hover: boolean) => {
        const fill = options.primary ? (hover ? 0x5f80ff : 0x4d6cee) : (hover ? 0x4a527a : 0x3b4262);
        const stroke = options.primary ? 0x93a8ff : 0x5a6390;
        gfx.clear();
        gfx.fillStyle(0x000000, 0.28);
        gfx.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 12);
        gfx.fillStyle(fill, 1);
        gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
        gfx.lineStyle(2, stroke, 1);
        gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    paint(false);
    const text = scene.add.text(0, 0, label, {
        fontFamily: FONT, fontSize: options.fontSize ?? '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    const hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => paint(true));
    hit.on('pointerout', () => paint(false));
    hit.on('pointerdown', onClick);
    return scene.add.container(x, y, [gfx, text, hit]);
}
