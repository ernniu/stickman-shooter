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
  // 编队：跟随成员相对中心的横向间距 / 每行纵向落差 / 贴阵平滑系数
  squadSpread: gameUnits(170),
  squadYOffset: gameUnits(60),
  squadLerp: 14,
  // 编队上限（1~8 人）；装备数量 = 本体 + 编队成员，上限自动取此值
  maxSquadSize: 8,
  // 仅视觉放大（碰撞体仍按 width/height 计算，手感与判定不变）
  displayScale: 1.22,
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
  /** 同屏普通敌人上限：达到后批次生成延后（不丢失总数）。 */
  maxOnScreen: 26,
  // 血量：第 n 波 = baseHp + floor((n-1)/hpWaveStep)，子弹每发扣 1
  baseHp: 2,
  hpWaveStep: 2,
  // 阵型与摆动：只影响观感，不改下落速度、数量与难度
  formationLanes: 5,
  spawnJitterRatio: 0.6,
  swingAmplitude: gameUnits(34),
  swingSpeed: 2.2,
  hpFontSize: 44,
  hpTextOffsetRatio: 0.95,
  hpPopScale: 1.35,
  // 头顶小血条（贴敌人头顶，数字在其上方）
  hpBarWidthRatio: 0.55,
  hpBarHeight: gameUnits(12),
  hpBarOffsetRatio: 0.62,
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
  // 命中火花（仅当 hit_spark_sprite 素材存在时播放）
  hitSparkSize: gameUnits(120),
  hitSparkMs: 160,
  // 死亡爆炸：碎片数量固定（不用持续发射器），扩散半径与时长
  explosionShards: 8,
  explosionRadius: gameUnits(120),
  explosionDurationMs: 300,
  // Game Over 震屏
  shakeDurationMs: 260,
  shakeIntensity: 0.008,
} as const;

/** 云层素材的视差参数（无素材时程序化云不受影响）。 */
export const CLOUD_LAYERS = {
  farWidthRatio: 0.46,
  nearWidthRatio: 0.32,
  farSpeedRatio: 0.55,
  nearSpeedRatio: 1.1,
  farDepth: -8.6,
  nearDepth: -8.1,
  baseSpeed: gameUnits(60),
  speedJitter: gameUnits(90),
  wrapMargin: gameUnits(220),
} as const;

