import Phaser from 'phaser';

import {
  addGameText,
  gamePixels,
  gameUnits,
  GAME_CENTER_X,
  GAME_CENTER_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '@/rendering';
import { containImage } from '@/layout';
import { markEditable } from '@/utils';

import { DEV_LOADING_RUNTIME_KEYS } from './BootScene';

/**
 * 本场景用于为兜底场景展示
 */
export class DevLoadingScene extends Phaser.Scene {
  constructor() {
    super('dev-loading');
  }

  create(): void {
    const centerX = GAME_CENTER_X;
    const centerY = GAME_CENTER_Y;

    markEditable(
      'dev-loading.mascot',
      containImage(
        this.add.sprite(
          centerX,
          centerY - gameUnits(328),
          DEV_LOADING_RUNTIME_KEYS.texture,
        ),
        GAME_WIDTH * 0.9,
        GAME_HEIGHT * 0.32,
      )
        .play(DEV_LOADING_RUNTIME_KEYS.animation),
      { label: '开发中吉祥物' },
    );

    markEditable(
      'dev-loading.title',
      addGameText(this, centerX, centerY + gameUnits(368), '游戏开发中', {
        color: '#18181b',
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: gamePixels(128),
        fontStyle: 'bold',
      }).setOrigin(0.5),
      { label: '开发中标题' },
    );

    markEditable(
      'dev-loading.description',
      addGameText(
        this,
        centerX,
        centerY + gameUnits(552),
        '请稍后，游戏世界即将呈现',
        {
          color: '#71717a',
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          fontSize: gamePixels(72),
        },
      ).setOrigin(0.5),
      { label: '开发中说明文案' },
    );

    const loadingDots = Array.from({ length: 3 }, (_value, index) =>
      this.add.circle(
        centerX + (index - 1) * gameUnits(72),
        centerY + gameUnits(712),
        gameUnits(16),
        0xf43f75,
      ),
    );

    loadingDots.forEach((dot, index) => {
      this.tweens.add({
        targets: dot,
        alpha: 0.25,
        scale: 0.7,
        duration: 520,
        delay: index * 160,
        ease: 'Sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    });
  }
}
