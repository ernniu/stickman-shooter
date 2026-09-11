import Phaser from 'phaser';

import { CLOUD_LAYERS, OPEN_RUNWAY, RUNWAY } from '@/game/gameConfig';
import { getLaneBoundsAtY } from './perspective';
import { GAME_HEIGHT, GAME_WIDTH, gameUnits } from '@/rendering';

export const TEX = {
  player: 'tex-stickman-player',
  playerRun1: 'tex-stickman-player-run1',
  enemy: 'tex-stickman-enemy',
  enemyRun1: 'tex-stickman-enemy-run1',
  bullet: 'tex-bullet',
  powerUp: 'tex-powerup',
  sky: 'tex-sky',
  coin: 'tex-coin',
  rewardBox: 'tex-reward-box',
  barrel: 'tex-explosive-barrel',
  enemyBullet: 'tex-enemy-bullet',
  numberWall: 'tex-number-wall',
  boss: 'tex-boss',
  sun: 'tex-sun',
  vignette: 'tex-vignette',
} as const;

const STICKMAN_W = 240;
const STICKMAN_H = 340;
export const COIN_TEXTURE_SIZE = 96;

type CanvasDraw = (ctx: CanvasRenderingContext2D) => void;

const ensureCanvasTexture = (
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: CanvasDraw,
): void => {
  if (scene.textures.exists(key)) {
    return;
  }
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    throw new Error(`Failed to create canvas texture: ${key}`);
  }
  draw(texture.getContext());
  texture.refresh();
};

