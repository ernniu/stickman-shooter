import Phaser from 'phaser';

import { RUNWAY } from '@/game/gameConfig';
import { getLaneBoundsAtY } from './perspective';
import {
  GAME_CENTER_X,
  GAME_CENTER_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  gameUnits,
} from '@/rendering';

export const TEX = {
  player: 'tex-stickman-player',
  playerRun1: 'tex-stickman-player-run1',
  enemy: 'tex-stickman-enemy',
  enemyRun1: 'tex-stickman-enemy-run1',
  bullet: 'tex-bullet',
  powerUp: 'tex-powerup',
  sky: 'tex-sky',
  coin: 'tex-coin',
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

  ensureCanvasTexture(scene, TEX.bullet, 36, 72, (ctx) => {
    // 粉色光弹：上亮弹头 + 向下渐隐的三角尾焰（参照效果图的弹幕观感）。
    const gradient = ctx.createLinearGradient(0, 10, 0, 72);
    gradient.addColorStop(0, 'rgba(249, 168, 212, 0.9)');
    gradient.addColorStop(0.5, 'rgba(244, 114, 182, 0.45)');
    gradient.addColorStop(1, 'rgba(244, 114, 182, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(8, 14);
    ctx.lineTo(28, 14);
    ctx.lineTo(21, 72);
    ctx.lineTo(15, 72);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(18, 18, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(18, 14, 8, 0, Math.PI * 2);
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

  ensureCanvasTexture(scene, TEX.vignette, 512, 512, (ctx) => {
    const gradient = ctx.createRadialGradient(256, 256, 140, 256, 256, 320);
    gradient.addColorStop(0, 'rgba(10, 22, 44, 0)');
    gradient.addColorStop(1, 'rgba(10, 22, 44, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
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

/** 全屏背景：蓝天渐变 + 太阳光晕 + 远景云海 + 四角暗角，全部程序化绘制。 */
export const addSkyBackground = (scene: Phaser.Scene): void => {
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

  // 远景云海：两层静态波浪剪影，垫在跑道之后
  const sea = scene.add.graphics().setDepth(-9.8);
  const waveLayer = (
    yBase: number,
    amplitude: number,
    wavelength: number,
    band: number,
    color: number,
    alpha: number,
  ): void => {
    sea.fillStyle(color, alpha);
    sea.beginPath();
    sea.moveTo(0, yBase + band);
    sea.lineTo(0, yBase);
    for (let x = 0; x <= GAME_WIDTH; x += 24) {
      sea.lineTo(
        x,
        yBase + Math.sin((x / wavelength) * Math.PI * 2) * amplitude,
      );
    }
    sea.lineTo(GAME_WIDTH, yBase);
    sea.lineTo(GAME_WIDTH, yBase + band);
    sea.closePath();
    sea.fillPath();
  };
  waveLayer(
    GAME_HEIGHT * 0.09,
    gameUnits(70),
    gameUnits(900),
    GAME_HEIGHT * 0.22,
    0xffffff,
    0.4,
  );
  waveLayer(
    GAME_HEIGHT * 0.13,
    gameUnits(90),
    gameUnits(1300),
    GAME_HEIGHT * 0.24,
    0xdbeeff,
    0.5,
  );

  scene.add
    .image(GAME_CENTER_X, GAME_CENTER_Y, TEX.vignette)
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    .setDepth(-3);
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

/** 云层按各自速度向下漂移，出屏后回到顶部形成循环。 */
export class CloudField {
  private readonly clouds: Array<{
    cloud: Phaser.GameObjects.Graphics;
    speed: number;
  }> = [];

  constructor(scene: Phaser.Scene, count = 6) {
    for (let index = 0; index < count; index += 1) {
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
      if (entry.cloud.y > GAME_HEIGHT + gameUnits(220)) {
        entry.cloud.y = -gameUnits(220);
        entry.cloud.x = Math.random() * GAME_WIDTH;
      }
    }
  }
}

type Vec = { x: number; y: number };

/** 云端跑道（透视梯形）：上窄下宽 + 护栏阴影带 + 明暗条纹 + 边缘白线。 */
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

  // 两侧护栏阴影带（沿透视边缘的斜带，伪厚度）
  const buildBand = (edge: Vec[], outward: number): Vec[] => [
    ...edge,
    ...[...edge].reverse().map((point) => ({ x: point.x + outward, y: point.y })),
  ];
  graphics.fillStyle(0x274b73, 0.3);
  graphics.fillPoints(buildBand(leftEdge, -RUNWAY.sideWidth), true);
  graphics.fillPoints(buildBand(rightEdge, RUNWAY.sideWidth), true);

  // 路面（梯形）
  graphics.fillStyle(0xffffff, 0.18);
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
    graphics.fillStyle(0xffffff, 0.07);
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

  // 边缘白实线（跟随透视斜边）
  graphics.lineStyle(gameUnits(10), 0xffffff, 0.75);
  graphics.strokePoints(leftEdge, false);
  graphics.strokePoints(rightEdge, false);

  const bottom = getLaneBoundsAtY(GAME_HEIGHT);
  return { laneLeft: bottom.left, laneRight: bottom.right };
};

/** 危险线：红色虚线 + 底部警示区。 */
export const drawDangerLine = (
  scene: Phaser.Scene,
  y: number,
  laneLeft: number,
  laneRight: number,
): void => {
  const graphics = scene.add.graphics().setDepth(-5);
  graphics.fillStyle(0xff4d4f, 0.1);
  graphics.fillRect(0, y, GAME_WIDTH, GAME_HEIGHT - y);
  graphics.lineStyle(gameUnits(10), 0xff4d4f, 0.9);
  const dashWidth = gameUnits(64);
  const dashGap = gameUnits(44);
  for (let x = laneLeft; x < laneRight; x += dashWidth + dashGap) {
    graphics.lineBetween(x, y, Math.min(x + dashWidth, laneRight), y);
  }
};
