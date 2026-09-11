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

import { EQUIPMENT, HUD, POWER_UP, PROGRESS } from './gameConfig';
import { TEX, resolveTexture } from './textures';
import { FONT_FAMILY, drawHudPill } from './ui';

/** HUD 渲染所需的只读视图数据（由 GameScene 传入）。 */
export interface HudView {
  readonly score: number;
  readonly wave: number;
  /** 关卡片段进度标签（如"阶段 3/8"），优先于 wave 显示。 */
  readonly stageLabel: string;
  readonly bossFight: boolean;
  readonly weaponLevel: number;
  readonly shieldCount: number;
  readonly damageBonus: number;
  readonly attackSpeedBonus: number;
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
  private rageText?: Phaser.GameObjects.Text;
  private rageBar?: Phaser.GameObjects.Graphics;
  private shieldText?: Phaser.GameObjects.Text;
  private buffText?: Phaser.GameObjects.Text;
  private starterText?: Phaser.GameObjects.Text;
  private rageVisible = false;

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
    // 中上：小型波次徽章
    drawHudPill(
      this.scene,
      GAME_CENTER_X,
      HUD.y + gameUnits(20),
      gameUnits(190),
      gameUnits(190),
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
      HUD.y + gameUnits(48),
      '1',
      {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(96),
        color: '#ffffff',
        fontStyle: 'bold',
      },
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(8))
      .setDepth(10);
    markEditable('game.hud-wave', this.waveText, { label: '波次显示' });
    addGameText(
      this.scene,
      GAME_CENTER_X,
      HUD.y - gameUnits(38),
      '波次',
      {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(40),
        color: '#dbeafe',
      },
    )
      .setOrigin(0.5)
      .setDepth(10);
    this.weaponText = addGameText(
      this.scene,
      GAME_CENTER_X,
      HUD.y + gameUnits(160),
      '编队 1',
      {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(44),
        color: '#e0f2fe',
      },
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(6))
      .setDepth(10);
    markEditable('game.hud-weapon', this.weaponText, { label: '编队显示' });

    this.coinIcon = this.scene.add
      .image(
        GAME_WIDTH - HUD.marginX - gameUnits(40),
        HUD.y,
        resolveTexture(this.scene, 'coin', TEX.coin),
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

    // 狂暴状态提示（默认隐藏，setRage 控制显隐与进度）
    this.rageText = this.scene.add
      .text(GAME_CENTER_X, HUD.y + gameUnits(215), '狂暴', {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(64),
        color: '#fde047',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setStroke('#7c2d12', gameUnits(8))
      .setDepth(10)
      .setVisible(false);
    this.rageBar = this.scene.add.graphics().setDepth(12).setVisible(false);

    // 护盾指示：装备文字左侧，仅在有护盾时显示
    this.shieldText = this.scene.add
      .text(GAME_CENTER_X - gameUnits(430), HUD.y + gameUnits(160), '护盾', {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(44),
        color: '#7dd3fc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(6))
      .setDepth(10)
      .setVisible(false);

    // 成长强化信息：装备文字右侧对称位，仅在有加成时显示
    this.buffText = this.scene.add
      .text(GAME_CENTER_X + gameUnits(430), HUD.y + gameUnits(160), '', {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(44),
        color: '#fca5a5',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(6))
      .setDepth(10)
      .setVisible(false);

    // 起步火力小字：与狂暴提示互斥显示（同一位置）
    this.starterText = this.scene.add
      .text(GAME_CENTER_X, HUD.y + gameUnits(215), '起步火力', {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(44),
        color: '#86efac',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(6))
      .setDepth(10)
      .setVisible(false);
  }

  /** 起步火力倒计时提示（remainMs <= 0 或狂暴中隐藏）。 */
  setStarter(remainMs: number): void {
    if (!this.starterText) {
      return;
    }
    const visible = remainMs > 0 && !this.rageVisible;
    this.starterText.setVisible(visible);
    if (visible) {
      this.starterText.setText(`起步火力 ${Math.ceil(remainMs / 1000)}s`);
    }
  }

  update(view: HudView): void {
    this.scoreText.setText(`分数 ${view.score}`);
    this.waveText.setText(view.bossFight ? 'BOSS' : view.stageLabel);
    const weaponLabel =
      view.weaponLevel >= EQUIPMENT.max
        ? `装备 MAX`
        : `装备 ${view.weaponLevel}/${EQUIPMENT.max}`;
    this.weaponText.setText(weaponLabel);
    this.shieldText?.setVisible(view.shieldCount > 0);
    this.updateBuffText(view);
    this.updateProgressBar(view);
  }

  /** 成长强化一行小字：伤害+XX% 攻速+XX%，无任何加成时隐藏。 */
  private updateBuffText(view: HudView): void {
    if (!this.buffText) {
      return;
    }
    const parts: string[] = [];
    if (view.damageBonus > 0) {
      parts.push(`伤害+${Math.round(view.damageBonus * 100)}%`);
    }
    if (view.attackSpeedBonus > 0) {
      parts.push(`攻速+${Math.round(view.attackSpeedBonus * 100)}%`);
    }
    if (parts.length === 0) {
      this.buffText.setVisible(false);
      return;
    }
    this.buffText.setText(parts.join(' '));
    this.buffText.setVisible(true);
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

  /** 狂暴状态 HUD：文字 + 剩余时间进度条（位于中间面板下方，不遮挡战斗区）。 */
  setRage(active: boolean, remainMs: number, maxMs: number): void {
    if (!this.rageText || !this.rageBar) {
      return;
    }
    this.rageVisible = active;
    this.rageText.setVisible(active);
    this.rageBar.setVisible(active);
    if (!active) {
      return;
    }
    const ratio = maxMs > 0 ? Phaser.Math.Clamp(remainMs / maxMs, 0, 1) : 0;
    const bar = this.rageBar;
    bar.clear();
    const width = gameUnits(260);
    const height = gameUnits(16);
    const x = GAME_CENTER_X - width / 2;
    const yPos = HUD.y + gameUnits(258);
    bar.fillStyle(0x0f172a, 0.45);
    bar.fillRoundedRect(x, yPos, width, height, height / 2);
    bar.fillStyle(0xf59e0b, 0.95);
    bar.fillRoundedRect(
      x,
      yPos,
      width * ratio,
      height,
      Math.min(height / 2, (width * ratio) / 2),
    );
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
