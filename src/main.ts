import Phaser from 'phaser';
import { GameScene } from './GameScene.ts';
import { MenuScene } from './MenuScene.ts';
import { GAME_HEIGHT, GAME_WIDTH } from './ui.ts';

const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#14172a',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [MenuScene, GameScene]
});

// при горячей перезагрузке в разработке старая игра не должна оставаться рядом с новой
if (import.meta.hot) {
    import.meta.hot.dispose(() => game.destroy(true));
}
