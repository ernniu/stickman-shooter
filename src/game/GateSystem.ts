import Phaser from 'phaser';

import {
  GAME_CENTER_X,
  GAME_HEIGHT,
  GAME_WIDTH,
  gamePixels,
  gameUnits,
} from '@/rendering';

import { GATE, GATE_REWARDS, type GateKind, type GateReward } from './gameConfig';
import {
  getDepthAtY,
  getLaneBoundsAtY,
  getLaneHalfWidthAtY,
  getPerspectiveScaleAtY,
} from './perspective';
import {
  OPTIONAL_TEX,
  hasOptionalTexture,
  type OptionalTexSlot,
} from './textures';
import { FONT_FAMILY } from './ui';

interface Gate {
  container: Phaser.GameObjects.Container;
  visual: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  /** 车道位置（-1 ~ 1），用于沿透视跑道横向分布 */
  laneU: number;
  kind: GateKind;
  width: number;
  height: number;
}

/** 门类型 → 可选素材槽位（成长门暂无素材，走 Graphics 圆角牌兜底）。 */
const GATE_TEX_SLOT: Partial<Record<GateKind, OptionalTexSlot>> = {
  squad: 'gateSquad',
  coin: 'gateCoin',
  score: 'gateScore',
};

/**
 * 跑道增益门（选择门）：一组两个门，随跑道向下移动，
 * 玩家或任意编队成员碰到其中一个即触发，同组另一扇同时消失。
 */
