import Phaser from 'phaser';

import { GAME_HEIGHT, gameUnits } from '@/rendering';

import { FEEDBACK, KILL_STAIN } from './gameConfig';
import { getDepthAtY, getPerspectiveScaleAtY } from './perspective';

/**
 * 反馈特效系统：死亡爆炸、击杀血渍、震屏。
 * 只做表现，不持有任何玩法状态；所有对象在动画结束后自动销毁。
 */
export class FxSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  /** 死亡爆炸：中心闪光 + 扩散圆环 + 固定数量碎片。 */
  deathBurst(x: number, y: number): void {
    // 中心闪光：快速膨胀淡出
    const flash = this.scene.add
      .circle(x, y, gameUnits(46), 0xffffff, 0.95)
      .setDepth(8.5);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.7,
      alpha: 0,
      duration: FEEDBACK.explosionDurationMs * 0.6,
      ease: 'Quad.out',
      onComplete: () => flash.destroy(),
    });

    // 扩散圆环
    const ring = this.scene.add
      .circle(x, y, gameUnits(30), 0xffffff, 0.9)
      .setDepth(8.5);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: FEEDBACK.explosionDurationMs,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy(),
    });

    // 固定数量碎片向外飞散（无持续发射器，全部结束后自动销毁）
    for (let index = 0; index < FEEDBACK.explosionShards; index += 1) {
      const angle =
        (Math.PI * 2 * index) / FEEDBACK.explosionShards + Math.random() * 0.6;
      const distance = FEEDBACK.explosionRadius * (0.6 + Math.random() * 0.6);
      const shard = this.scene.add
        .circle(x, y, gameUnits(9 + Math.random() * 8), 0xe5484d, 0.95)
        .setDepth(8.5);
      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: FEEDBACK.explosionDurationMs * (0.8 + Math.random() * 0.4),
        ease: 'Cubic.out',
        onComplete: () => shard.destroy(),
      });
    }
  }

  /** 击杀血渍：留在死亡位置随跑道下滚，逐渐淡出后自动销毁。 */
  killStain(x: number, y: number): void {
    const radius = Phaser.Math.Between(
      KILL_STAIN.minRadius,
      KILL_STAIN.maxRadius,
    );
    const stain = this.scene.add
      .ellipse(
        x,
        y,
        radius * 2,
        radius * 1.2,
        KILL_STAIN.color,
        KILL_STAIN.alpha,
      )
      .setScale(getPerspectiveScaleAtY(y))
      .setDepth(getDepthAtY(y) - 0.2);
    const duration = Math.min(
      KILL_STAIN.fadeMs,
      ((GAME_HEIGHT - y) / KILL_STAIN.scrollSpeed) * 1000,
    );
    this.scene.tweens.add({
      targets: stain,
      y: y + (KILL_STAIN.scrollSpeed * duration) / 1000,
      alpha: 0,
      duration,
      ease: 'Linear',
      onComplete: () => stain.destroy(),
    });
  }

  /** Game Over 轻微震屏。 */
  shakeScreen(): void {
    this.scene.cameras.main.shake(
      FEEDBACK.shakeDurationMs,
      FEEDBACK.shakeIntensity,
    );
  }
}
