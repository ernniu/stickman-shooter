import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH, gameUnits } from '@/rendering';

export const TEX = {
  player: 'tex-stickman-player',
  enemy: 'tex-stickman-enemy',
  bullet: 'tex-bullet',
  powerUp: 'tex-powerup',
  sky: 'tex-sky',
} as const;

const STICKMAN_W = 240;
const STICKMAN_H = 340;

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

  ensureCanvasTexture(scene, TEX.bullet, 36, 36, (ctx) => {
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.arc(18, 18, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(13, 13, 5, 0, Math.PI * 2);
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

  ensureCanvasTexture(scene, TEX.sky, 8, 512, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#3d7bc4');
    gradient.addColorStop(0.55, '#7eb8e8');
    gradient.addColorStop(1, '#d9f0ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 512);
  });
};

/** 全屏蓝天渐变背景，固定在屏幕空间底层。 */
export const addSkyBackground = (scene: Phaser.Scene): void => {
  scene.add
    .image(0, 0, TEX.sky)
    .setOrigin(0, 0)
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    .setDepth(-10);
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

/** 云端跑道：中央半透明白色长条 + 两侧边界线，返回跑道左右边界。 */
export const drawRunway = (
  scene: Phaser.Scene,
  marginX: number,
): { laneLeft: number; laneRight: number } => {
  const graphics = scene.add.graphics().setDepth(-9);
  const laneWidth = GAME_WIDTH - marginX * 2;
  graphics.fillStyle(0xffffff, 0.16);
  graphics.fillRoundedRect(marginX, 0, laneWidth, GAME_HEIGHT, gameUnits(90));
  graphics.lineStyle(gameUnits(8), 0xffffff, 0.55);
  graphics.lineBetween(marginX, 0, marginX, GAME_HEIGHT);
  graphics.lineBetween(
    GAME_WIDTH - marginX,
    0,
    GAME_WIDTH - marginX,
    GAME_HEIGHT,
  );
  return { laneLeft: marginX, laneRight: GAME_WIDTH - marginX };
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
