import Phaser from 'phaser';

import { BOSS } from './gameConfig';
import { getDepthAtY, getPerspectiveScaleAtY } from './perspective';
import { TEX, resolveTexture } from './textures';
import {
  GAME_CENTER_X,
  GAME_HEIGHT,
  GAME_WIDTH,
  gameUnits,
} from '@/rendering';

interface BossHooks {
  /** 当前单发子弹伤害（含成长加成）。 */
  onBulletDamage(): number;
  /** 震屏（复用 GameScene 的 FxSystem）。 */
  onShake(): void;
  /** 击败后：结算奖励并恢复普通波次（GameScene 实现）。 */
  onDefeated(): void;
}

type BossPhase = 'idle' | 'entering' | 'fighting' | 'dead';

/** Boss 血条位置：顶部 HUD 区块之下、狂暴条之下，不遮挡既有信息。 */
const HP_BAR_Y = gameUnits(330);

/**
 * Boss MVP：独立系统，持有 Boss 本体/血条/扇形弹与全部战斗状态。
 * GameScene 只负责接线（overlap / update / reset / 清波触发 / 奖励结算）。
 */
export class BossSystem {
  private bossGroup?: Phaser.Physics.Arcade.Group;
  private bullets?: Phaser.Physics.Arcade.Group;
  private boss?: Phaser.Physics.Arcade.Sprite;
  private hpBar?: Phaser.GameObjects.Graphics;
  private fireTimer?: Phaser.Time.TimerEvent;
  private phase: BossPhase = 'idle';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hooks: BossHooks,
  ) {}

  /** 本场 Boss 战是否进行中（入场/战斗中；死亡后为 false）。 */
  get isFightActive(): boolean {
    return this.phase === 'entering' || this.phase === 'fighting';
  }

  /** 第 startWave 波的 Boss 是否已触发过（防清波回调重入）。 */
  get fightStarted(): boolean {
    return this.phase !== 'idle';
  }

  /** Boss 本体 group（玩家子弹命中判定）。 */
  get physicsGroup(): Phaser.Physics.Arcade.Group {
    if (!this.bossGroup) {
      this.bossGroup = this.scene.physics.add.group();
    }
    return this.bossGroup;
  }

  /** Boss 子弹 group（与普通敌方子弹相互独立，命中走同一回调）。 */
  get bulletsGroup(): Phaser.Physics.Arcade.Group {
    if (!this.bullets) {
      this.bullets = this.scene.physics.add.group();
    }
    return this.bullets;
  }

  /** 开启 Boss 战：生成 Boss 并开始攻击循环（"BOSS 来袭！"横幅由 GameScene 编排）。 */
  startFight(): void {
    if (this.phase !== 'idle') {
      return;
    }
    this.phase = 'entering';
    const texture = resolveTexture(this.scene, 'boss', TEX.boss);
    const boss = this.physicsGroup.create(
      GAME_CENTER_X + Phaser.Math.FloatBetween(-0.15, 0.15) * GAME_WIDTH * 0.5,
      -BOSS.height,
      texture,
    ) as Phaser.Physics.Arcade.Sprite;
    boss.setDisplaySize(BOSS.width, BOSS.height).setDepth(getDepthAtY(0));
    boss.setData('baseScale', boss.scaleX);
    boss.setData('hp', BOSS.hp);
    boss.setData('maxHp', BOSS.hp);
    (boss.body as Phaser.Physics.Arcade.Body).setSize(
      BOSS.width * BOSS.bodyWidthRatio,
      BOSS.height * BOSS.bodyHeightRatio,
      true,
    );
    boss.setVelocityY(BOSS.enterSpeed);
    this.boss = boss;

    this.hpBar = this.scene.add.graphics().setDepth(13);
    this.fireTimer = this.scene.time.addEvent({
      delay: BOSS.attackIntervalMs,
      loop: true,
      callback: () => this.telegraphAttack(),
    });
  }

  /** 每帧：入场/血条重绘/透视同步/子弹越屏清理。 */
  update(): void {
    if (this.phase === 'idle') {
      return;
    }

    if (this.phase === 'entering' && this.boss?.active) {
      const stopY = GAME_HEIGHT * BOSS.spawnYRatio;
      if (this.boss.y >= stopY) {
        this.boss.setVelocityY(0);
        this.phase = 'fighting';
      }
    }

    const boss = this.boss;
    if (boss?.active) {
      const baseScale = (boss.getData('baseScale') as number) ?? 1;
      const perspectiveY = Math.max(boss.y, 0);
      boss.setScale(baseScale * getPerspectiveScaleAtY(perspectiveY));
      boss.setDepth(getDepthAtY(perspectiveY) + 0.2);
    }

    this.syncHpBar();

    if (this.bullets) {
      const cullLimit = GAME_HEIGHT + gameUnits(200);
      for (const child of [...this.bullets.getChildren()]) {
        const bullet = child as Phaser.Physics.Arcade.Sprite;
        if (bullet.active && bullet.y > cullLimit) {
          bullet.destroy();
        }
      }
    }
  }

  /** 玩家子弹命中 Boss：同帧防重复，血量归零走 die()。 */
  handleBulletHit(bulletObject: unknown, bossObject: unknown): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Sprite;
    const boss = bossObject as Phaser.Physics.Arcade.Sprite;
    if (!bullet.active || !boss.active || this.phase !== 'fighting') {
      return;
    }
    bullet.destroy();
    const hp = (boss.getData('hp') as number) - this.hooks.onBulletDamage();
    boss.setData('hp', hp);
    if (hp <= 0) {
      this.die();
      return;
    }
    // 受击反馈：闪白
    boss.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (boss.active) {
        boss.clearTint();
      }
    });
  }

  /** 开火预警：闪红 telegraphMs 后发射扇形弹。 */
  private telegraphAttack(): void {
    if (this.phase !== 'fighting' || !this.boss?.active) {
      return;
    }
    const boss = this.boss;
    boss.setTintFill(0xff5555);
    this.scene.tweens.add({
      targets: boss,
      alpha: { from: 1, to: 0.5 },
      duration: BOSS.telegraphMs / 2,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        if (boss.active) {
          boss.setAlpha(1);
          boss.clearTint();
        }
      },
    });
    this.scene.time.delayedCall(BOSS.telegraphMs, () => this.fire());
  }

  /** 扇形弹：居中向下，弹间留明显安全间隙。 */
  private fire(): void {
    if (this.phase !== 'fighting' || !this.boss?.active) {
      return;
    }
    const boss = this.boss;
    const count = BOSS.projectileCount as number;
    const texture = resolveTexture(this.scene, 'enemyBullet', TEX.enemyBullet);
    for (let index = 0; index < count; index += 1) {
      const t = count === 1 ? 0 : index / (count - 1) - 0.5;
      const angle = t * BOSS.projectileSpread;
      const bullet = this.bulletsGroup.create(
        boss.x,
        boss.y + BOSS.height * 0.45,
        texture,
      ) as Phaser.Physics.Arcade.Sprite;
      bullet
        .setDisplaySize(BOSS.projectileSize, BOSS.projectileSize)
        .setDepth(getDepthAtY(Math.max(boss.y, 0)) + 0.2);
      (bullet.body as Phaser.Physics.Arcade.Body).setSize(
        BOSS.projectileSize * 0.7,
        BOSS.projectileSize * 0.7,
        true,
      );
      bullet.setVelocity(
        Math.sin(angle) * BOSS.projectileSpeed,
        Math.cos(angle) * BOSS.projectileSpeed,
      );
    }

    // 输出窗口：Boss 外圈金色弱点高亮（本轮仅视觉，无额外伤害倍率）
    const glow = this.scene.add
      .circle(boss.x, boss.y, BOSS.width * 0.55, 0xfde047, 0)
      .setDepth(getDepthAtY(Math.max(boss.y, 0)) + 0.15);
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0, to: 0.35 },
      duration: BOSS.weakPointWindowMs / 2,
      yoyo: true,
      onComplete: () => glow.destroy(),
    });
  }

  /** Boss 死亡：停火、清弹、大爆炸 + 震屏，随后由 GameScene 恢复普通波次。 */
  private die(): void {
    if (this.phase !== 'fighting' || !this.boss) {
      return;
    }
    this.phase = 'dead';
    const x = this.boss.x;
    const y = this.boss.y;
    this.fireTimer?.remove();
    this.fireTimer = undefined;
    if (this.bullets) {
      for (const child of [...this.bullets.getChildren()]) {
        (child as Phaser.Physics.Arcade.Sprite).destroy();
      }
    }
    this.scene.tweens.killTweensOf(this.boss);
    this.boss.destroy();
    this.boss = undefined;
    this.hpBar?.destroy();
    this.hpBar = undefined;

    this.deathBlastFx(x, y);
    this.hooks.onShake();
    this.hooks.onDefeated();
  }

  /** 大型死亡爆炸：白闪 + 大圆环 + 碎片，全部自毁。 */
  private deathBlastFx(x: number, y: number): void {
    const flash = this.scene.add
      .circle(x, y, gameUnits(140), 0xfff3c4, 0.95)
      .setDepth(9);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: 460,
      ease: 'Quad.out',
      onComplete: () => flash.destroy(),
    });
    const ring = this.scene.add
      .circle(x, y, gameUnits(90), 0xfbbf24, 0.9)
      .setDepth(9);
    this.scene.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 560,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy(),
    });
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12 + Math.random() * 0.5;
      const distance = gameUnits(420) * (0.5 + Math.random() * 0.6);
      const shard = this.scene.add
        .circle(x, y, gameUnits(12 + Math.random() * 12), 0xf97316, 0.95)
        .setDepth(9);
      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 420 + Math.random() * 160,
        ease: 'Cubic.out',
        onComplete: () => shard.destroy(),
      });
    }
  }

  private syncHpBar(): void {
    if (!this.hpBar || !this.boss?.active) {
      return;
    }
    const maxHp = (this.boss.getData('maxHp') as number) ?? 1;
    const hp = (this.boss.getData('hp') as number) ?? 0;
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    const width = GAME_WIDTH * 0.6;
    const height = gameUnits(28);
    const x = GAME_CENTER_X - width / 2;
    const yPos = HP_BAR_Y;
    const bar = this.hpBar;
    bar.clear();
    bar.fillStyle(0x0f172a, 0.55);
    bar.fillRoundedRect(x, yPos, width, height, height / 2);
    if (ratio > 0) {
      bar.fillStyle(0xf43f5e, 0.95);
      bar.fillRoundedRect(
        x,
        yPos,
        width * ratio,
        height,
        Math.min(height / 2, (width * ratio) / 2),
      );
    }
    bar.lineStyle(gameUnits(3), 0xffffff, 0.4);
    bar.strokeRoundedRect(x, yPos, width, height, height / 2);
  }

  /** Game Over / 重开：完整清理本体、血条、timer、tween、子弹。 */
  clear(): void {
    // 场景 shutdown 时序下 group 内部可能已失效：防御性清空，异常静默
    try {
      this.fireTimer?.remove();
      this.fireTimer = undefined;
      if (this.boss) {
        this.scene.tweens.killTweensOf(this.boss);
        this.boss.destroy();
        this.boss = undefined;
      }
      if (this.bullets) {
        for (const child of [...this.bullets.getChildren()]) {
          (child as Phaser.Physics.Arcade.Sprite).destroy();
        }
      }
      this.hpBar?.destroy();
      this.hpBar = undefined;
    } catch {
      // 静默：场景销毁会兜底
    }
    this.bossGroup = undefined;
    this.bullets = undefined;
    this.phase = 'idle';
  }
}
