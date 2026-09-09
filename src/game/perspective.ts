import { GAME_CENTER_X, GAME_HEIGHT, GAME_WIDTH } from '@/rendering';

import { RUNWAY } from './gameConfig';

/**
 * 伪 3D 透视：只影响视觉与边界计算，不参与任何玩法数值判定。
 * 全部为纯函数且不依赖 Phaser 实例，便于单独复用/测试。
 */

export interface LaneBounds {
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly centerX: number;
  /** 从透视起点(0)到透视终点(1)的进度 */
  readonly t: number;
}

const clamp01 = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value;

const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * t;

/** 透视进度：顶部为 0，底部为 1。 */
export const getPerspectiveT = (y: number): number => {
  const top = GAME_HEIGHT * RUNWAY.perspectiveTopY;
  const bottom = GAME_HEIGHT * RUNWAY.perspectiveBottomY;
  if (bottom <= top) {
    return 1;
  }
  return clamp01((y - top) / (bottom - top));
};

/** 该 y 深度处的跑道半宽（标量版，无对象分配，供每帧高频调用）。 */
export const getLaneHalfWidthAtY = (y: number): number =>
  (GAME_WIDTH *
    lerp(RUNWAY.topWidthRatio, RUNWAY.bottomWidthRatio, getPerspectiveT(y))) /
  2;

/** 该 y 深度处的跑道边界：上窄下宽。 */
export const getLaneBoundsAtY = (y: number): LaneBounds => {
  const t = getPerspectiveT(y);
  const width =
    GAME_WIDTH * lerp(RUNWAY.topWidthRatio, RUNWAY.bottomWidthRatio, t);
  return {
    left: GAME_CENTER_X - width / 2,
    right: GAME_CENTER_X + width / 2,
    width,
    centerX: GAME_CENTER_X,
    t,
  };
};

/** 透视缩放：远处小、近处大（范围由 minScale/maxScale 控制）。 */
export const getPerspectiveScaleAtY = (y: number): number =>
  lerp(RUNWAY.minScale, RUNWAY.maxScale, getPerspectiveT(y));

/**
 * 按 y 排序的游戏对象 depth：映射到 0 ~ depthRange，
 * 确保永远低于 HUD(9~12)、横幅(20)、提示层(40+)。
 */
export const getDepthAtY = (y: number): number =>
  getPerspectiveT(y) * RUNWAY.depthRange;
