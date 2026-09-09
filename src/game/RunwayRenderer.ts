import Phaser from 'phaser';

import { GAME_CENTER_X, GAME_HEIGHT } from '@/rendering';

import { RUNWAY } from './gameConfig';
import { getLaneHalfWidthAtY, getPerspectiveT } from './perspective';
import { drawRunway } from './textures';

/**
 * 跑道渲染器：透视跑道绘制 + 滚动流光虚线。
 * 边界换算统一走 perspective.ts，本类只负责绘制。
 */
export class RunwayRenderer {
  private dashes?: Phaser.GameObjects.Graphics;
  private offset = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  /** 绘制跑道与流光虚线图层，返回底部左右边界。 */
  create(): { laneLeft: number; laneRight: number } {
    const lane = drawRunway(this.scene);
    this.dashes = this.scene.add.graphics().setDepth(-7);
    return lane;
  }

  /** 中线虚线随时间向下滚动，并按透视收窄/变细。 */
  updateDashes(deltaSeconds: number): void {
    const graphics = this.dashes;
    if (!graphics) {
      return;
    }
    const spacing = RUNWAY.dashSpacing;
    this.offset = (this.offset + RUNWAY.scrollSpeed * deltaSeconds) % spacing;
    graphics.clear();
    for (let y = this.offset - spacing; y < GAME_HEIGHT; y += spacing) {
      if (y < 0) {
        continue;
      }
      // 用标量版取半宽，避免每帧创建对象
      const halfWidth = getLaneHalfWidthAtY(y);
      const t = getPerspectiveT(y);
      const inset = RUNWAY.dashInset * (0.35 + 0.65 * t);
      const fromX = GAME_CENTER_X - halfWidth + inset;
      const toX = GAME_CENTER_X + halfWidth - inset;
      if (toX <= fromX) {
        continue;
      }
      // 上方更细更淡，下方更粗更亮，强化纵深
      graphics.lineStyle(
        RUNWAY.lineWidth * (0.45 + 0.55 * t),
        0xffffff,
        RUNWAY.lineAlpha * (0.45 + 0.55 * t),
      );
      graphics.lineBetween(fromX, y, toX, y);
    }
  }
}
