import Phaser from 'phaser';

import {
  BULLET,
  DANGER_LINE_Y,
  ENEMY,
  FEEDBACK,
  HUD,
  PLAYER,
  PLAYER_Y,
  POWER_UP,
  RUNWAY_MARGIN_X,
  enemyCountForWave,
  enemySpeedForWave,
} from '@/game/gameConfig';
import {
  CloudField,
  TEX,
  addSkyBackground,
  drawDangerLine,
  drawRunway,
  ensureGameTextures,
} from '@/game/textures';
import { FONT_FAMILY, floatText } from '@/game/ui';
import { markEditable } from '@/utils';
import {
  GAME_CENTER_X,
  GAME_HEIGHT,
  GAME_WIDTH,
  addGameText,
  gamePixels,
  gameUnits,
} from '@/rendering';

type GameState = 'ready' | 'playing' | 'over';

interface ShotPattern {
  dx: number;
  vx: number;
}

const SHOT_PATTERNS: Record<number, readonly ShotPattern[]> = {
  1: [{ dx: 0, vx: 0 }],
  2: [
    { dx: -BULLET.spreadOffset, vx: 0 },
    { dx: BULLET.spreadOffset, vx: 0 },
  ],
  3: [
    { dx: 0, vx: 0 },
    { dx: -BULLET.spreadOffset, vx: -BULLET.speed * BULLET.spreadAngle },
    { dx: BULLET.spreadOffset, vx: BULLET.speed * BULLET.spreadAngle },
  ],
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private powerUps!: Phaser.Physics.Arcade.Group;
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private cloudField?: CloudField;
  private runwayDashes!: Phaser.GameObjects.Graphics;
  private keys: Partial<
    Record<'LEFT' | 'RIGHT' | 'A' | 'D', Phaser.Input.Keyboard.Key>
  > = {};
  private fireTimer?: Phaser.Time.TimerEvent;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private nextWaveTimer?: Phaser.Time.TimerEvent;
  private gameOverTimer?: Phaser.Time.TimerEvent;
  private state: GameState = 'playing';
  private score = 0;
  private wave = 1;
  private weaponLevel = 1;
  private waveTotal = 0;
  private spawnedThisWave = 0;
  private runwayOffset = 0;
  private laneLeft = 0;
  private laneRight = 0;
  // 手指拖动：只跟踪第一根手指；dragOffsetX 记录按下瞬间玩家与手指的相对偏移。
  private pointerId: number | null = null;
  private dragOffsetX = 0;
  private targetX = GAME_CENTER_X;
  // 开局提示层：ready 状态展示，点击后销毁并进入 playing。
  private readyLayer: Phaser.GameObjects.GameObject[] = [];
  private skipIntro = false;

  constructor() {
    super('game');
  }

  init(data?: { skipIntro?: boolean }): void {
    // 从产品默认值初始化全部实例字段，不依赖上一次的实例状态或 launch data。
    this.state = 'ready';
    this.score = 0;
    this.wave = 1;
    this.weaponLevel = 1;
    this.waveTotal = 0;
    this.spawnedThisWave = 0;
    this.runwayOffset = 0;
    this.fireTimer = undefined;
    this.spawnTimer = undefined;
    this.nextWaveTimer = undefined;
    this.gameOverTimer = undefined;
    this.pointerId = null;
    this.dragOffsetX = 0;
    this.targetX = GAME_CENTER_X;
    this.readyLayer = [];
    // 结算页“再来一局”会带 skipIntro，跳过开局提示直接开战。
    this.skipIntro = data?.skipIntro === true;
  }

  create(): void {
    ensureGameTextures(this);
    addSkyBackground(this);
    this.cloudField = new CloudField(this, 5);

    const lane = drawRunway(this, RUNWAY_MARGIN_X);
    this.laneLeft = lane.laneLeft;
    this.laneRight = lane.laneRight;
    drawDangerLine(this, DANGER_LINE_Y, this.laneLeft, this.laneRight);
    this.runwayDashes = this.add.graphics().setDepth(-7);

    this.buildPhysicsObjects();
    this.targetX = this.player.x;
    this.buildHud();
    this.bindInput();
    this.bindShutdown();

    if (this.skipIntro) {
      this.startGame();
    } else {
      this.buildReadyOverlay();
    }
  }

  /** 开局提示层：说明操作方式，点击/触摸屏幕后正式开始。 */
  private buildReadyOverlay(): void {
    const mask = this.add
      .rectangle(
        GAME_CENTER_X,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        0x0f172a,
        0.62,
      )
      .setDepth(40)
      .setInteractive();
    const hintStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: gamePixels(64),
      color: '#e0f2fe',
    };
    const title = addGameText(
      this,
      GAME_CENTER_X,
      GAME_HEIGHT * 0.24,
      '准备迎战',
      {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(110),
        color: '#ffffff',
        fontStyle: 'bold',
      },
    )
      .setOrigin(0.5)
      .setStroke('#1d4ed8', gameUnits(12))
      .setDepth(41);
    const line1 = addGameText(
      this,
      GAME_CENTER_X,
      GAME_HEIGHT * 0.42,
      '手指拖动 / ← → 移动',
      hintStyle,
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(6))
      .setDepth(41);
    const line2 = addGameText(
      this,
      GAME_CENTER_X,
      GAME_HEIGHT * 0.42 + gameUnits(150),
      '子弹自动发射',
      hintStyle,
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(6))
      .setDepth(41);
    const line3 = addGameText(
      this,
      GAME_CENTER_X,
      GAME_HEIGHT * 0.42 + gameUnits(300),
      '漏怪即失败',
      hintStyle,
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(6))
      .setDepth(41);
    const startHint = addGameText(
      this,
      GAME_CENTER_X,
      GAME_HEIGHT * 0.62,
      '点击屏幕开始',
      {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(80),
        color: '#fde68a',
        fontStyle: 'bold',
      },
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(8))
      .setDepth(41);

    this.readyLayer = [mask, title, line1, line2, line3, startHint];
    this.tweens.add({
      targets: startHint,
      alpha: 0.25,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    mask.on(Phaser.Input.Events.POINTER_UP, this.startGame, this);
  }

  /** 结束 ready 状态：销毁提示层，开火与第一波正式开始。 */
  private startGame(): void {
    if (this.state !== 'ready') {
      return;
    }
    this.state = 'playing';
    for (const object of this.readyLayer) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.readyLayer = [];

    this.fireTimer = this.time.addEvent({
      delay: BULLET.fireIntervalMs,
      loop: true,
      callback: this.fire,
      callbackScope: this,
    });
    this.startWave(this.wave);
  }

  private buildPhysicsObjects(): void {
    this.player = this.physics.add
      .sprite(GAME_CENTER_X, PLAYER_Y, TEX.player)
      .setDisplaySize(PLAYER.width, PLAYER.height)
      .setDepth(5);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(
      PLAYER.width * 0.72,
      PLAYER.height * 0.9,
      true,
    );
    this.player.setImmovable(true);
    markEditable('game.player', this.player, { label: '玩家火柴人' });

    this.bullets = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.powerUps = this.physics.add.group();

    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      this.onBulletHitEnemy,
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.player,
      this.powerUps,
      this.onPowerUpPickup,
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.onPlayerTouchedByEnemy,
      undefined,
      this,
    );
  }

  private buildHud(): void {
    const hudStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: gamePixels(HUD.fontSize),
      color: '#ffffff',
      fontStyle: 'bold',
    };
    this.scoreText = addGameText(this, HUD.marginX, HUD.y, '分数 0', hudStyle)
      .setOrigin(0, 0.5)
      .setStroke('#0f172a', gameUnits(8))
      .setDepth(10);
    markEditable('game.hud-score', this.scoreText, { label: '分数显示' });
    this.waveText = addGameText(
      this,
      GAME_WIDTH - HUD.marginX,
      HUD.y,
      '波次 1',
      hudStyle,
    )
      .setOrigin(1, 0.5)
      .setStroke('#0f172a', gameUnits(8))
      .setDepth(10);
    markEditable('game.hud-wave', this.waveText, { label: '波次显示' });
    this.weaponText = addGameText(
      this,
      GAME_CENTER_X,
      HUD.y,
      '武器 Lv.1',
      hudStyle,
    )
      .setOrigin(0.5)
      .setStroke('#0f172a', gameUnits(8))
      .setDepth(10);
    markEditable('game.hud-weapon', this.weaponText, { label: '武器等级显示' });

    this.banner = addGameText(this, GAME_CENTER_X, GAME_HEIGHT * 0.38, '', {
      fontFamily: FONT_FAMILY,
      fontSize: gamePixels(110),
      color: '#ffffff',
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setStroke('#1d4ed8', gameUnits(12))
      .setDepth(20)
      .setAlpha(0);
  }

  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = keyboard.addKeys(
        'LEFT,RIGHT,A,D',
      ) as Partial<
        Record<'LEFT' | 'RIGHT' | 'A' | 'D', Phaser.Input.Keyboard.Key>
      >;
    }

    // 手指拖动：按下时记下相对偏移，之后手指停在屏幕任意位置都能操控，不必按住玩家。
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.state !== 'playing' || this.pointerId !== null) {
      return;
    }
    this.pointerId = pointer.id;
    this.dragOffsetX = this.player.x - pointer.worldX;
    this.targetX = this.clampToLane(pointer.worldX + this.dragOffsetX);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== pointer.id) {
      return;
    }
    this.targetX = this.clampToLane(pointer.worldX + this.dragOffsetX);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== pointer.id) {
      return;
    }
    this.pointerId = null;
  }

  private bindShutdown(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
      this.fireTimer?.remove();
      this.spawnTimer?.remove();
      this.nextWaveTimer?.remove();
      this.gameOverTimer?.remove();
      this.fireTimer = undefined;
      this.spawnTimer = undefined;
      this.nextWaveTimer = undefined;
      this.gameOverTimer = undefined;
    });
  }

  private startWave(wave: number): void {
    this.wave = wave;
    this.waveTotal = enemyCountForWave(wave);
    this.spawnedThisWave = 0;
    this.updateHud();
    this.showBanner(`第 ${wave} 波`);

    this.spawnTimer = this.time.addEvent({
      delay: ENEMY.spawnIntervalMs,
      repeat: this.waveTotal - 1,
      callback: this.spawnEnemy,
      callbackScope: this,
    });

    // 每 2 波在该波开始时掉落一个武器升级道具。
    if (wave % POWER_UP.dropEveryWaves === 0) {
      this.spawnPowerUp();
    }
  }

  private spawnEnemy(): void {
    if (this.state !== 'playing') {
      return;
    }
    const margin = RUNWAY_MARGIN_X + ENEMY.width * 0.4;
    const spawnX = Phaser.Math.Between(margin, GAME_WIDTH - margin);
    const enemy = this.enemies.create(
      spawnX,
      ENEMY.spawnTopY,
      TEX.enemy,
    ) as Phaser.Physics.Arcade.Sprite;
    enemy
      .setDisplaySize(ENEMY.width, ENEMY.height)
      .setDepth(4);
    (enemy.body as Phaser.Physics.Arcade.Body).setSize(
      ENEMY.width * ENEMY.bodyWidthRatio,
      ENEMY.height * ENEMY.bodyHeightRatio,
      true,
    );
    enemy.setVelocityY(enemySpeedForWave(this.wave));
    this.spawnedThisWave += 1;
  }

  private spawnPowerUp(): void {
    const margin = POWER_UP.size;
    const spawnX = Phaser.Math.Between(
      this.laneLeft + margin,
      this.laneRight - margin,
    );
    const powerUp = this.powerUps.create(
      spawnX,
      -POWER_UP.size,
      TEX.powerUp,
    ) as Phaser.Physics.Arcade.Sprite;
    powerUp.setDisplaySize(POWER_UP.size, POWER_UP.size).setDepth(3);
    (powerUp.body as Phaser.Physics.Arcade.Body).setSize(
      POWER_UP.size,
      POWER_UP.size,
      true,
    );
    powerUp.setVelocityY(POWER_UP.speed);
    this.tweens.add({
      targets: powerUp,
      scale: powerUp.scale * 1.08,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private fire(): void {
    if (this.state !== 'playing') {
      return;
    }
    const pattern =
      SHOT_PATTERNS[Phaser.Math.Clamp(this.weaponLevel, 1, 3)] ??
      SHOT_PATTERNS[1];
    const muzzleY = this.player.y - PLAYER.height * 0.52;
    for (const shot of pattern) {
      const bullet = this.bullets.create(
        this.player.x + shot.dx,
        muzzleY,
        TEX.bullet,
      ) as Phaser.Physics.Arcade.Sprite;
      bullet.setDisplaySize(BULLET.size, BULLET.size).setDepth(6);
      (bullet.body as Phaser.Physics.Arcade.Body).setSize(
        BULLET.size,
        BULLET.size,
        true,
      );
      bullet.setVelocity(shot.vx, -BULLET.speed);
    }
  }

  private onBulletHitEnemy(
    bulletObject: unknown,
    enemyObject: unknown,
  ): void {
    if (this.state !== 'playing') {
      return;
    }
    const bullet = bulletObject as Phaser.Physics.Arcade.Sprite;
    const enemy = enemyObject as Phaser.Physics.Arcade.Sprite;
    if (!bullet.active || !enemy.active) {
      return;
    }
    if (enemy.getData('dying')) {
      // 受击中的敌人不再重复结算，仅让子弹消失。
      bullet.destroy();
      return;
    }
    bullet.destroy();
    this.hitEnemy(enemy);
  }

  /** 受击反馈：闪白 + 轻微放大，敌人短暂停顿后销毁并播放爆炸。 */
  private hitEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    enemy.setData('dying', true);
    enemy.setVelocityY(0);
    enemy.setTintFill(0xffffff);
    this.tweens.add({
      targets: enemy,
      scaleX: enemy.scaleX * FEEDBACK.hitScale,
      scaleY: enemy.scaleY * FEEDBACK.hitScale,
      duration: FEEDBACK.hitFlashMs,
      ease: 'Quad.out',
      onComplete: () => {
        if (enemy.active) {
          this.killEnemy(enemy);
        }
      },
    });
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    const x = enemy.x;
    const y = enemy.y;
    this.tweens.killTweensOf(enemy);
    enemy.destroy();
    this.score += ENEMY.score;
    this.updateHud();
    this.spawnDeathBurst(x, y);
    floatText(this, x, y - gameUnits(80), `+${ENEMY.score}`, '#fff8dc');
    this.checkWaveCleared();
  }

  private spawnDeathBurst(x: number, y: number): void {
    // 中心闪光：快速膨胀淡出
    const flash = this.add
      .circle(x, y, gameUnits(46), 0xffffff, 0.95)
      .setDepth(7);
    this.tweens.add({
      targets: flash,
      scale: 1.7,
      alpha: 0,
      duration: FEEDBACK.explosionDurationMs * 0.6,
      ease: 'Quad.out',
      onComplete: () => flash.destroy(),
    });

    // 扩散圆环
    const ring = this.add.circle(x, y, gameUnits(30), 0xffffff, 0.9).setDepth(7);
    this.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: FEEDBACK.explosionDurationMs,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy(),
    });

    // 固定数量碎片向外飞散（无持续发射器，全部结束后自动销毁）
    for (let index = 0; index < FEEDBACK.explosionShards; index += 1) {
      const angle =
        (Math.PI * 2 * index) / FEEDBACK.explosionShards + Math.random() * 0.6;
      const distance = FEEDBACK.explosionRadius * (0.6 + Math.random() * 0.6);
      const shard = this.add
        .circle(x, y, gameUnits(9 + Math.random() * 8), 0xe5484d, 0.95)
        .setDepth(7);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: FEEDBACK.explosionDurationMs * (0.8 + Math.random() * 0.4),
        ease: 'Cubic.out',
        onComplete: () => shard.destroy(),
      });
    }
  }

  private checkWaveCleared(): void {
    if (this.state !== 'playing') {
      return;
    }
    if (this.spawnedThisWave < this.waveTotal) {
      return;
    }
    if (this.enemies.countActive(true) > 0) {
      return;
    }
    if (this.nextWaveTimer) {
      return;
    }
    this.showBanner('清空！');
    this.nextWaveTimer = this.time.delayedCall(1100, () => {
      this.nextWaveTimer = undefined;
      if (this.state !== 'playing') {
        return;
      }
      this.startWave(this.wave + 1);
    });
  }

  private onPowerUpPickup(
    _playerObject: unknown,
    powerUpObject: unknown,
  ): void {
    if (this.state !== 'playing') {
      return;
    }
    const powerUp = powerUpObject as Phaser.Physics.Arcade.Sprite;
    if (!powerUp.active) {
      return;
    }
    this.tweens.killTweensOf(powerUp);
    powerUp.destroy();

    if (this.weaponLevel < POWER_UP.maxWeaponLevel) {
      this.weaponLevel += 1;
      floatText(
        this,
        this.player.x,
        this.player.y - PLAYER.height * 0.9,
        '武器升级！',
        '#ede9fe',
      );
      this.player.setTint(0xa78bfa);
      this.time.delayedCall(180, () => {
        if (this.player.active) {
          this.player.clearTint();
        }
      });
    } else {
      this.score += POWER_UP.maxedBonusScore;
      this.updateHud();
      floatText(
        this,
        this.player.x,
        this.player.y - PLAYER.height * 0.9,
        `+${POWER_UP.maxedBonusScore}`,
        '#fff8dc',
      );
    }
  }

  private onPlayerTouchedByEnemy(
    _playerObject: unknown,
    enemyObject: unknown,
  ): void {
    if (this.state !== 'playing') {
      return;
    }
    const enemy = enemyObject as Phaser.Physics.Arcade.Sprite;
    // 正在播放受击特效（已停止下落）的敌人不再触发玩家死亡。
    if (!enemy.active || enemy.getData('dying')) {
      return;
    }
    this.gameOver();
  }

  update(_time: number, delta: number): void {
    const deltaSeconds = delta / 1000;
    this.cloudField?.update(deltaSeconds);
    this.updateRunwayDashes(deltaSeconds);
    if (this.state !== 'playing') {
      return;
    }
    this.handleMovement(deltaSeconds);
    this.checkDangerLine();
    this.cullOffscreenObjects();
  }

  private handleMovement(deltaSeconds: number): void {
    // 手指拖动优先；没有手指按下时才响应键盘，保留 PC 端调试能力。
    if (this.pointerId === null) {
      const leftDown = this.keys.LEFT?.isDown || this.keys.A?.isDown;
      const rightDown = this.keys.RIGHT?.isDown || this.keys.D?.isDown;
      const direction = (rightDown ? 1 : 0) - (leftDown ? 1 : 0);
      if (direction !== 0) {
        this.targetX = this.clampToLane(
          this.player.x + direction * PLAYER.moveSpeed * deltaSeconds,
        );
      }
    }
    this.moveTowardsTarget(deltaSeconds);
  }

  /** 平滑逼近目标位置：近距离指数插值减速，远距离限制在最大速度内，避免瞬移。 */
  private moveTowardsTarget(deltaSeconds: number): void {
    const distance = this.targetX - this.player.x;
    if (Math.abs(distance) <= 0.5) {
      this.player.x = this.targetX;
      return;
    }
    // 指数插值（与帧率无关），再钳制单帧最大位移。
    const smoothing = 1 - Math.exp(-PLAYER.followLerp * deltaSeconds);
    const maxStep = PLAYER.moveSpeed * deltaSeconds;
    const step = Phaser.Math.Clamp(distance * smoothing, -maxStep, maxStep);
    this.player.x = this.clampToLane(this.player.x + step);
  }

  /** 把玩家约束在云端跑道内，两侧各留出半个身位避免压线。 */
  private clampToLane(x: number): number {
    const halfWidth = PLAYER.width * PLAYER.halfWidthRatio;
    return Phaser.Math.Clamp(
      x,
      this.laneLeft + halfWidth,
      this.laneRight - halfWidth,
    );
  }

  private checkDangerLine(): void {
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) {
        continue;
      }
      if (enemy.getBounds().bottom >= DANGER_LINE_Y) {
        this.gameOver();
        return;
      }
    }
  }

  private cullOffscreenObjects(): void {
    const cullLimitTop = -gameUnits(120);
    for (const child of this.bullets.getChildren()) {
      const bullet = child as Phaser.Physics.Arcade.Sprite;
      if (bullet.active && bullet.y < cullLimitTop) {
        bullet.destroy();
      }
    }
    const cullLimitBottom = GAME_HEIGHT + gameUnits(220);
    for (const child of this.powerUps.getChildren()) {
      const powerUp = child as Phaser.Physics.Arcade.Sprite;
      if (powerUp.active && powerUp.y > cullLimitBottom) {
        this.tweens.killTweensOf(powerUp);
        powerUp.destroy();
      }
    }
  }

  private updateRunwayDashes(deltaSeconds: number): void {
    const spacing = gameUnits(360);
    this.runwayOffset =
      (this.runwayOffset + gameUnits(560) * deltaSeconds) % spacing;
    const graphics = this.runwayDashes;
    graphics.clear();
    graphics.lineStyle(gameUnits(12), 0xffffff, 0.28);
    const inset = gameUnits(70);
    const fromX = this.laneLeft + inset;
    const toX = this.laneRight - inset;
    for (let y = this.runwayOffset - spacing; y < GAME_HEIGHT; y += spacing) {
      graphics.lineBetween(fromX, y, toX, y);
    }
  }

  private showBanner(message: string): void {
    this.banner.setText(message);
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
    this.banner.setScale(0.6);
    this.tweens.add({
      targets: this.banner,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Quad.out',
      hold: 620,
      yoyo: true,
      onComplete: () => {
        this.banner.setAlpha(0);
        this.banner.setScale(1);
      },
    });
  }

  private updateHud(): void {
    this.scoreText.setText(`分数 ${this.score}`);
    this.waveText.setText(`波次 ${this.wave}`);
    const weaponLabel =
      this.weaponLevel >= POWER_UP.maxWeaponLevel
        ? '武器 MAX'
        : `武器 Lv.${this.weaponLevel}`;
    this.weaponText.setText(weaponLabel);
  }

  private gameOver(): void {
    if (this.state !== 'playing') {
      return;
    }
    this.state = 'over';
    this.pointerId = null;
    this.fireTimer?.remove();
    this.spawnTimer?.remove();
    this.nextWaveTimer?.remove();
    this.fireTimer = undefined;
    this.spawnTimer = undefined;
    this.nextWaveTimer = undefined;
    this.physics.pause();
    this.cameras.main.shake(FEEDBACK.shakeDurationMs, FEEDBACK.shakeIntensity);

    this.player.setTint(0xff6b6b);
    this.tweens.add({
      targets: this.player,
      x: this.player.x + gameUnits(24),
      duration: 55,
      yoyo: true,
      repeat: 3,
    });
    const overlay = this.add
      .rectangle(
        GAME_CENTER_X,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        0xdc2626,
        0,
      )
      .setDepth(30);
    this.tweens.add({
      targets: overlay,
      fillAlpha: 0.28,
      duration: 260,
    });

    this.gameOverTimer = this.time.delayedCall(950, () => {
      this.scene.start('game-over', { score: this.score, wave: this.wave });
    });
  }
}
