import { gameUnits } from '@/rendering';

// 全部玩法数值以桌面设计基准（2160×3840）表达，运行时经 gameUnits 换算；
// 布局、移动、碰撞与 UI 消费同一份配置，不在 Scene 中另设字面量。
export const PLAYER_Y = gameUnits(3240);
export const DANGER_LINE_Y = gameUnits(3420);
export const RUNWAY_MARGIN_X = gameUnits(240);

export const PLAYER = {
  width: gameUnits(240),
  height: gameUnits(340),
  moveSpeed: gameUnits(1500),
  // 手指拖动的平滑跟随系数（1/秒）：越大越跟手，越小越“飘”。
  followLerp: 12,
  // 玩家边界内缩半宽 = width * halfWidthRatio，用于把整个火柴人约束在跑道内。
  halfWidthRatio: 0.35,
  // 编队：跟随成员相对中心的横向间距 / 纵向落差 / 贴阵平滑系数
  squadSpread: gameUnits(150),
  squadYOffset: gameUnits(60),
  squadLerp: 14,
} as const;

export const BULLET = {
  speed: gameUnits(2600),
  size: gameUnits(24),
  fireIntervalMs: 300,
} as const;

export const ENEMY = {
  width: gameUnits(240),
  height: gameUnits(340),
  baseSpeed: gameUnits(250),
  speedPerWave: gameUnits(22),
  bodyWidthRatio: 0.66,
  bodyHeightRatio: 0.88,
  spawnIntervalMs: 700,
  spawnTopY: -gameUnits(200),
  score: 10,
  // 血量：第 n 波 = baseHp + floor((n-1)/hpWaveStep)，子弹每发扣 1
  baseHp: 2,
  hpWaveStep: 2,
  hpFontSize: 44,
  hpTextOffsetRatio: 0.72,
  hpPopScale: 1.35,
  // 击杀掉落金币：弹出后飞向右上角 HUD
  coinSize: gameUnits(96),
  coinDropMin: 1,
  coinDropMax: 2,
  coinFlyMs: 420,
} as const;

/** 第 n 波敌人的血量。 */
export const enemyHpForWave = (wave: number): number =>
  ENEMY.baseHp + Math.floor((wave - 1) / ENEMY.hpWaveStep);

/** 打击与视觉反馈参数（只影响表现，不改变玩法数值）。 */
export const FEEDBACK = {
  // 受击：闪白 + 轻微放大的持续时长
  hitFlashMs: 80,
  hitScale: 1.15,
  // 死亡爆炸：碎片数量固定（不用持续发射器），扩散半径与时长
  explosionShards: 8,
  explosionRadius: gameUnits(120),
  explosionDurationMs: 300,
  // Game Over 震屏
  shakeDurationMs: 260,
  shakeIntensity: 0.008,
} as const;

/** 关卡进度条（纯 UI，不改波次逻辑）：每 wavesPerLevel 波为一“关”。 */
export const PROGRESS = {
  wavesPerLevel: 5,
  marginX: gameUnits(70),
  barWidth: gameUnits(22),
  topRatio: 0.16,
  heightRatio: 0.34,
  fillColor: 0x22c55e,
  flagColor: 0xef4444,
} as const;

/** 跑道滚动与视觉参数（速度感 + 立体感）。 */
export const RUNWAY = {
  dashSpacing: gameUnits(360),
  scrollSpeed: gameUnits(560),
  dashInset: gameUnits(70),
  lineWidth: gameUnits(12),
  lineAlpha: 0.2,
  sideWidth: gameUnits(40),
  stripeHeight: gameUnits(260),
  // 伪 3D 透视：跑道随 y 由窄变宽
  perspectiveTopY: 0,
  perspectiveBottomY: 1,
  topWidthRatio: 0.4,
  bottomWidthRatio: 0.78,
  perspectiveInset: gameUnits(40),
  // 透视缩放范围（远处 → 近处）
  minScale: 0.65,
  maxScale: 1.12,
  // 游戏对象按 y 排序的 depth 上限（必须低于 HUD 的 9）
  depthRange: 8,
} as const;

/** 击杀血渍残留：跟随跑道滚动并淡出，结束后自动销毁。 */
export const KILL_STAIN = {
  color: 0x7f1d1d,
  alpha: 0.32,
  minRadius: gameUnits(46),
  maxRadius: gameUnits(72),
  fadeMs: 2000,
  scrollSpeed: RUNWAY.scrollSpeed,
} as const;

export const POWER_UP = {
  size: gameUnits(160),
  speed: gameUnits(320),
  dropEveryWaves: 2,
  maxWeaponLevel: 3,
  maxedBonusScore: 50,
} as const;

/** 第 n 波敌人数 = 4 + n * 2（第 1 波 6 个，之后每波 +2）。 */
export const enemyCountForWave = (wave: number): number => 4 + wave * 2;

/** 第 n 波敌人下落速度：基础速度 + 每波小幅递增。 */
export const enemySpeedForWave = (wave: number): number =>
  ENEMY.baseSpeed + ENEMY.speedPerWave * (wave - 1);

export const HUD = {
  marginX: gameUnits(64),
  y: gameUnits(150),
  fontSize: 72,
  pillHeight: gameUnits(132),
} as const;

export const BEST_STORAGE_KEY = 'cloud-stickman-shooter-best-v1';

export interface BestRecord {
  score: number;
  wave: number;
}

export const readBestRecord = (): BestRecord | null => {
  try {
    const raw = window.localStorage.getItem(BEST_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<BestRecord>;
    if (
      typeof parsed.score !== 'number' ||
      typeof parsed.wave !== 'number' ||
      !Number.isFinite(parsed.score) ||
      !Number.isFinite(parsed.wave)
    ) {
      return null;
    }
    return { score: parsed.score, wave: parsed.wave };
  } catch {
    return null;
  }
};

/** 提交一局成绩：与历史记录合并，最高分与最高波次各自取最大、互不覆盖。 */
export const writeBestRecord = (record: BestRecord): void => {
  const current = readBestRecord();
  const merged: BestRecord = {
    score: Math.max(record.score, current?.score ?? 0),
    wave: Math.max(record.wave, current?.wave ?? 1),
  };
  try {
    window.localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // 存储不可用（如隐私模式）时静默忽略，不影响结算流程。
  }
};
