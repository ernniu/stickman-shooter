/**
 * 关卡片段配置与流程系统（v2.6）。
 * 第一关固定 8 段：战斗 → 选择 → 奖励 → 战斗 → Boss。
 */

import type { GateKind } from './gameConfig';

export type SegmentType =
  | 'combat'
  | 'gate'
  | 'reward'
  | 'ranged'
  | 'walls'
  | 'boss';

export type SegmentCompletion =
  | 'enemies-cleared'
  | 'gate-resolved'
  | 'reward-resolved'
  | 'walls-resolved'
  | 'boss-defeated';

export interface LevelSegment {
  readonly type: SegmentType;
  /** 段开始横幅提示。 */
  readonly hint: string;
  /** 内部难度参数：映射敌人血量/速度/掉落波次公式（HUD 不显示）。 */
  readonly difficultyWave: number;
  /** 本段敌人数（缺省按 difficultyWave 公式）。Boss 段为 0。 */
  readonly enemyCount?: number;
  /** 是否允许远程敌人生成。 */
  readonly allowRanged?: boolean;
  /** 批次生成：每批数量与间隔（缺省逐个按 ENEMY.spawnIntervalMs）。 */
  readonly spawnBatchSize?: number;
  readonly spawnBatchIntervalMs?: number;
  /** 生成纵向区域（屏幕高度比例），缺省从最顶部进入。 */
  readonly spawnYRange?: { readonly top: number; readonly bottom: number };
  /** 横向宽屏展开（更宽车道数，形成小怪群）。 */
  readonly spawnWide?: boolean;
  /** 低血量群：本段敌人固定 1 血（开局爽感用）。 */
  readonly lowHpSwarm?: boolean;
  /** 血量覆盖（优先于难度波公式与 lowHpSwarm）。 */
  readonly hpOverride?: number;
  /** 是否生成一组成长门。 */
  readonly gatePair?: boolean;
  /** 门出现延迟（毫秒，开局爽感节奏用）。 */
  readonly gateDelayMs?: number;
  /** 固定门组合（不走随机池，开局首组用）。 */
  readonly gateFixedKinds?: ReadonlyArray<GateKind>;
  /** 是否生成奖励箱。 */
  readonly rewardBox?: boolean;
  /** 爆炸桶数量。 */
  readonly barrels?: number;
  /** 数字墙形态。 */
  readonly wallsMode?: 'none' | 'single' | 'double';
  readonly completion: SegmentCompletion;
}

/**
 * 第一关固定流程（目标 2~3 分钟）：
 * 1 基础战斗+首组门 → 2 奖励箱 → 3 成长门选择+小怪 → 4 远程+爆炸桶
 * → 5 双墙+门 → 6 高压敌群+奖励箱 → 7 Boss 前最后成长门 → 8 Boss。
 */
export const LEVEL_1: ReadonlyArray<LevelSegment> = [
  {
    type: 'combat',
    hint: '迎战第一波敌群！',
    difficultyWave: 1,
    enemyCount: 14,
    spawnBatchSize: 5,
    spawnBatchIntervalMs: 380,
    spawnYRange: { top: 0.08, bottom: 0.2 },
    spawnWide: true,
    lowHpSwarm: true,
    gatePair: true,
    gateDelayMs: 7000,
    gateFixedKinds: ['squad', 'attackSpeed'],
    completion: 'enemies-cleared',
  },
  {
    type: 'reward',
    hint: '击破宝箱获取补给！',
    difficultyWave: 2,
    enemyCount: 18,
    spawnBatchSize: 5,
    spawnBatchIntervalMs: 400,
    spawnYRange: { top: 0.08, bottom: 0.2 },
    spawnWide: true,
    lowHpSwarm: true,
    rewardBox: true,
    completion: 'reward-resolved',
  },
  {
    type: 'gate',
    hint: '选择你的成长方向！',
    difficultyWave: 3,
    enemyCount: 20,
    spawnBatchSize: 5,
    spawnBatchIntervalMs: 420,
    spawnYRange: { top: 0.08, bottom: 0.2 },
    spawnWide: true,
    completion: 'gate-resolved',
  },
  {
    type: 'ranged',
    hint: '躲避子弹，善用爆炸桶！',
    difficultyWave: 4,
    enemyCount: 24,
    spawnBatchSize: 6,
    spawnBatchIntervalMs: 420,
    spawnYRange: { top: 0.08, bottom: 0.2 },
    spawnWide: true,
    allowRanged: true,
    barrels: 2,
    completion: 'enemies-cleared',
  },
  {
    type: 'walls',
    hint: '打穿数字墙，选择路线！',
    difficultyWave: 5,
    enemyCount: 14,
    spawnBatchSize: 4,
    spawnBatchIntervalMs: 450,
    wallsMode: 'double',
    gatePair: true,
    completion: 'walls-resolved',
  },
  {
    type: 'combat',
    hint: '高压敌群！坚持住！',
    difficultyWave: 5,
    enemyCount: 42,
    spawnBatchSize: 6,
    spawnBatchIntervalMs: 380,
    spawnYRange: { top: 0.08, bottom: 0.2 },
    spawnWide: true,
    hpOverride: 3,
    rewardBox: true,
    completion: 'reward-resolved',
  },
  {
    type: 'gate',
    hint: 'Boss 前的最后成长！',
    difficultyWave: 8,
    enemyCount: 16,
    spawnBatchSize: 4,
    spawnBatchIntervalMs: 450,
    gatePair: true,
    completion: 'gate-resolved',
  },
  {
    type: 'boss',
    hint: 'BOSS 来袭！',
    difficultyWave: 10,
    enemyCount: 0,
    completion: 'boss-defeated',
  },
];