/** 关卡进度条（纯 UI，不改波次逻辑）：每 wavesPerLevel 波为一“关”。 */
export const PROGRESS = {
  wavesPerLevel: 5,
  marginX: gameUnits(70),
  barWidth: gameUnits(14),
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
  lineWidth: gameUnits(20),
  lineAlpha: 0.9,
  sideWidth: gameUnits(56),
  stripeHeight: gameUnits(260),
  // 灰白实体赛道配色（参考图风格）
  roadColor: 0xd8dfe8,
  roadEdgeColor: 0x33465c,
  roadEdgeAlpha: 0.9,
  stripeColor: 0xc9d3de,
  stripeAlpha: 0.55,
  edgeHighlightAlpha: 0.9,
  // 中间横向速度线：比虚线更细更淡、滚动更快，避免跑道中部太空
  speedLineSpacing: gameUnits(150),
  speedLineSpeedRatio: 1.7,
  speedLineWidthRatio: 0.42,
  speedLineAlpha: 0.24,
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

/**
 * 编队阵型：本体为中心，跟随成员按 dx（squadSpread 的倍数）与 row（行号）排成 V 字/扇形。
 * 下标 = 编队人数（1~maxSquadSize），数组长度 = 跟随者数量（人数 - 1）。
 */
export const SQUAD_FORMATION: Record<
  number,
  ReadonlyArray<{ readonly dx: number; readonly row: number }>
> = {
  1: [],
  2: [{ dx: 0.7, row: 1 }],
  3: [
    { dx: -0.7, row: 1 },
    { dx: 0.7, row: 1 },
  ],
  4: [
    { dx: -1.1, row: 1 },
    { dx: 1.1, row: 1 },
    { dx: 0, row: 2 },
  ],
  5: [
    { dx: -1.35, row: 1 },
    { dx: 1.35, row: 1 },
    { dx: -0.7, row: 2 },
    { dx: 0.7, row: 2 },
  ],
  6: [
    { dx: -1.35, row: 1 },
    { dx: 0, row: 1 },
    { dx: 1.35, row: 1 },
    { dx: -0.7, row: 2 },
    { dx: 0.7, row: 2 },
  ],
  7: [
    { dx: -1.35, row: 1 },
    { dx: 0, row: 1 },
    { dx: 1.35, row: 1 },
    { dx: -0.7, row: 2 },
    { dx: 0.7, row: 2 },
    { dx: 0, row: 3 },
  ],
  8: [
    { dx: -1.35, row: 1 },
    { dx: 0, row: 1 },
    { dx: 1.35, row: 1 },
    { dx: -0.7, row: 2 },
    { dx: 0, row: 2 },
    { dx: 0.7, row: 2 },
    { dx: 0, row: 3 },
  ],
};

/** 狂暴射击：满编队后触发的爆发状态（更快的射击 + 更强的视觉）。 */
export const RAGE = {
  durationMs: 5000,
  // 叠加后的总时长上限（狂暴中再次触发会延时，但不超过此值）
  maxStackMs: 8000,
  fireIntervalMs: 145,
  // 子弹视觉：叠加金橙高光并放大
  bulletTint: 0xffb020,
  bulletScale: 1.25,
  // 脚下光圈
  auraColor: 0xffb020,
  auraAlpha: 0.34,
  auraScale: 1.25,
  pulseMs: 420,
} as const;

/** 增益门类型：成长门（squad/damage/attackSpeed/shield）+ 保留型（coin/score，供满编转换/未来系统）。 */
export type GateKind = 'squad' | 'damage' | 'attackSpeed' | 'shield' | 'coin' | 'score';

export interface GateReward {
  /** 门牌上的文字 */
  readonly label: string;
  /** 触发后的提示飘字 */
  readonly toast: string;
  readonly color: number;
  readonly squad: number;
  readonly coins: number;
  readonly score: number;
  /** 伤害加成增量（比例，如 0.3 = +30%） */
  readonly damage: number;
  /** 攻速加成增量（比例，如 0.2 = +20%） */
  readonly attackSpeed: number;
  /** 护盾层数增量 */
  readonly shield: number;
}

/** 成长强化数值：基础值 + 累积加成（不做乘法复利），全部在此调参。 */
export const GROWTH = {
  /** 单发子弹基础伤害（无加成时）。 */
  baseBulletDamage: 1,
  damagePerGate: 0.3,
  attackSpeedPerGate: 0.2,
  damageBonusCap: 1.5,
  attackSpeedBonusCap: 0.8,
  /** 攻速强化后的最小射击间隔下限（毫秒），防止定时器过快。 */
  minFireIntervalMs: 100,
} as const;

/** 奖励箱：可被射击打破的可选目标，未打破越线直接消失。 */
export const REWARD_BOX = {
  hp: 5,
  size: gameUnits(200),
  bodyRatio: 0.8,
  speed: gameUnits(460),
  startWave: 3,
  everyWaves: 2,
  spawnChance: 0.6,
  maxOnScreen: 1,
  coinReward: 20,
} as const;

/** 爆炸桶：低血量可打爆，对范围内敌人造成范围伤害。 */
export const BARREL = {
  hp: 2,
  size: gameUnits(180),
  bodyRatio: 0.75,
  speed: gameUnits(520),
  startWave: 4,
  everyWaves: 2,
  spawnChance: 0.65,
  spawnMin: 1,
  spawnMax: 2,
  maxOnScreen: 2,
  /** 爆炸范围伤害（固定值，走敌人受击结算）。 */
  blastDamage: 3,
  blastRadius: gameUnits(560),
} as const;

/** 远程敌人：停留中上部周期攻击，紫色 tint + 紫色血条区分。 */
export const RANGED_ENEMY = {
  startWave: 4,
  /** 每波出现概率（且每波最多 maxPerWave 个）。 */
  spawnChance: 0.5,
  maxPerWave: 1,
  /** 在普通敌人血量基础上额外增加的血量。 */
  hpBonus: 2,
  /** 下落速度 = 普通敌人速度 × 此系数。 */
  speedRatio: 0.7,
  /** 停留区域：屏幕高度比例上沿与下沿（中上部）。 */
  stopYTopRatio: 0.18,
  stopYBottomRatio: 0.32,
  /** 停留超过此时长后缓慢向下推进（毫秒）。 */
  resumePushMs: 12000,
  resumePushSpeedRatio: 0.3,
  fireIntervalMs: 2000,
  /** 开火预警时长（毫秒）：闪红脉冲，结束后才发射。 */
  telegraphMs: 400,
  /** 区分用 tint（紫）。 */
  tint: 0x9333ea,
} as const;

/** 敌方子弹：慢速下落能量弹，命中玩家/成员走 damagePlayer 结算。 */
export const ENEMY_BULLET = {
  /** 速度 = 当前波普通敌人下落速度 × 此系数。 */
  speedRatio: 4,
  size: gameUnits(56),
  bodyRatio: 0.7,
  maxOnScreen: 6,
} as const;

/** 数字墙：可射击打破的路障，到危险线/触碰玩家则扣一次装备。 */
export const NUMBER_WALL = {
  startWave: 5,
  everyWaves: 3,
  spawnChance: 0.6,
  maxOnScreen: 2,
  /** hp = baseHp + hpPerWave × (wave-1)，封顶 maxHpCap（不做无限高血量）。 */
  baseHp: 10,
  hpPerWave: 1,
  maxHpCap: 22,
  width: gameUnits(260),
  height: gameUnits(300),
  bodyWidthRatio: 0.9,
  bodyHeightRatio: 0.85,
  speed: gameUnits(300),
  /** 生成双墙的概率；双墙左右 hp 按比例差异化，供玩家选路。 */
  doubleChance: 0.5,
  doubleHpScale: [1, 1.6] as ReadonlyArray<number>,
  doubleLaneU: 0.42,
  /** 血量比例低于此值时墙体颜色转灰暗。 */
  lowHpColorRatio: 0.35,
} as const;

/** Boss MVP：第 startWave 波清空后进入 Boss 战，击败后恢复普通波次。 */
export const BOSS = {
  startWave: 10,
  hp: 120,
  width: gameUnits(560),
  height: gameUnits(560),
  bodyWidthRatio: 0.8,
  bodyHeightRatio: 0.75,
  /** 停留位置（屏幕高度比例，上方 20%~30% 区域）。 */
  spawnYRatio: 0.24,
  enterSpeed: gameUnits(420),
  attackIntervalMs: 2600,
  telegraphMs: 600,
  projectileCount: 3,
  /** 扇形总张角（弧度）。 */
  projectileSpread: 0.3,
  projectileSpeed: gameUnits(620),
  projectileSize: gameUnits(72),
  rewardCoins: 80,
  rewardScore: 300,
  /** 击败后到恢复普通波次的延迟。 */
  deathDelayMs: 1400,
  /** 攻击后的输出窗口（弱点高亮时长，本轮仅视觉）。 */
  weakPointWindowMs: 1000,
} as const;

/** 起步火力：开局爽感用，仅前 durationMs 生效的更快基础射击间隔。 */
export const STARTER_FIRE = {
  /** 生效时长（从正式开战起算，不含开局提示层）。 */
  durationMs: 10000,
  /** 起步阶段基础射击间隔（正常为 BULLET.fireIntervalMs = 300）。 */
  baseIntervalMs: 220,
} as const;

/** 跑道增益门（选择门）配置：尺寸、节奏、奖励全部集中在此。 */
export const GATE = {
  // 生成节奏：从 startWave 开始，每 everyWaves 波一组，且两组间隔不小于 minIntervalMs
  // 注意：道具在偶数波生成，门取奇数波（3/5/7…），两者错开，避免同屏元素冲突
  startWave: 3,
  everyWaves: 2,
  minIntervalMs: 10000,
  // 下落速度：需明显大于敌人，让玩家能在几秒内等到门到达
  speed: gameUnits(700),
  // 生成高度（相对 GAME_HEIGHT）：偏上方，留出反应时间，此处跑道宽度仍够容纳两扇门
  spawnYRatio: 0.08,
  // 尺寸（相对 GAME_WIDTH / GAME_HEIGHT）
  widthRatio: 0.3,
  heightRatio: 0.095,
  gapRatio: 0.06,
  fontSize: 72,
  // 呼吸动画
  pulseScale: 1.05,
  pulseMs: 620,
  // 编队已满时“+1人”门转换成的奖励
  squadFullCoins: 20,
  squadFullScore: 0,
  squadFullToast: '狂暴射击！',
  // 护盾门在护盾已满时的转换奖励
  shieldFullCoins: 10,
  shieldFullToast: '护盾已满',
  // 成长门组合池：每次从中随机取一组，左右两扇奖励必定不同
  growthPairs: [
    ['squad', 'damage'],
    ['attackSpeed', 'shield'],
    ['squad', 'attackSpeed'],
    ['damage', 'shield'],
  ] as ReadonlyArray<readonly [GateKind, GateKind]>,
} as const;

/** 每种门的奖励：装备 +1 / 伤害 +30% / 攻速 +20% / 护盾 +1；金币/分数保留给转换与未来系统。 */
export const GATE_REWARDS: Record<GateKind, GateReward> = {
  squad: {
    label: '+1人',
    toast: '编队+1',
    color: 0x38bdf8,
    squad: 1,
    coins: 0,
    score: 0,
    damage: 0,
    attackSpeed: 0,
    shield: 0,
  },
  damage: {
    label: '伤害+30%',
    toast: '伤害提升！',
    color: 0xf87171,
    squad: 0,
    coins: 0,
    score: 0,
    damage: GROWTH.damagePerGate,
    attackSpeed: 0,
    shield: 0,
  },
  attackSpeed: {
    label: '攻速+20%',
    toast: '射速提升！',
    color: 0x4ade80,
    squad: 0,
    coins: 0,
    score: 0,
    damage: 0,
    attackSpeed: GROWTH.attackSpeedPerGate,
    shield: 0,
  },
  shield: {
    label: '护盾',
    toast: '获得护盾！',
    color: 0x7dd3fc,
    squad: 0,
    coins: 0,
    score: 0,
    damage: 0,
    attackSpeed: 0,
    shield: 1,
  },
  coin: {
    label: '+20',
    toast: '金币+20',
    color: 0xfacc15,
    squad: 0,
    coins: 20,
    score: 0,
    damage: 0,
    attackSpeed: 0,
    shield: 0,
  },
  score: {
    label: '+100',
    toast: '分数+100',
    color: 0xa78bfa,
    squad: 0,
    coins: 0,
    score: 100,
    damage: 0,
    attackSpeed: 0,
    shield: 0,
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
  // 武器等级 = 装备数量（本体 + 编队成员），上限与编队上限保持一致（单一真源）
  maxWeaponLevel: PLAYER.maxSquadSize,
  maxedBonusScore: 50,
} as const;

/**
 * 装备生命系统：装备数量既是火力（每个装备独立射击）也是生命（受伤掉装备）。
 * 装备归零（只剩本体时再受伤）即 Game Over。
 */
export const EQUIPMENT = {
  /** 开局装备数量（本体 + 1 名跟随成员）。 */
  start: 2,
  /** 装备上限 = 编队上限（单一真源，8）。 */
  max: PLAYER.maxSquadSize,
  /** 受伤后的无敌时间：期间不重复扣装备。 */
  invincibleMs: 900,
  /** 护盾最多保留层数。 */
  shieldMax: 1,
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
