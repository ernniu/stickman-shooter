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
  // 仅视觉放大（碰撞体仍按 width/height 计算，手感与判定不变）
  displayScale: 1.15,
} as const;

export const BULLET = {
  speed: gameUnits(2600),
  // size 同时决定碰撞体尺寸（保持不变，不改射击判定）
  size: gameUnits(36),
  // 仅视觉放大倍数：显示 = size × displayScale，碰撞体不受影响
  displayScale: 1.5,
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
  // 阵型与摆动：只影响观感，不改下落速度、数量与难度
  formationLanes: 5,
  spawnJitterRatio: 0.6,
  swingAmplitude: gameUnits(34),
  swingSpeed: 2.2,
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
  lineWidth: gameUnits(16),
  lineAlpha: 0.38,
  sideWidth: gameUnits(56),
  stripeHeight: gameUnits(260),
  // 中间横向速度线：比虚线更细更淡、滚动更快，避免跑道中部太空
  speedLineSpacing: gameUnits(150),
  speedLineSpeedRatio: 1.7,
  speedLineWidthRatio: 0.42,
  speedLineAlpha: 0.14,
  // 伪 3D 透视：跑道随 y 由窄变宽（顶部更窄，透视更明显）
  perspectiveTopY: 0,
  perspectiveBottomY: 1,
  topWidthRatio: 0.3,
  bottomWidthRatio: 0.78,
  perspectiveInset: gameUnits(40),
  // 透视缩放范围（远处 → 近处）
  minScale: 0.65,
  maxScale: 1.12,
  // 游戏对象按 y 排序的 depth 上限（必须低于 HUD 的 9）
  depthRange: 8,
} as const;

/** 增益门类型（第一版只做正向增益，不做惩罚门）。 */
export type GateKind = 'squad' | 'coin' | 'score';

export interface GateReward {
  /** 门牌上的文字 */
  readonly label: string;
  /** 触发后的提示飘字 */
  readonly toast: string;
  readonly color: number;
  readonly squad: number;
  readonly coins: number;
  readonly score: number;
}

/** 跑道增益门（选择门）配置：尺寸、节奏、奖励全部集中在此。 */
export const GATE = {
  // 生成节奏：从 startWave 开始，每 everyWaves 波一组，且两组间隔不小于 minIntervalMs
  startWave: 2,
  everyWaves: 2,
  minIntervalMs: 10000,
  // 下落速度（略慢于敌人，避免与敌群完全同步）
  speed: gameUnits(200),
  // 生成高度（相对 GAME_HEIGHT，负值表示屏幕上方之外）
  spawnYRatio: -0.12,
  // 尺寸（相对 GAME_WIDTH / GAME_HEIGHT）
  widthRatio: 0.26,
  heightRatio: 0.075,
  gapRatio: 0.06,
  fontSize: 56,
  // 呼吸动画
  pulseScale: 1.05,
  pulseMs: 620,
  // 编队已满时“+1人”门转换成的奖励
  squadFullCoins: 20,
  squadFullScore: 0,
  squadFullToast: '编队已满 +20金币',
} as const;

/** 每种门的奖励：编队 +1 / 金币 +20 / 分数 +100。 */
export const GATE_REWARDS: Record<GateKind, GateReward> = {
  squad: {
    label: '+1人',
    toast: '编队+1',
    color: 0x38bdf8,
    squad: 1,
    coins: 0,
    score: 0,
  },
  coin: {
    label: '+20金币',
    toast: '金币+20',
    color: 0xfacc15,
    squad: 0,
    coins: 20,
    score: 0,
  },
  score: {
    label: '+100分',
    toast: '分数+100',
    color: 0xa78bfa,
    squad: 0,
    coins: 0,
    score: 100,
  },
};

/** 击杀血渍残留：跟随跑道滚动并淡出，结束后自动销毁。 */
export const KILL_STAIN = {
  color: 0x7f1d1d,
  alpha: 0.16,
  minRadius: gameUnits(34),
  maxRadius: gameUnits(52),
  fadeMs: 900,
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
  pillHeight: gameUnits(118),
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
