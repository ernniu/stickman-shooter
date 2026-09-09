import Phaser from 'phaser';

import { readBestRecord } from '@/game/gameConfig';
import {
  CloudField,
  TEX,
  addSkyBackground,
  ensureGameTextures,
} from '@/game/textures';
import { FONT_FAMILY, createGameButton } from '@/game/ui';
import {
  GAME_CENTER_X,
  GAME_HEIGHT,
  addGameText,
  gamePixels,
  gameUnits,
} from '@/rendering';

export class MenuScene extends Phaser.Scene {
  private cloudField?: CloudField;

  constructor() {
    super('menu');
  }

  create(): void {
    ensureGameTextures(this);
    addSkyBackground(this);
    this.cloudField = new CloudField(this, 6);

    addGameText(this, GAME_CENTER_X, gameUnits(760), '云端火柴人射击', {
      fontFamily: FONT_FAMILY,
      fontSize: gamePixels(128),
      color: '#ffffff',
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setStroke('#1d4ed8', gameUnits(14))
      .setDepth(5);

    const subtitleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: gamePixels(64),
      color: '#f8fafc',
    };
    addGameText(
      this,
      GAME_CENTER_X,
      gameUnits(1040),
      '手指拖动移动 · 子弹自动发射',
      subtitleStyle,
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(6))
      .setDepth(5);
    addGameText(
      this,
      GAME_CENTER_X,
      gameUnits(1180),
      '别让红色火柴人越过红色警戒线',
      subtitleStyle,
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(6))
      .setDepth(5);

    this.add
      .image(GAME_CENTER_X, gameUnits(1760), TEX.player)
      .setDisplaySize(gameUnits(320), gameUnits(454))
      .setDepth(4);

    createGameButton(this, GAME_CENTER_X, gameUnits(2400), {
      width: gameUnits(980),
      height: gameUnits(280),
      fillColor: 0x2563eb,
      pressedFillColor: 0x1d4ed8,
      fontSize: 96,
      label: '开始游戏',
      onPress: () => this.scene.start('game'),
      editableLocator: 'menu.start-button',
      editableLabel: '开始游戏按钮',
    });

    const best = readBestRecord();
    if (best) {
      addGameText(
        this,
        GAME_CENTER_X,
        gameUnits(2680),
        `历史最高：${best.score} 分 · 第 ${best.wave} 波`,
        {
          fontFamily: FONT_FAMILY,
          fontSize: gamePixels(56),
          color: '#e0f2fe',
        },
      )
        .setOrigin(0.5)
        .setStroke('#0f172a', gameUnits(6))
        .setDepth(5);
    }
  }

  update(_time: number, delta: number): void {
    this.cloudField?.update(delta / 1000);
  }
}
