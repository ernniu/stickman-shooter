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
} as const;

export const BULLET = {
  speed: gameUnits(2600),
  size: gameUnits(24),
  fireIntervalMs: 300,
  spreadOffset: gameUnits(64),
  spreadAngle: 0.12,
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
} as const;

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