/** 片段节奏配置：切换缓冲与奖励箱宽限。 */
export const LEVEL_FLOW = {
  /** 片段完成到下一段生成的缓冲（毫秒），期间显示下一段提示。 */
  transitionMs: 700,
  /** reward 段：敌人清空后箱子仍在的宽限时间，超时清理残留箱并推进。 */
  rewardGraceMs: 6000,
} as const;

/** 关卡片段查询接口：由 GameScene 注入各系统实时状态。 */
export interface SegmentStateQuery {
  /** 本段目标敌人数与已生成数。 */
  readonly spawnTarget: number;
  readonly spawnedCount: number;
  /** 屏上存活敌人 / 门组 / 奖励箱 / 数字墙 数量。 */
  readonly enemiesActive: number;
  readonly gatesActive: number;
  readonly boxesActive: number;
  readonly wallsActive: number;
  /** 当前时间（毫秒，scene.time.now），用于 reward 宽限计时。 */
  readonly now: number;
}

/**
 * 关卡片段流程系统：持有第一关的片段序列与推进状态。
 * 片段生成由 GameScene 按配置执行，本系统只负责"当前在哪一段、是否完成"。
 */
export class LevelFlowSystem {
  private index = 0;
  /** 当前片段的生成是否已执行（防止完成判定在生成前误判）。 */
  private spawned = false;
  /** reward 段：敌人清空但箱子仍在时的宽限起点（-1 表示未计时）。 */
  private rewardGraceStartAt = -1;

  reset(): void {
    this.index = 0;
    this.spawned = false;
    this.rewardGraceStartAt = -1;
  }

  /** 当前片段编号（1 起），用于对象归属标记。 */
  get segmentId(): number {
    return this.index + 1;
  }

  get segment(): LevelSegment {
    return LEVEL_1[this.index];
  }

  get progressLabel(): string {
    return `阶段 ${this.index + 1}/${LEVEL_1.length}`;
  }

  /** GameScene 执行完本段生成后调用，之后才开始完成判定。 */
  markSpawned(): void {
    this.spawned = true;
  }

  isCompleted(query: SegmentStateQuery): boolean {
    if (!this.spawned) {
      return false;
    }
    const enemiesCleared =
      query.spawnedCount >= query.spawnTarget && query.enemiesActive === 0;

    switch (this.segment.completion) {
      case 'enemies-cleared':
        return enemiesCleared;
      case 'gate-resolved':
        // 门被选/离屏后，仍需等本段敌人清空才推进
        return query.gatesActive === 0 && enemiesCleared;
      case 'walls-resolved':
        // 双墙全部处理完（打破或突破）后，仍需等本段敌人清空
        return query.wallsActive === 0 && enemiesCleared;
      case 'reward-resolved':
        // 敌人清空后给箱子宽限期：打破/离屏/超时三者之一才推进
        if (!enemiesCleared) {
          this.rewardGraceStartAt = -1;
          return false;
        }
        if (query.boxesActive === 0) {
          this.rewardGraceStartAt = -1;
          return true;
        }
        if (this.rewardGraceStartAt < 0) {
          this.rewardGraceStartAt = query.now;
          return false;
        }
        return query.now - this.rewardGraceStartAt >= LEVEL_FLOW.rewardGraceMs;
      case 'boss-defeated':
        // Boss 段由 onBossDefeated 直接推进到关卡结算，不走此判定
        return false;
    }
  }

  /** 推进到下一段（末段原地不动，由关卡结算流程接管）。 */
  advance(): void {
    this.index = Math.min(this.index + 1, LEVEL_1.length - 1);
    this.spawned = false;
    this.rewardGraceStartAt = -1;
  }
}
