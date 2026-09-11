import Phaser from 'phaser';

import { DANGER_LINE_Y, NUMBER_WALL } from './gameConfig';
import { getDepthAtY, getPerspectiveScaleAtY } from './perspective';
import { TEX, resolveTexture } from './textures';
import { FONT_FAMILY } from './ui';
import {
  GAME_CENTER_X,
  GAME_WIDTH,
  addGameText,
  gamePixels,
  gameUnits,
} from '@/rendering';

interface NumberWallHooks {
  /** 当前单发子弹伤害（GameScene 注入，含成长加成）。 */
  onBulletDamage(): number;
  /** 墙体突破（越线或触碰玩家中心）时扣装备。 */
  onBreach(): void;
}

/** 墙体 tint 状态色：满血红 → 中血橙 → 低血灰暗。 */
const TINT_FULL = 0xef4444;
const TINT_MID = 0xf59e0b;
const TINT_LOW = 0x64748b;
const MID_RATIO = 0.66;

/**
 * 数字墙系统：可射击打破的路障。
 * 独立于 GameScene 持有 group 与全部墙逻辑，GameScene 只负责接线（overlap / update / reset）。
 */
export class NumberWallSystem {
  private group?: Phaser.Physics.Arcade.Group;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hooks: NumberWallHooks,
  ) {}

  /** 延迟创建 group（scene physics 在 create 阶段才就绪）。 */
  get physicsGroup(): Phaser.Physics.Arcade.Group {
    if (!this.group) {
      this.group = this.scene.physics.add.group();
    }
    return this.group;
  }

  /** 重开一局时清空全部墙体（sprite/数字/影子/tween）。 */
  reset(): void {
    this.clear();
  }

  /** 屏上存活墙数（关卡片段完成判定用）。 */
  activeCount(): number {
    return this.countActive();
  }

  clear(): void {
    if (!this.group) {
      return;
    }
    for (const child of [...this.group.getChildren()]) {
      this.destroyWall(child as Phaser.Physics.Arcade.Sprite);
    }
  }

  /**
   * 波次开始时按需生成（概率/间隔/上限/避让见 NUMBER_WALL 配置）。
   * crowded：奖励箱+爆炸桶是否拥挤（由 GameScene 判定传入）。
   */
  onWaveStart(
    wave: number,
    hasActiveGate: boolean,
    crowded: boolean,
  ): void {
    if (wave < NUMBER_WALL.startWave) {
      return;
    }
    if ((wave - NUMBER_WALL.startWave) % NUMBER_WALL.everyWaves !== 0) {
      return;
    }
    if (Math.random() >= NUMBER_WALL.spawnChance) {
      return;
    }
    if (this.countActive() >= NUMBER_WALL.maxOnScreen) {
      return;
    }
    if (hasActiveGate || crowded) {
      return;
    }

    const baseHp = Math.min(
      NUMBER_WALL.maxHpCap,
      NUMBER_WALL.baseHp + NUMBER_WALL.hpPerWave * (wave - 1),
    );

    if (Math.random() < NUMBER_WALL.doubleChance) {
      // 双墙：左右各一道，hp 差异化，玩家横移选边；中间保留通路
      const baseX =
        GAME_CENTER_X - NUMBER_WALL.doubleLaneU * GAME_WIDTH * 0.5;
      const offsetX = NUMBER_WALL.doubleLaneU * GAME_WIDTH * 0.5;
      this.spawnWall(baseX, baseHp * NUMBER_WALL.doubleHpScale[0]);
      this.spawnWall(baseX + offsetX * 2, baseHp * NUMBER_WALL.doubleHpScale[1]);
    } else {
      const x =
        GAME_CENTER_X + Phaser.Math.FloatBetween(-0.5, 0.5) * GAME_WIDTH * 0.5;
      this.spawnWall(x, baseHp);
    }
  }

  /**
   * 子弹命中墙：同帧防重复（子弹销毁后 active=false）。
   * 伤害用现有成长公式；数字弹跳 + 闪白反馈；血量归零则碎裂销毁。
   */
  handleBulletHit(bulletObject: unknown, wallObject: unknown): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Sprite;
    const wall = wallObject as Phaser.Physics.Arcade.Sprite;
    if (!bullet.active || !wall.active || wall.getData('breached')) {
      return;
    }
    bullet.destroy();
    const hp = (wall.getData('hp') as number) - this.hooks.onBulletDamage();
    wall.setData('hp', hp);
    this.applyHpTint(wall);

    const hpText = wall.getData('hpText') as Phaser.GameObjects.Text | undefined;
    if (hp > 0) {
      wall.setTintFill(0xffffff);
      this.scene.time.delayedCall(60, () => {
        if (wall.active) {
          this.applyHpTint(wall);
        }
      });
      if (hpText?.active) {
        hpText.setText(String(Math.ceil(hp)));
        // 数字弹跳（数字不做透视缩放，scale 专用于弹跳动画）
        this.scene.tweens.killTweensOf(hpText);
        hpText.setScale(1.3);
        this.scene.tweens.add({
          targets: hpText,
          scale: 1,
          duration: 140,
          ease: 'Quad.out',
        });
      }
      return;
    }
    this.shatterWall(wall);
  }

  /**
   * 每帧：越线/触碰玩家中心检测（只扣一次装备，墙即销毁不会重复）+ 透视同步。
   * centerX/centerY 为玩家本体中心（小队中心），由 GameScene 传入。
   */
  update(centerX: number, centerY: number): void {
    if (!this.group) {
      return;
    }
    for (const child of [...this.group.getChildren()]) {
      const wall = child as Phaser.Physics.Arcade.Sprite;
      if (!wall.active) {
        continue;
      }

      // 突破判定：到危险线，或玩家本体中心进入墙体范围
      const bounds = wall.getBounds();
      const touchesPlayer =
        centerX > bounds.left &&
        centerX < bounds.right &&
        centerY > bounds.top &&
        centerY < bounds.bottom;
      if (bounds.bottom >= DANGER_LINE_Y || touchesPlayer) {
        const x = wall.x;
        const y = wall.y;
        wall.setData('breached', true);
        this.destroyWall(wall);
        this.shatterFx(x, y);
        this.hooks.onBreach();
        continue;
      }

      // 透视：缩放 + 层级 + 影子（数字 Text 不做透视缩放，保证可读性）
      const baseScale = (wall.getData('baseScale') as number) ?? 1;
      const scale = getPerspectiveScaleAtY(wall.y);
      wall.setScale(baseScale * scale);
      wall.setDepth(getDepthAtY(wall.y));
      const hpText = wall.getData('hpText') as
        | Phaser.GameObjects.Text
        | undefined;
      if (hpText?.active) {
        hpText.setPosition(wall.x, wall.y);
        hpText.setDepth(getDepthAtY(wall.y) + 0.1);
      }
      const shadow = wall.getData('shadow') as
        | Phaser.GameObjects.Ellipse
        | undefined;
      if (shadow?.active) {
        shadow.setPosition(wall.x, wall.y + wall.displayHeight * 0.48);
        shadow.setScale(scale);
        shadow.setDepth(getDepthAtY(wall.y) - 0.05);
      }
    }
  }

  private countActive(): number {
    return this.group ? this.group.countActive(true) : 0;
  }

  /** 关卡片段直接生成墙（跳过概率/避让，仅保留同屏上限）。 */
  spawnForced(
    mode: 'none' | 'single' | 'double',
    wave: number,
    segmentId?: number,
  ): void {
    if (mode === 'none' || this.countActive() >= NUMBER_WALL.maxOnScreen) {
      return;
    }
    const baseHp = Math.min(
      NUMBER_WALL.maxHpCap,
      NUMBER_WALL.baseHp + NUMBER_WALL.hpPerWave * (wave - 1),
    );
    if (mode === 'double') {
      const baseX =
        GAME_CENTER_X - NUMBER_WALL.doubleLaneU * GAME_WIDTH * 0.5;
      const offsetX = NUMBER_WALL.doubleLaneU * GAME_WIDTH * 0.5;
      this.spawnWall(baseX, baseHp * NUMBER_WALL.doubleHpScale[0], segmentId);
      this.spawnWall(
        baseX + offsetX * 2,
        baseHp * NUMBER_WALL.doubleHpScale[1],
        segmentId,
      );
    } else {
      const x =
        GAME_CENTER_X + Phaser.Math.FloatBetween(-0.5, 0.5) * GAME_WIDTH * 0.5;
      this.spawnWall(x, baseHp, segmentId);
    }
  }

  private spawnWall(x: number, hp: number, segmentId?: number): void {
    const spawnY = -NUMBER_WALL.height;
    const texture = resolveTexture(this.scene, 'numberWall', TEX.numberWall);
    const wall = this.physicsGroup.create(x, spawnY, texture) as
      Phaser.Physics.Arcade.Sprite;
    wall
      .setDisplaySize(NUMBER_WALL.width, NUMBER_WALL.height)
      .setDepth(getDepthAtY(spawnY));
    wall.setData('baseScale', wall.scaleX);
    wall.setData('hp', hp);
    wall.setData('maxHp', hp);
    if (segmentId !== undefined) {
      wall.setData('segmentId', segmentId);
    }
    (wall.body as Phaser.Physics.Arcade.Body).setSize(
      NUMBER_WALL.width * NUMBER_WALL.bodyWidthRatio,
      NUMBER_WALL.height * NUMBER_WALL.bodyHeightRatio,
      true,
    );
    wall.setVelocityY(NUMBER_WALL.speed);
    this.applyHpTint(wall);

    const hpText = addGameText(
      this.scene,
      x,
      spawnY,
      String(Math.ceil(hp)),
      {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(110),
        color: '#ffffff',
        fontStyle: 'bold',
      },
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(10))
      .setDepth(getDepthAtY(spawnY) + 0.1);
    wall.setData('hpText', hpText);

    const shadow = this.scene.add
      .ellipse(
        x,
        spawnY + NUMBER_WALL.height * 0.48,
        NUMBER_WALL.width * 1.7,
        NUMBER_WALL.width * 0.5,
        0x10253a,
        0.28,
      )
      .setDepth(getDepthAtY(spawnY) - 0.05);
    wall.setData('shadow', shadow);
  }

  /** 按剩余血量比例刷新墙体颜色。 */
  private applyHpTint(wall: Phaser.Physics.Arcade.Sprite): void {
    const maxHp = (wall.getData('maxHp') as number) ?? 1;
    const hp = (wall.getData('hp') as number) ?? 0;
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    wall.setTint(
      ratio > MID_RATIO
        ? TINT_FULL
        : ratio > NUMBER_WALL.lowHpColorRatio
          ? TINT_MID
          : TINT_LOW,
    );
  }

  /** 打破墙体：碎裂特效 + 销毁（不掉金币、不影响清波计数）。 */
  private shatterWall(wall: Phaser.Physics.Arcade.Sprite): void {
    const x = wall.x;
    const y = wall.y;
    this.destroyWall(wall);
    this.shatterFx(x, y);
  }

  private destroyWall(wall: Phaser.Physics.Arcade.Sprite): void {
    const hpText = wall.getData('hpText') as Phaser.GameObjects.Text | undefined;
    const shadow = wall.getData('shadow') as
      | Phaser.GameObjects.Ellipse
      | undefined;
    this.scene.tweens.killTweensOf(wall);
    if (hpText) {
      this.scene.tweens.killTweensOf(hpText);
    }
    wall.destroy();
    hpText?.destroy();
    shadow?.destroy();
  }

  /** 碎裂特效：灰蓝碎片向外飞散 + 暗色圆环，全部自毁。 */
  private shatterFx(x: number, y: number): void {
    const ring = this.scene.add
      .circle(x, y, gameUnits(60), 0x94a3b8, 0.85)
      .setDepth(8.5);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy(),
    });
    for (let index = 0; index < 7; index += 1) {
      const angle = (Math.PI * 2 * index) / 7 + Math.random() * 0.5;
      const distance = gameUnits(200) * (0.6 + Math.random() * 0.7);
      const shard = this.scene.add
        .rectangle(
          x,
          y,
          gameUnits(30 + Math.random() * 26),
          gameUnits(20 + Math.random() * 16),
          0x475569,
          0.95,
        )
        .setAngle(Math.random() * 90)
        .setDepth(8.5);
      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        angle: shard.angle + Math.random() * 180 - 90,
        alpha: 0,
        duration: 380,
        ease: 'Cubic.out',
        onComplete: () => shard.destroy(),
      });
    }
  }
}
