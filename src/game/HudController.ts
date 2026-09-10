import Phaser from 'phaser';

import {
  GAME_CENTER_X,
  GAME_HEIGHT,
  GAME_WIDTH,
  addGameText,
  gamePixels,
  gameUnits,
} from '@/rendering';
import { markEditable } from '@/utils';

import { HUD, POWER_UP, PROGRESS } from './gameConfig';
import { TEX } from './textures';
import { FONT_FAMILY, drawHudPill } from './ui';

/** HUD 渲染所需的只读视图数据（由 GameScene 传入）。 */
export interface HudView {
  readonly score: number;
  readonly wave: number;
  readonly weaponLevel: number;
  readonly spawnedThisWave: number;
  readonly waveTotal: number;
  readonly activeEnemies: number;
}

/**
 * HUD 控制器：分数 / 波次 / 编队 / 金币 / 关卡进度条。
 * 只负责显示，不持有玩法状态。
 */
export class HudController {
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  /** 金币图标基准缩放：脉冲动画以此为准，避免多次叠加导致越放越大 */
  private coinIconBaseScale = 1;
  private progressBar?: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {}

  create(): void {
    const hudStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: gamePixels(HUD.fontSize),
      color: '#ffffff',
      fontStyle: 'bold',
    };
    // HUD 胶囊底板：保证文字在跑道与云海上都可读
    drawHudPill(
      this.scene,
      HUD.marginX + gameUnits(358),
      HUD.y,
      gameUnits(620),
      HUD.pillHeight,
    );
    drawHudPill(
      this.scene,
      GAME_CENTER_X,
      HUD.y + gameUnits(45),
      gameUnits(320),
      gameUnits(250),
    );
    drawHudPill(
      this.scene,
      GAME_WIDTH - HUD.marginX - gameUnits(210),
      HUD.y,
      gameUnits(420),
      HUD.pillHeight,
    );
    this.scoreText = addGameText(
      this.scene,
      HUD.marginX + gameUnits(48),
      HUD.y,
      '分数 0',
      hudStyle,
    )
      .setOrigin(0, 0.5)
      .setStroke('#0f172a', gameUnits(8))
      .setDepth(10);
    markEditable('game.hud-score', this.scoreText, { label: '分数显示' });
    this.waveText = addGameText(
      this.scene,
      GAME_CENTER_X,
      HUD.y,
      '波次 1',
      hudStyle,
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(8))
      .setDepth(10);
    markEditable('game.hud-wave', this.waveText, { label: '波次显示' });
    this.weaponText = addGameText(
      this.scene,
      GAME_CENTER_X,
      HUD.y + gameUnits(110),
      '武器 Lv.1',
      hudStyle,
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(8))
      .setDepth(10);
    markEditable('game.hud-weapon', this.weaponText, { label: '武器等级显示' });

    this.coinIcon = this.scene.add
      .image(
        GAME_WIDTH - HUD.marginX - gameUnits(40),
        HUD.y,
        TEX.coin,
      )
      .setDisplaySize(gameUnits(88), gameUnits(88))
      .setDepth(10);
    this.coinIconBaseScale = this.coinIcon.scale;
    this.coinText = addGameText(
      this.scene,
      GAME_WIDTH - HUD.marginX - gameUnits(100),
      HUD.y,
      '0',
      hudStyle,
    )
      .setOrigin(1, 0.5)
      .setStroke('#0f172a', gameUnits(8))
      .setDepth(10);
    markEditable('game.hud-coin', this.coinText, { label: '金币显示' });

    this.progressBar = this.scene.add.graphics().setDepth(12);
    markEditable('game.hud-progress', this.progressBar, { label: '关卡进度条' });

    // 统一加强文字描边与投影，保证在跑道/云海上都清晰可读
    for (const text of [
      this.scoreText,
      this.waveText,
      this.weaponText,
      this.coinText,
    ]) {
      text
        .setStroke('#0f172a', gameUnits(10))
        .setShadow(0, gameUnits(4), 'rgba(15, 23, 42, 0.55)', gameUnits(6));
    }
  }

  update(view: HudView): void {
    this.scoreText.setText(`分数 ${view.score}`);
    this.waveText.setText(`波次 ${view.wave}`);
    const weaponLabel =
      view.weaponLevel >= POWER_UP.maxWeaponLevel
        ? '编队 MAX'
        : `编队 ${view.weaponLevel}`;
    this.weaponText.setText(weaponLabel);
    this.updateProgressBar(view);
  }

  /** 金币入账：更新数字并让数字与图标弹一下。 */
  setCoins(coins: number, pulse: boolean): void {
    this.coinText.setText(String(coins));
    if (!pulse) {
      return;
    }
    // 先结束上一次脉冲并复位，再播放，避免 scale 被反复叠加放大
    this.scene.tweens.killTweensOf([this.coinText, this.coinIcon]);
    this.coinText.setScale(1);
    this.coinIcon.setScale(this.coinIconBaseScale);
    this.scene.tweens.add({
      targets: this.coinText,
      scale: 1.2,
      duration: 80,
      yoyo: true,
      ease: 'Quad.out',
    });
    this.scene.tweens.add({
      targets: this.coinIcon,
      scale: this.coinIconBaseScale * 1.2,
      duration: 80,
      yoyo: true,
      ease: 'Quad.out',
    });
  }

  /** 金币飞行的终点（HUD 金币图标位置）。 */
  get coinTarget(): { x: number; y: number } {
    return { x: this.coinIcon.x, y: this.coinIcon.y };
  }

  /** 关卡进度：每 wavesPerLevel 波一关，填充 = 已完成波 + 当前波击杀占比。 */
  private updateProgressBar(view: HudView): void {
    const graphics = this.progressBar;
    if (!graphics) {
      return;
    }
    const levelWave = (view.wave - 1) % PROGRESS.wavesPerLevel;
    const killedThisWave = view.spawnedThisWave - view.activeEnemies;
    const waveRatio =
      view.waveTotal > 0
        ? Phaser.Math.Clamp(killedThisWave / view.waveTotal, 0, 1)
        : 0;
    const progress = Phaser.Math.Clamp(
      (levelWave + waveRatio) / PROGRESS.wavesPerLevel,
      0,
      1,
    );

    const x = GAME_WIDTH - PROGRESS.marginX;
    const y = GAME_HEIGHT * PROGRESS.topRatio;
    const height = GAME_HEIGHT * PROGRESS.heightRatio;
    const width = PROGRESS.barWidth;

    graphics.clear();
    graphics.fillStyle(0x0f172a, 0.35);
    graphics.fillRoundedRect(x, y, width, height, width / 2);
    graphics.lineStyle(gameUnits(3), 0xffffff, 0.3);
    graphics.strokeRoundedRect(x, y, width, height, width / 2);
    const fillHeight = height * progress;
    if (fillHeight > 0) {
      graphics.fillStyle(PROGRESS.fillColor, 0.9);
      graphics.fillRoundedRect(
        x,
        y + height - fillHeight,
        width,
        fillHeight,
        Math.min(width / 2, fillHeight / 2),
      );
    }
    // 顶部小旗：进度终点标识
    const poleX = x + width / 2;
    graphics.fillStyle(0xffffff, 0.95);
    graphics.fillRect(
      poleX - gameUnits(3),
      y - gameUnits(48),
      gameUnits(6),
      gameUnits(48),
    );
    graphics.fillStyle(PROGRESS.flagColor, 1);
    graphics.fillTriangle(
      poleX,
      y - gameUnits(48),
      poleX + gameUnits(38),
      y - gameUnits(36),
      poleX,
      y - gameUnits(24),
    );
  }
}
