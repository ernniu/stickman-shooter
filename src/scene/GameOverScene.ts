import Phaser from 'phaser';

import {
  readBestRecord,
  writeBestRecord,
} from '@/game/gameConfig';
import {
  CloudField,
  addSkyBackground,
  ensureGameTextures,
} from '@/game/textures';
import { FONT_FAMILY, createGameButton } from '@/game/ui';
import {
  GAME_CENTER_X,
  GAME_HEIGHT,
  GAME_WIDTH,
  addGameText,
  gamePixels,
  gameUnits,
} from '@/rendering';

interface GameOverLaunchData {
  score?: number;
  wave?: number;
  coins?: number;
  weaponLevel?: number;
  damageBonus?: number;
  attackSpeedBonus?: number;
  bossDefeated?: boolean;
  levelComplete?: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private cloudField?: CloudField;
  private score = 0;
  private wave = 1;
  private coins = 0;
  private weaponLevel = 1;
  private damageBonus = 0;
  private attackSpeedBonus = 0;
  private bossDefeated = false;
  private levelComplete = false;

  constructor() {
    super('game-over');
  }

  init(data: GameOverLaunchData): void {
    this.score = typeof data.score === 'number' ? Math.max(0, data.score) : 0;
    this.wave = typeof data.wave === 'number' ? Math.max(1, data.wave) : 1;
    this.coins = typeof data.coins === 'number' ? Math.max(0, data.coins) : 0;
    this.weaponLevel =
      typeof data.weaponLevel === 'number' ? Math.max(1, data.weaponLevel) : 1;
    this.damageBonus =
      typeof data.damageBonus === 'number' ? Math.max(0, data.damageBonus) : 0;
    this.attackSpeedBonus =
      typeof data.attackSpeedBonus === 'number'
        ? Math.max(0, data.attackSpeedBonus)
        : 0;
    this.bossDefeated = data.bossDefeated === true;
    this.levelComplete = data.levelComplete === true;
  }

  create(): void {
    ensureGameTextures(this);
    addSkyBackground(this);
    this.cloudField = new CloudField(this, 4);

    this.add
      .rectangle(GAME_CENTER_X, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f172a, 0.5)
      .setDepth(1);

    const panelWidth = gameUnits(1640);
    // 关卡完成时追加 5 行成长结算，面板加高避免与按钮重叠
    const panelHeight = this.levelComplete
      ? gameUnits(2500)
      : gameUnits(1900);
    const panelCenterY = GAME_HEIGHT * 0.42;
    const panelTop = panelCenterY - panelHeight / 2;
    const panel = this.add.graphics().setDepth(2);
    panel.fillStyle(0xffffff, 0.96);
    panel.fillRoundedRect(
      GAME_CENTER_X - panelWidth / 2,
      panelTop,
      panelWidth,
      panelHeight,
      gameUnits(90),
    );

    const panelStyle = (
      fontSize: number,
      color: string,
    ): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: FONT_FAMILY,
      fontSize: gamePixels(fontSize),
      color,
      fontStyle: 'bold',
    });

    addGameText(
      this,
      GAME_CENTER_X,
      panelCenterY - gameUnits(700),
      this.levelComplete ? '关卡完成！' : '游戏结束',
      {
        ...panelStyle(104, this.levelComplete ? '#16a34a' : '#1f2937'),
      },
    )
      .setOrigin(0.5)
      .setDepth(3);

    addGameText(
      this,
      GAME_CENTER_X,
      panelCenterY - gameUnits(380),
      `最终分数  ${this.score}`,
      panelStyle(88, '#2563eb'),
    )
      .setOrigin(0.5)
      .setDepth(3);

    addGameText(
      this,
      GAME_CENTER_X,
      panelCenterY - gameUnits(200),
      `到达波次  第 ${this.wave} 波`,
      panelStyle(72, '#475569'),
    )
      .setOrigin(0.5)
      .setDepth(3);

    // 关卡完成：追加成长结算（金币/装备/伤害/攻速/Boss）
    if (this.levelComplete) {
      const growthRows: Array<[string, string]> = [
        ['金币', `+${this.coins}`],
        ['最终装备', `${this.weaponLevel}/8`],
        ['伤害加成', `+${Math.round(this.damageBonus * 100)}%`],
        ['攻速加成', `+${Math.round(this.attackSpeedBonus * 100)}%`],
        ['击败 Boss', this.bossDefeated ? '是' : '否'],
      ];
      growthRows.forEach(([label, value], index) => {
        addGameText(
          this,
          GAME_CENTER_X,
          panelCenterY - gameUnits(80) + index * gameUnits(120),
          `${label}  ${value}`,
          panelStyle(64, index === growthRows.length - 1 ? '#16a34a' : '#475569'),
        )
          .setOrigin(0.5)
          .setDepth(3);
      });
    }

    const previousBest = readBestRecord();
    const isNewBest = !previousBest || this.score > previousBest.score;
    // writeBestRecord 内部按“分数/波次各自取历史最大”合并，最高分与最高波次互不覆盖。
    writeBestRecord({ score: this.score, wave: this.wave });
    const best = readBestRecord() ?? { score: this.score, wave: this.wave };

    addGameText(
      this,
      GAME_CENTER_X,
      panelCenterY - gameUnits(20),
      `历史最高  ${best.score} 分 · 第 ${best.wave} 波`,
      panelStyle(64, '#64748b'),
    )
      .setOrigin(0.5)
      .setDepth(3);

    if (isNewBest && this.score > 0) {
      addGameText(
        this,
        GAME_CENTER_X,
        panelCenterY + gameUnits(160),
        '新纪录！',
        panelStyle(64, '#f59e0b'),
      )
        .setOrigin(0.5)
        .setDepth(3);
    }

    createGameButton(this, GAME_CENTER_X, panelCenterY + gameUnits(440), {
      width: gameUnits(900),
      height: gameUnits(260),
      fillColor: 0x2563eb,
      pressedFillColor: 0x1d4ed8,
      fontSize: 84,
      label: '再来一局',
      onPress: () => this.scene.start('game', { skipIntro: true }),
      editableLocator: 'game-over.restart-button',
      editableLabel: '再来一局按钮',
    });

    createGameButton(this, GAME_CENTER_X, panelCenterY + gameUnits(760), {
      width: gameUnits(900),
      height: gameUnits(220),
      fillColor: 0x64748b,
      pressedFillColor: 0x475569,
      fontSize: 64,
      label: '返回菜单',
      onPress: () => this.scene.start('menu'),
      editableLocator: 'game-over.menu-button',
      editableLabel: '返回菜单按钮',
    });
  }

  update(_time: number, delta: number): void {
    this.cloudField?.update(delta / 1000);
  }
}
