import { GAME_CENTER_X, GAME_HEIGHT, GAME_WIDTH } from '@/rendering';

import { OPEN_RUNWAY, RUNWAY } from './gameConfig';

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

export interface LaneZones {
  /** 该 y 是否处于开口段（护栏断开，可滑出）。 */
  readonly isOpen: boolean;
  readonly safeLeft: number;
  readonly safeRight: number;
  readonly warnLeft: number;
  readonly warnRight: number;
  readonly fallLeft: number;
  readonly fallRight: number;
}

/**
 * 开口跑道的三区边界：安全区（内缩）→ 警告区 → 坠落判定（视觉边缘外扩）。
 * 仅开口段（openStartY 之下）允许滑出；上方仍按视觉边缘硬性看待。
 */
export const getLaneZonesAtY = (y: number): LaneZones => {
  const bounds = getLaneBoundsAtY(y);
  const half = bounds.width / 2;
  const isOpen = y >= GAME_HEIGHT * OPEN_RUNWAY.openStartYRatio;
  const safeInset = half * OPEN_RUNWAY.safeInsetRatio;
  const warnZone = half * OPEN_RUNWAY.warningZoneRatio;
  const fallOutset = half * OPEN_RUNWAY.fallOutsetRatio;
  return {
    isOpen,
    safeLeft: bounds.left + safeInset,
    safeRight: bounds.right - safeInset,
    warnLeft: bounds.left - warnZone,
    warnRight: bounds.right + warnZone,
    fallLeft: bounds.left - fallOutset,
    fallRight: bounds.right + fallOutset,
  };
};