export class GateSystem {
  private groups: Gate[][] = [];
  private lastSpawnAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onPick: (
      reward: GateReward,
      x: number,
      y: number,
    ) => void,
  ) {}

  /** 重开一局时清空状态。 */
  reset(): void {
    this.clear();
    this.lastSpawnAt = Number.NEGATIVE_INFINITY;
  }

  /** 销毁全部门（场景关闭或重开时调用）。 */
  clear(): void {
    for (const group of this.groups) {
      for (const gate of group) {
        this.destroyGate(gate);
      }
    }
    this.groups = [];
  }

  /** 波次开始时按需生成一组门（波次规则已与道具错开）。 */
  onWaveStart(wave: number): void {
    if (wave < GATE.startWave) {
      return;
    }
    if ((wave - GATE.startWave) % GATE.everyWaves !== 0) {
      return;
    }
    const now = this.scene.time.now;
    if (now - this.lastSpawnAt < GATE.minIntervalMs) {
      return;
    }
    if (this.groups.length > 0) {
      // 同屏最多一组，避免画面过乱
      return;
    }

    this.spawnGroup();
    this.lastSpawnAt = now;
  }

  update(
    deltaSeconds: number,
    members: Phaser.Physics.Arcade.Sprite[],
  ): void {
    for (let index = this.groups.length - 1; index >= 0; index -= 1) {
      const group = this.groups[index];
      let picked: Gate | null = null;

      for (const gate of group) {
        gate.container.y += GATE.speed * deltaSeconds;
        const y = gate.container.y;
        // 沿透视车道横向分布 + 缩放 + 层级排序
        const halfWidth = getLaneHalfWidthAtY(y);
        gate.container.x = GAME_CENTER_X + gate.laneU * halfWidth * 0.9;
        gate.container.setScale(getPerspectiveScaleAtY(y));
        gate.container.setDepth(getDepthAtY(y));
        if (!picked && this.hitsMember(gate, members)) {
          picked = gate;
        }
      }

      if (picked) {
        const reward = GATE_REWARDS[picked.kind];
        const x = picked.container.x;
        const y = picked.container.y;
        this.destroyGroup(group);
        this.groups.splice(index, 1);
        this.onPick(reward, x, y);
        continue;
      }

      // 离屏销毁
      const last = group[group.length - 1];
      if (last && last.container.y > GAME_HEIGHT + last.height) {
        this.destroyGroup(group);
        this.groups.splice(index, 1);
      }
    }
  }

  private spawnGroup(): void {
    const spawnY = GAME_HEIGHT * GATE.spawnYRatio;
    const gap = GAME_WIDTH * GATE.gapRatio;
    const spawnBounds = getLaneBoundsAtY(spawnY);
    // 门宽受该 y 处跑道可用宽度限制，保证两扇门互不重叠
    const usable = spawnBounds.width - gap - gameUnits(48);
    const width = Math.max(
      gameUnits(140),
      Math.min(GAME_WIDTH * GATE.widthRatio, usable / 2),
    );
    const height = GAME_HEIGHT * GATE.heightRatio;
    const kinds = this.pickKinds();
    const halfWidthAtSpawn = getLaneHalfWidthAtY(spawnY);
    const laneOffset = Math.min(
      0.8,
      (width + gap) / 2 / Math.max(halfWidthAtSpawn * 0.9, 1),
    );
    const laneUs = [-laneOffset, laneOffset];

    const group: Gate[] = kinds.map((kind, index) => {
      const gate = this.createGate(kind, width, height, spawnY);
      gate.laneU = laneUs[index];
      gate.container.x = GAME_CENTER_X + gate.laneU * getLaneHalfWidthAtY(spawnY) * 0.9;
      return gate;
    });
    this.groups.push(group);
  }

  /** 从配置的组合池随机取一组成长门（左右奖励必定不同）。 */
  private pickKinds(): GateKind[] {
    const pairs = GATE.growthPairs;
    const pair = pairs[Phaser.Math.Between(0, pairs.length - 1)];
    return [pair[0], pair[1]];
  }

  private createGate(
    kind: GateKind,
    width: number,
    height: number,
    y: number,
  ): Gate {
    const reward = GATE_REWARDS[kind];
    // 优先使用门素材图（显示尺寸仍由代码控制），缺失时回退 Graphics 圆角牌
    let visual: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
    const texSlot = GATE_TEX_SLOT[kind];
    if (texSlot && hasOptionalTexture(this.scene, texSlot)) {
      visual = this.scene.add
        .image(0, 0, OPTIONAL_TEX[texSlot])
        .setDisplaySize(width, height);
    } else {
      const board = this.scene.add.graphics();
      // 投影：偏移的深色圆角矩形，制造立体感
      board.fillStyle(0x0f172a, 0.35);
      board.fillRoundedRect(
        -width / 2 + gameUnits(8),
        -height / 2 + gameUnits(14),
        width,
        height,
        Math.min(height / 2, width / 2),
      );
      // 门体
      board.fillStyle(reward.color, 0.95);
      board.fillRoundedRect(
        -width / 2,
        -height / 2,
        width,
        height,
        Math.min(height / 2, width / 2),
      );
      // 厚描边
      board.lineStyle(gameUnits(10), 0xffffff, 0.95);
      board.strokeRoundedRect(
        -width / 2,
        -height / 2,
        width,
        height,
        Math.min(height / 2, width / 2),
      );
      // 顶部高光条
      board.fillStyle(0xffffff, 0.28);
      board.fillRoundedRect(
        -width / 2 + gameUnits(14),
        -height / 2 + gameUnits(12),
        width - gameUnits(28),
        gameUnits(16),
        gameUnits(8),
      );
      visual = board;
    }

    const label = this.scene.add
      .text(0, 0, reward.label, {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(GATE.fontSize),
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(6))
      .setShadow(0, gameUnits(3), 'rgba(15, 23, 42, 0.55)', gameUnits(4));

    const container = this.scene.add.container(GAME_CENTER_X, y, [
      visual,
      label,
    ]);
    // 淡入，避免门突然出现
    container.setAlpha(0);
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 220,
      ease: 'Quad.out',
    });
    // 呼吸动画作用于内部元素，避免与每帧的透视缩放互相覆盖
    this.scene.tweens.add({
      targets: [visual, label],
      scale: GATE.pulseScale,
      duration: GATE.pulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    return { container, visual, label, laneU: 0, kind, width, height };
  }

  private hitsMember(
    gate: Gate,
    members: Phaser.Physics.Arcade.Sprite[],
  ): boolean {
    const scale = gate.container.scale;
    const halfW = (gate.width * scale) / 2;
    const halfH = (gate.height * scale) / 2;
    for (const member of members) {
      if (!member.active) {
        continue;
      }
      const memberHalfW = member.displayWidth * 0.35;
      const memberHalfH = member.displayHeight * 0.35;
      if (
        Math.abs(member.x - gate.container.x) < halfW + memberHalfW &&
        Math.abs(member.y - gate.container.y) < halfH + memberHalfH
      ) {
        return true;
      }
    }
    return false;
  }

  private destroyGroup(group: Gate[]): void {
    for (const gate of group) {
      this.destroyGate(gate);
    }
  }

  private destroyGate(gate: Gate): void {
    this.scene.tweens.killTweensOf([gate.visual, gate.label, gate.container]);
    gate.container.destroy();
  }
}