const drawStickman = (
  ctx: CanvasRenderingContext2D,
  color: string,
  withFace: boolean,
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.arc(STICKMAN_W / 2, 64, 44, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(STICKMAN_W / 2, 108);
  ctx.lineTo(STICKMAN_W / 2, 224);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(STICKMAN_W / 2, 140);
  ctx.lineTo(56, 92);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(STICKMAN_W / 2, 140);
  ctx.lineTo(184, 92);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(STICKMAN_W / 2, 224);
  ctx.lineTo(76, 326);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(STICKMAN_W / 2, 224);
  ctx.lineTo(164, 326);
  ctx.stroke();

  if (withFace) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(105, 58, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(135, 58, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.arc(107, 60, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(137, 60, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** 首次调用时生成全部程序化纹理，之后重复调用为空操作。 */
export const ensureGameTextures = (scene: Phaser.Scene): void => {
  ensureCanvasTexture(scene, TEX.player, STICKMAN_W, STICKMAN_H, (ctx) => {
    drawStickman(ctx, '#1f2937', false);
  });

  ensureCanvasTexture(scene, TEX.enemy, STICKMAN_W, STICKMAN_H, (ctx) => {
    drawStickman(ctx, '#e5484d', true);
  });

  ensureCanvasTexture(scene, TEX.bullet, 56, 112, (ctx) => {
    // 外发光柔光晕
    const glow = ctx.createRadialGradient(28, 30, 4, 28, 30, 26);
    glow.addColorStop(0, 'rgba(255, 224, 248, 0.95)');
    glow.addColorStop(1, 'rgba(255, 138, 194, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 56, 60);

    // 向下渐隐的长尾焰
    const gradient = ctx.createLinearGradient(0, 16, 0, 112);
    gradient.addColorStop(0, 'rgba(255, 182, 224, 1)');
    gradient.addColorStop(0.45, 'rgba(255, 138, 194, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 138, 194, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(12, 20);
    ctx.lineTo(44, 20);
    ctx.lineTo(34, 112);
    ctx.lineTo(22, 112);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff8ac2';
    ctx.beginPath();
    ctx.arc(28, 28, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.beginPath();
    ctx.arc(28, 22, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  ensureCanvasTexture(scene, TEX.powerUp, 160, 160, (ctx) => {
    ctx.fillStyle = 'rgba(167,139,250,0.35)';
    ctx.beginPath();
    ctx.arc(80, 80, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath();
    ctx.arc(80, 80, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(58, 96);
    ctx.lineTo(80, 66);
    ctx.lineTo(102, 96);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(58, 124);
    ctx.lineTo(80, 94);
    ctx.lineTo(102, 124);
    ctx.stroke();
  });

  ensureCanvasTexture(scene, TEX.boss, 128, 128, (ctx) => {
    // 大型机械怪：红紫装甲 + 独眼 + 底部炮口
    ctx.fillStyle = '#4c1d95';
    ctx.fillRect(16, 14, 96, 100);
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 12;
    ctx.strokeRect(16, 14, 96, 100);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(16, 58, 96, 22);
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(64, 48, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(64, 48, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(64, 48, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#312e81';
    for (const [rx, ry] of [
      [30, 88],
      [64, 88],
      [98, 88],
    ]) {
      ctx.fillRect(rx - 8, ry, 16, 16);
    }
  });

  ensureCanvasTexture(scene, TEX.numberWall, 128, 148, (ctx) => {
    // 机械路障：浅灰白板体（由运行时 tint 上色 红/橙/灰）+ 深色厚描边 + 四角铆钉
    ctx.fillStyle = '#dbe2ea';
    ctx.fillRect(10, 12, 108, 124);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 12, 108, 124);
    ctx.fillStyle = '#475569';
    for (const [rx, ry] of [
      [26, 28],
      [102, 28],
      [26, 120],
      [102, 120],
    ]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(20, 18, 60, 10);
  });

  ensureCanvasTexture(scene, TEX.enemyBullet, 64, 64, (ctx) => {
    // 敌方能量弹：外圈橙色光晕 + 红色弹体 + 白色核心
    const glow = ctx.createRadialGradient(32, 32, 6, 32, 32, 32);
    glow.addColorStop(0, 'rgba(255, 120, 60, 0.9)');
    glow.addColorStop(0.6, 'rgba(239, 68, 68, 0.55)');
    glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(32, 32, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 235, 220, 0.95)';
    ctx.beginPath();
    ctx.arc(32, 32, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  ensureCanvasTexture(scene, TEX.rewardBox, 128, 128, (ctx) => {
    // 木箱：棕色箱体 + 金色包边高光 + 问号标识
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(14, 22, 100, 92);
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 22, 100, 92);
    ctx.strokeStyle = '#a0672f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(14, 22);
    ctx.lineTo(114, 114);
    ctx.moveTo(114, 22);
    ctx.lineTo(14, 114);
    ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 64, 70);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(20, 26, 40, 10);
  });

  ensureCanvasTexture(scene, TEX.barrel, 128, 128, (ctx) => {
    // 爆炸桶：红橙桶身 + 黄黑危险条纹 + 感叹号
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(28, 20, 72, 92);
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(24, 14, 80, 14);
    ctx.fillRect(24, 104, 80, 14);
    ctx.fillStyle = '#facc15';
    for (let index = 0; index < 3; index += 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(28, 40 + index * 22, 72, 12);
      ctx.clip();
      ctx.translate(28 + index * 12, 0);
      ctx.fillRect(0, 40 + index * 22, 12, 12);
      ctx.fillRect(24, 40 + index * 22, 12, 12);
      ctx.fillRect(48, 40 + index * 22, 12, 12);
      ctx.fillRect(72, 40 + index * 22, 12, 12);
      ctx.restore();
    }
    ctx.fillStyle = '#fff7ed';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 64, 88);
  });

  ensureCanvasTexture(scene, TEX.coin, COIN_TEXTURE_SIZE, COIN_TEXTURE_SIZE, (ctx) => {
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(48, 48, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(48, 48, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(48, 48, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(34, 32, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  ensureCanvasTexture(scene, TEX.sky, 8, 512, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#2b6cb8');
    gradient.addColorStop(0.4, '#5ba3dd');
    gradient.addColorStop(0.7, '#9ed2f2');
    gradient.addColorStop(1, '#eef9ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 512);
  });

  ensureCanvasTexture(scene, TEX.sun, 256, 256, (ctx) => {
    const gradient = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 246, 214, 0.95)');
    gradient.addColorStop(0.4, 'rgba(255, 236, 190, 0.45)');
    gradient.addColorStop(1, 'rgba(255, 236, 190, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  });


};

/**
 * 可选素材槽位：key 与 assets.ts 的 OPTIONAL_IMAGES 对应。
 * 支持图片素材时优先使用，缺失时回退到下面的程序化纹理。
 */
export const OPTIONAL_TEX = {
  player: 'player_sprite',
  enemy: 'enemy_normal_sprite',
  bullet: 'bullet_sprite',
  powerUp: 'powerup_weapon_sprite',
  coin: 'coin_sprite',
  gateSquad: 'gate_squad_sprite',
  gateCoin: 'gate_coin_sprite',
  gateScore: 'gate_score_sprite',
  gateRage: 'gate_rage_sprite',
  backgroundSky: 'background_sky',
  cloudFar: 'cloud_layer_far',
  cloudNear: 'cloud_layer_near',
  hitSpark: 'hit_spark_sprite',
  rewardBox: 'reward_box_sprite',
  barrel: 'explosive_barrel_sprite',
  rangedEnemy: 'enemy_ranged_sprite',
  enemyBullet: 'enemy_bullet_sprite',
  numberWall: 'number_wall_sprite',
  boss: 'boss_sprite',
} as const;

export type OptionalTexSlot = keyof typeof OPTIONAL_TEX;

/**
 * 解析最终使用的纹理 key：
 * 素材已成功加载 → 用素材；否则 → 用程序化纹理兜底。
 */
export const resolveTexture = (
  scene: Phaser.Scene,
  slot: OptionalTexSlot,
  fallback: string,
): string =>
  scene.textures.exists(OPTIONAL_TEX[slot]) ? OPTIONAL_TEX[slot] : fallback;

/** 可选素材是否存在（用于"有素材才播"的效果，如命中火花）。 */
export const hasOptionalTexture = (
  scene: Phaser.Scene,
  slot: OptionalTexSlot,
): boolean => scene.textures.exists(OPTIONAL_TEX[slot]);

/** 注册两帧跑步动画（重复调用安全）。 */
export const registerRunAnimations = (scene: Phaser.Scene): void => {
  if (!scene.anims.exists('player-run')) {
    scene.anims.create({
      key: 'player-run',
      frames: [{ key: TEX.player }, { key: TEX.playerRun1 }],
      frameRate: 7,
      repeat: -1,
    });
  }
  if (!scene.anims.exists('enemy-run')) {
    scene.anims.create({
      key: 'enemy-run',
      frames: [{ key: TEX.enemy }, { key: TEX.enemyRun1 }],
      frameRate: 7,
      repeat: -1,
    });
  }
};

/** 全屏背景：优先 background_sky 素材，否则蓝天渐变 + 太阳光晕（程序化绘制）。 */
export const addSkyBackground = (scene: Phaser.Scene): void => {
  if (hasOptionalTexture(scene, 'backgroundSky')) {
    scene.add
      .image(0, 0, OPTIONAL_TEX.backgroundSky)
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-10);
    return;
  }

  scene.add
    .image(0, 0, TEX.sky)
    .setOrigin(0, 0)
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    .setDepth(-10);

  scene.add
    .image(GAME_WIDTH * 0.78, GAME_HEIGHT * 0.06, TEX.sun)
    .setDisplaySize(GAME_WIDTH * 0.6, GAME_WIDTH * 0.6)
    .setDepth(-9.9)
    .setAlpha(0.6);
};

export const createCloud = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  alpha: number,
): Phaser.GameObjects.Graphics => {
  const radius = gameUnits(70) * scale;
  const cloud = scene.add.graphics().setDepth(-8).setAlpha(alpha);
  cloud.fillStyle(0xffffff, 1);
  cloud.fillCircle(0, 0, radius);
  cloud.fillCircle(radius * 0.95, radius * 0.25, radius * 0.72);
  cloud.fillCircle(-radius * 0.95, radius * 0.3, radius * 0.62);
  cloud.setPosition(x, y);
  return cloud;
};

/**
 * 云层：优先使用 cloud_layer_far / cloud_layer_near 素材并做视差滚动
 * （远层慢、近层快），缺失的层回退到程序化 Graphics 云。
 */
export class CloudField {
  private readonly clouds: Array<{
    cloud: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
    speed: number;
  }> = [];

  constructor(scene: Phaser.Scene, count = 6) {
    const spawnImageLayer = (
      slot: OptionalTexSlot,
      widthRatio: number,
      speedRatio: number,
      depth: number,
      instances: number,
    ): number => {
      if (!hasOptionalTexture(scene, slot)) {
        return 0;
      }
      for (let index = 0; index < instances; index += 1) {
        const width = GAME_WIDTH * (widthRatio * (0.75 + Math.random() * 0.5));
        const image = scene.add
          .image(0, 0, OPTIONAL_TEX[slot])
          .setDisplaySize(width, width)
          .setDepth(depth)
          .setAlpha(0.7 + Math.random() * 0.3);
        image.setPosition(
          Math.random() * GAME_WIDTH,
          Math.random() * GAME_HEIGHT * 0.85,
        );
        this.clouds.push({
          cloud: image,
          speed:
            CLOUD_LAYERS.baseSpeed * speedRatio +
            Math.random() * CLOUD_LAYERS.speedJitter,
        });
      }
      return instances;
    };

    // 素材层：远层一半、近层一半；某层缺素材时名额让给程序化云
    let spawned = spawnImageLayer(
      'cloudFar',
      CLOUD_LAYERS.farWidthRatio,
      CLOUD_LAYERS.farSpeedRatio,
      CLOUD_LAYERS.farDepth,
      Math.ceil(count / 2),
    );
    spawned += spawnImageLayer(
      'cloudNear',
      CLOUD_LAYERS.nearWidthRatio,
      CLOUD_LAYERS.nearSpeedRatio,
      CLOUD_LAYERS.nearDepth,
      Math.floor(count / 2),
    );

    for (let index = spawned; index < count; index += 1) {
      const scale = 0.55 + Math.random() * 0.85;
      const cloud = createCloud(
        scene,
        Math.random() * GAME_WIDTH,
        Math.random() * GAME_HEIGHT * 0.85,
        scale,
        0.5 + Math.random() * 0.35,
      );
      this.clouds.push({
        cloud,
        speed: gameUnits(60) + Math.random() * gameUnits(90),
      });
    }
  }

  update(deltaSeconds: number): void {
    for (const entry of this.clouds) {
      entry.cloud.y += entry.speed * deltaSeconds;
      if (entry.cloud.y > GAME_HEIGHT + CLOUD_LAYERS.wrapMargin) {
        entry.cloud.y = -CLOUD_LAYERS.wrapMargin;
        entry.cloud.x = Math.random() * GAME_WIDTH;
      }
    }
  }
}

type Vec = { x: number; y: number };

/** 云端跑道（透视梯形）：灰白实体路面 + 深色厚边 + 白色高光线 + 明暗条纹。 */
export const drawRunway = (
  scene: Phaser.Scene,
): { laneLeft: number; laneRight: number } => {
  const graphics = scene.add.graphics().setDepth(-9);
  const steps = 24;
  const yAt = (index: number): number => (GAME_HEIGHT * index) / steps;

  // 左右边缘采样点（自上而下）
  const leftEdge: Vec[] = [];
  const rightEdge: Vec[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const bounds = getLaneBoundsAtY(yAt(index));
    leftEdge.push({ x: bounds.left, y: yAt(index) });
    rightEdge.push({ x: bounds.right, y: yAt(index) });
  }

  // 开口段：该线以下护栏断开、边线渐隐（形成可滑出的云端赛道边缘）
  const openY = GAME_HEIGHT * OPEN_RUNWAY.openStartYRatio;
  const edgeUntil = (edge: Vec[], limit: number): Vec[] => {
    const result: Vec[] = [];
    for (const point of edge) {
      if (point.y <= limit) {
        result.push(point);
      } else {
        const prev = result[result.length - 1];
        if (prev) {
          const t = (limit - prev.y) / (point.y - prev.y);
          result.push({ x: prev.x + (point.x - prev.x) * t, y: limit });
        }
        break;
      }
    }
    return result;
  };
  const edgeFrom = (edge: Vec[], start: number): Vec[] => {
    const step = GAME_HEIGHT / (edge.length - 1);
    const index = Math.min(
      edge.length - 1,
      Math.max(0, Math.floor(start / step)),
    );
    const a = edge[index];
    const b = edge[Math.min(index + 1, edge.length - 1)];
    const f = (start - a.y) / Math.max(b.y - a.y, 1);
    const head = { x: a.x + (b.x - a.x) * f, y: start };
    return [head, ...edge.filter((point) => point.y > start)];
  };

  // 两侧深色厚边（沿透视边缘的斜带）——开口段以下断开
  const buildBand = (edge: Vec[], outward: number): Vec[] => [
    ...edge,
    ...[...edge].reverse().map((point) => ({ x: point.x + outward, y: point.y })),
  ];
  graphics.fillStyle(RUNWAY.roadEdgeColor, RUNWAY.roadEdgeAlpha);
  graphics.fillPoints(buildBand(edgeUntil(leftEdge, openY), -RUNWAY.sideWidth), true);
  graphics.fillPoints(buildBand(edgeUntil(rightEdge, openY), RUNWAY.sideWidth), true);

  // 路面（灰白实体梯形）
  graphics.fillStyle(RUNWAY.roadColor, 1);
  graphics.fillPoints([...leftEdge, ...[...rightEdge].reverse()], true);

  // 明暗交替条纹：每格为一段梯形，随透视变宽
  for (
    let y = 0, index = 0;
    y < GAME_HEIGHT;
    y += RUNWAY.stripeHeight, index += 1
  ) {
    if (index % 2 !== 0) {
      continue;
    }
    const yNext = Math.min(y + RUNWAY.stripeHeight, GAME_HEIGHT);
    const near = getLaneBoundsAtY(y);
    const far = getLaneBoundsAtY(yNext);
    graphics.fillStyle(RUNWAY.stripeColor, RUNWAY.stripeAlpha);
    graphics.fillPoints(
      [
        { x: near.left + gameUnits(10), y },
        { x: near.right - gameUnits(10), y },
        { x: far.right - gameUnits(10), y: yNext },
        { x: far.left + gameUnits(10), y: yNext },
      ],
      true,
    );
  }

  // 外侧深色边线（厚）+ 内侧白色高光线（细）：开口线以上完整，以下分段渐隐
  graphics.lineStyle(gameUnits(12), RUNWAY.roadEdgeColor, RUNWAY.roadEdgeAlpha);
  graphics.strokePoints(edgeUntil(leftEdge, openY), false);
  graphics.strokePoints(edgeUntil(rightEdge, openY), false);
  graphics.lineStyle(
    gameUnits(5),
    0xffffff,
    RUNWAY.edgeHighlightAlpha,
  );
  graphics.strokePoints(
    edgeUntil(leftEdge, openY).map((point) => ({ x: point.x + gameUnits(16), y: point.y })),
    false,
  );
  graphics.strokePoints(
    edgeUntil(rightEdge, openY).map((point) => ({ x: point.x - gameUnits(16), y: point.y })),
    false,
  );

  // 开口段边线渐隐（3 段递减），提示"这里没有护栏"
  const fadeSegments = 3;
  const fadeAlphas = [0.5, 0.25, 0.08];
  for (const edge of [leftEdge, rightEdge]) {
    for (let seg = 0; seg < fadeSegments; seg += 1) {
      const from = openY + ((GAME_HEIGHT - openY) * seg) / fadeSegments;
      const to = openY + ((GAME_HEIGHT - openY) * (seg + 1)) / fadeSegments;
      graphics.lineStyle(gameUnits(12), RUNWAY.roadEdgeColor, fadeAlphas[seg]);
      graphics.strokePoints(edgeFrom(edge, from).concat([pointAt(edge, Math.min(to, GAME_HEIGHT))]), false);
    }
  }

  const bottom = getLaneBoundsAtY(GAME_HEIGHT);
  return { laneLeft: bottom.left, laneRight: bottom.right };
};

/** 边缘采样点上按 y 线性插值取点（drawRunway 内部辅助）。 */
const pointAt = (edge: Vec[], y: number): Vec => {
  const step = GAME_HEIGHT / (edge.length - 1);
  const index = Math.min(edge.length - 2, Math.max(0, Math.floor(y / step)));
  const a = edge[index];
  const b = edge[index + 1];
  const f = (y - a.y) / Math.max(b.y - a.y, 1);
  return { x: a.x + (b.x - a.x) * f, y };
};

/** 危险线：红色虚线 + 底部警示区。 */
export const drawDangerLine = (
  scene: Phaser.Scene,
  y: number,
  laneLeft: number,
  laneRight: number,
): void => {
  const graphics = scene.add.graphics().setDepth(-5);
  // 半透明渐变警戒区：越靠底部越红，替代原来的“调试线”观感
  graphics.fillGradientStyle(
    0xff4d4f,
    0xff4d4f,
    0xff4d4f,
    0xff4d4f,
    0,
    0,
    0.18,
    0.18,
  );
  graphics.fillRect(0, y, GAME_WIDTH, GAME_HEIGHT - y);
  graphics.lineStyle(gameUnits(6), 0xff4d4f, 0.45);
  const dashWidth = gameUnits(96);
  const dashGap = gameUnits(72);
  for (let x = laneLeft; x < laneRight; x += dashWidth + dashGap) {
    graphics.lineBetween(x, y, Math.min(x + dashWidth, laneRight), y);
  }
};
