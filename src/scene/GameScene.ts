import Phaser from 'phaser';

import {
  BULLET,
  DANGER_LINE_Y,
  ENEMY,
  FEEDBACK,
  PLAYER,
  PLAYER_Y,
  POWER_UP,
  RUNWAY,
  enemyCountForWave,
  enemyHpForWave,
  enemySpeedForWave,
} from '@/game/gameConfig';
import { FxSystem } from '@/game/FxSystem';
import { HudController } from '@/game/HudController';
import { RunwayRenderer } from '@/game/RunwayRenderer';
import {
  getDepthAtY,
  getLaneBoundsAtY,
  getPerspectiveScaleAtY,
} from '@/game/perspective';
import {
  CloudField,
  COIN_TEXTURE_SIZE,
  TEX,
  addSkyBackground,
  drawDangerLine,
  ensureGameTextures,
  registerRunAnimations,
  resolveTexture,
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

/** 编队阵型：玩家本体是中心成员，跟随成员的横向偏移按编队人数展开。 */
const FOLLOWER_DX: Record<number, readonly number[]> = {
  1: [],
  2: [PLAYER.squadSpread],
  3: [-PLAYER.squadSpread, PLAYER.squadSpread],
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private powerUps!: Phaser.Physics.Arcade.Group;
  private banner!: Phaser.GameObjects.Text;
  private playerShadow?: Phaser.GameObjects.Ellipse;
  private cloudField?: CloudField;
  // 子系统：只负责表现与编排，玩法状态仍由 GameScene 持有
  private readonly hud = new HudController(this);
  private readonly fx = new FxSystem(this);
  private readonly runway = new RunwayRenderer(this);
  private keys: Partial<
    Record<'LEFT' | 'RIGHT' | 'A' | 'D', Phaser.Input.Keyboard.Key>
  > = {};
  private fireTimer?: Phaser.Time.TimerEvent;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private nextWaveTimer?: Phaser.Time.TimerEvent;
  private gameOverTimer?: Phaser.Time.TimerEvent;
  private state: GameState = 'playing';
  private score = 0;
  private coins = 0;
  private wave = 1;
  private weaponLevel = 1;
  private waveTotal = 0;
  private spawnedThisWave = 0;
  // 手指拖动：只跟踪第一根手指；dragOffsetX 记录按下瞬间玩家与手指的相对偏移。
  private pointerId: number | null = null;
  private dragOffsetX = 0;
  private targetX = GAME_CENTER_X;
  // 编队跟随成员（1 号是玩家本体，跟随者数量 = weaponLevel - 1）
  private squadFollowers: Phaser.Physics.Arcade.Sprite[] = [];
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
    this.coins = 0;
    this.wave = 1;
    this.weaponLevel = 1;
    this.waveTotal = 0;
    this.spawnedThisWave = 0;
    this.fireTimer = undefined;
    this.spawnTimer = undefined;
    this.nextWaveTimer = undefined;
    this.gameOverTimer = undefined;
    this.pointerId = null;
    this.dragOffsetX = 0;
    this.targetX = GAME_CENTER_X;
    this.squadFollowers = [];
    this.readyLayer = [];
    // 结算页“再来一局”会带 skipIntro，跳过开局提示直接开战。
    this.skipIntro = data?.skipIntro === true;
  }

  create(): void {
    ensureGameTextures(this);
    registerRunAnimations(this);
    addSkyBackground(this);
    this.cloudField = new CloudField(this, 5);

    const lane = this.runway.create();
    drawDangerLine(this, DANGER_LINE_Y, lane.laneLeft, lane.laneRight);

    this.buildPhysicsObjects();
    this.targetX = this.player.x;
    this.hud.create();
    this.buildBanner();
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
    const playerTexture = resolveTexture(this, 'player', TEX.player);
    this.player = this.physics.add
      .sprite(GAME_CENTER_X, PLAYER_Y, playerTexture)
      .setDisplaySize(PLAYER.width, PLAYER.height)
      .setDepth(getDepthAtY(PLAYER_Y));
    this.setBodySize(this.player, PLAYER.width * 0.72, PLAYER.height * 0.9);
    this.player.setImmovable(true);
    // 自定义素材为单帧，不播放程序化跑步动画
    if (playerTexture === TEX.player) {
      this.player.play('player-run');
    }
    this.playerShadow = this.createShadow(
      PLAYER.width * 0.95,
      getDepthAtY(PLAYER_Y) - 0.05,
    );
    this.playerShadow.setPosition(GAME_CENTER_X, PLAYER_Y + PLAYER.height * 0.44);
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

  /** 波次 / 清空横幅（流程提示，仍由 GameScene 编排）。 */
  private buildBanner(): void {
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
    this.targetX = this.clampToLane(
      pointer.worldX + this.dragOffsetX,
      this.player.y,
    );
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== pointer.id) {
      return;
    }
    this.targetX = this.clampToLane(
      pointer.worldX + this.dragOffsetX,
      this.player.y,
    );
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
    // 生成范围取该 y 深度处的透视跑道（顶部较窄），不再使用固定左右边界。
    const spawnBounds = getLaneBoundsAtY(ENEMY.spawnTopY);
    const margin = RUNWAY.perspectiveInset + ENEMY.width * 0.4;
    const spawnX = Phaser.Math.Between(
      spawnBounds.left + margin,
      spawnBounds.right - margin,
    );
    const enemyTexture = resolveTexture(this, 'enemy', TEX.enemy);
    const enemy = this.enemies.create(
      spawnX,
      ENEMY.spawnTopY,
      enemyTexture,
    ) as Phaser.Physics.Arcade.Sprite;
    enemy
      .setDisplaySize(ENEMY.width, ENEMY.height)
      .setDepth(getDepthAtY(ENEMY.spawnTopY));
    // 记录基准缩放，透视缩放 = baseScale × getPerspectiveScaleAtY(y)
    enemy.setData('baseScale', enemy.scaleX);
    this.setBodySize(
      enemy,
      ENEMY.width * ENEMY.bodyWidthRatio,
      ENEMY.height * ENEMY.bodyHeightRatio,
    );
    enemy.setVelocityY(enemySpeedForWave(this.wave));
    // 自定义素材为单帧，不播放程序化跑步动画
    if (enemyTexture === TEX.enemy) {
      enemy.play('enemy-run');
    }
    const shadow = this.createShadow(
      ENEMY.width * 0.95,
      getDepthAtY(ENEMY.spawnTopY) - 0.05,
    );
    shadow.setPosition(spawnX, ENEMY.spawnTopY + ENEMY.height * 0.44);
    enemy.setData('shadow', shadow);

    // 头顶血量数字：跟随敌人下落，受击时逐发扣减。
    const hp = enemyHpForWave(this.wave);
    enemy.setData('hp', hp);
    const hpText = addGameText(
      this,
      spawnX,
      ENEMY.spawnTopY - ENEMY.height * ENEMY.hpTextOffsetRatio,
      String(hp),
      {
        fontFamily: FONT_FAMILY,
        fontSize: gamePixels(ENEMY.hpFontSize),
        color: '#ffffff',
        fontStyle: 'bold',
      },
    )
      .setOrigin(0.5)
      .setStroke('#7f1d1d', gameUnits(6))
      .setDepth(getDepthAtY(ENEMY.spawnTopY) + 0.1);
    enemy.setData('hpText', hpText);

    this.spawnedThisWave += 1;
  }

  private spawnPowerUp(): void {
    const margin = POWER_UP.size;
    const spawnY = -POWER_UP.size;
    const spawnBounds = getLaneBoundsAtY(spawnY);
    const spawnX = Phaser.Math.Between(
      spawnBounds.left + margin,
      spawnBounds.right - margin,
    );
    const powerUpTexture = resolveTexture(this, 'powerUp', TEX.powerUp);
    const powerUp = this.powerUps.create(
      spawnX,
      spawnY,
      powerUpTexture,
    ) as Phaser.Physics.Arcade.Sprite;
    powerUp
      .setDisplaySize(POWER_UP.size, POWER_UP.size)
      .setDepth(getDepthAtY(spawnY));
    powerUp.setData('baseScale', powerUp.scale);
    this.setBodySize(powerUp, POWER_UP.size, POWER_UP.size);
    powerUp.setVelocityY(POWER_UP.speed);
    // 呼吸改为 alpha 呼吸：缩放交给透视控制，避免 tween 与每帧缩放互相覆盖
    this.tweens.add({
      targets: powerUp,
      alpha: 0.72,
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
    const muzzleOffsetY = PLAYER.height * 0.52;
    for (const member of [this.player, ...this.squadFollowers]) {
      if (!member.active) {
        continue;
      }
      const bulletTexture = resolveTexture(this, 'bullet', TEX.bullet);
      const bullet = this.bullets.create(
        member.x,
        member.y - muzzleOffsetY,
        bulletTexture,
      ) as Phaser.Physics.Arcade.Sprite;
      bullet
        .setDisplaySize(BULLET.size, BULLET.size * 2)
        .setDepth(getDepthAtY(member.y - muzzleOffsetY) + 0.6);
      if (bulletTexture === TEX.bullet) {
        // 程序化纹理：上半弹头、下半尾焰，碰撞体只取弹头区域
        (bullet.body as Phaser.Physics.Arcade.Body).setSize(
          BULLET.size,
          BULLET.size,
          false,
        );
      } else {
        // 自定义素材：整图居中作为碰撞体
        this.setBodySize(bullet, BULLET.size, BULLET.size);
      }
      bullet.setVelocity(0, -BULLET.speed);
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

  /** 受击：扣 1 点血。非致命只闪白继续下落；致命则停顿、放大后爆炸销毁。 */
  private hitEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    const hp = (enemy.getData('hp') as number) - 1;
    enemy.setData('hp', hp);
    const hpText = enemy.getData('hpText') as
      | Phaser.GameObjects.Text
      | undefined;

    if (hp > 0) {
      // 非致命：短促闪白，不打断下落
      enemy.setTintFill(0xffffff);
      this.time.delayedCall(Math.round(FEEDBACK.hitFlashMs * 0.75), () => {
        if (enemy.active) {
          enemy.clearTint();
        }
      });
      if (hpText?.active) {
        hpText.setText(String(hp));
        this.tweens.add({
          targets: hpText,
          scale: ENEMY.hpPopScale,
          duration: 70,
          yoyo: true,
          ease: 'Quad.out',
        });
      }
      return;
    }

    // 致命：走原受击-爆炸流程
    enemy.setData('dying', true);
    enemy.setVelocityY(0);
    enemy.setTintFill(0xffffff);
    hpText?.setText('0');
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
    const hpText = enemy.getData('hpText') as
      | Phaser.GameObjects.Text
      | undefined;
    this.tweens.killTweensOf(enemy);
    enemy.destroy();
    hpText?.destroy();
    this.score += ENEMY.score;
    this.updateHud();
    this.fx.deathBurst(x, y);
    this.fx.killStain(x, y);
    this.spawnCoins(x, y);
    floatText(this, x, y - gameUnits(80), `+${ENEMY.score}`, '#fff8dc');
    this.checkWaveCleared();
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
      this.syncSquad();
      floatText(
        this,
        this.player.x,
        this.player.y - PLAYER.height * 0.9,
        '编队扩大！',
        '#ede9fe',
        { pop: true },
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
    this.runway.updateDashes(deltaSeconds);
    if (this.state !== 'playing') {
      return;
    }
    this.handleMovement(deltaSeconds);
    this.playerShadow?.setPosition(
      this.player.x,
      this.player.y + PLAYER.height * 0.44,
    );
    this.updateSquadFormation(deltaSeconds);
    this.syncPerspective();
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
          this.player.y,
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
    this.player.x = this.clampToLane(this.player.x + step, this.player.y);
  }

  /** 把角色约束在该 y 深度处的透视跑道内，两侧各留出半个身位避免压线。 */
  private clampToLane(x: number, y: number): number {
    const bounds = getLaneBoundsAtY(y);
    const halfWidth = PLAYER.width * PLAYER.halfWidthRatio;
    return Phaser.Math.Clamp(
      x,
      bounds.left + halfWidth,
      bounds.right - halfWidth,
    );
  }

  /** 角色脚下椭圆投影：压在跑道色块上，让角色"站得住"。 */
  private createShadow(
    width: number,
    depth: number,
  ): Phaser.GameObjects.Ellipse {
    return this.add
      .ellipse(0, 0, width, width * 0.3, 0x10253a, 0.28)
      .setDepth(depth);
  }

  /**
   * 设置碰撞体：把目标实际尺寸换算回源纹理空间，
   * 保证"实际碰撞尺寸"不随素材分辨率变化（程序化纹理下行为完全不变）。
   */
  private setBodySize(
    sprite: Phaser.Physics.Arcade.Sprite,
    width: number,
    height: number,
  ): void {
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const scaleX = sprite.scaleX || 1;
    const scaleY = sprite.scaleY || 1;
    body.setSize(width / scaleX, height / scaleY, true);
  }

  /** 按当前编队等级补建跟随成员（等级只升不降，无需销毁逻辑）。 */
  private syncSquad(): void {
    const level = Phaser.Math.Clamp(
      this.weaponLevel,
      1,
      POWER_UP.maxWeaponLevel,
    );
    const dxs = FOLLOWER_DX[level] ?? [];
    while (this.squadFollowers.length < dxs.length) {
      const index = this.squadFollowers.length;
      const followerTexture = resolveTexture(this, 'player', TEX.player);
      const follower = this.physics.add
        .sprite(
          this.player.x + dxs[index],
          PLAYER_Y + PLAYER.squadYOffset,
          followerTexture,
        )
        .setDisplaySize(PLAYER.width, PLAYER.height)
        .setDepth(getDepthAtY(PLAYER_Y + PLAYER.squadYOffset));
      this.setBodySize(follower, PLAYER.width * 0.72, PLAYER.height * 0.9);
      follower.setImmovable(true);
      // 自定义素材为单帧，不播放程序化跑步动画
      if (followerTexture === TEX.player) {
        follower.play('player-run');
      }
      const shadow = this.createShadow(
        PLAYER.width * 0.95,
        getDepthAtY(PLAYER_Y + PLAYER.squadYOffset) - 0.05,
      );
      shadow.setPosition(follower.x, follower.y + PLAYER.height * 0.44);
      follower.setData('shadow', shadow);
      markEditable(`game.squad-member-${index + 1}`, follower, {
        label: '编队成员',
      });
      this.squadFollowers.push(follower);
      // 跟随成员与本体同等承伤、同等拾取。
      this.physics.add.overlap(
        follower,
        this.enemies,
        this.onPlayerTouchedByEnemy,
        undefined,
        this,
      );
      this.physics.add.overlap(
        follower,
        this.powerUps,
        this.onPowerUpPickup,
        undefined,
        this,
      );
    }
  }

  /** 跟随成员平滑贴向阵位（略滞后于本体，形成编队弹性）。 */
  private updateSquadFormation(deltaSeconds: number): void {
    const level = Phaser.Math.Clamp(
      this.weaponLevel,
      1,
      POWER_UP.maxWeaponLevel,
    );
    const dxs = FOLLOWER_DX[level] ?? [];
    const smoothing = 1 - Math.exp(-PLAYER.squadLerp * deltaSeconds);
    this.squadFollowers.forEach((follower, index) => {
      const targetX = this.clampToLane(
        this.player.x + (dxs[index] ?? 0),
        follower.y,
      );
      follower.x += (targetX - follower.x) * smoothing;
      const shadow = follower.getData('shadow') as
        | Phaser.GameObjects.Ellipse
        | undefined;
      shadow?.setPosition(follower.x, follower.y + PLAYER.height * 0.44);
    });
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
    this.hud.update({
      score: this.score,
      wave: this.wave,
      weaponLevel: this.weaponLevel,
      spawnedThisWave: this.spawnedThisWave,
      waveTotal: this.waveTotal,
      activeEnemies: this.enemies.countActive(true),
    });
  }

  /**
   * 每帧同步透视表现：缩放（远小近大）、按 y 排序的层级，以及挂载物（影子/血量文字）。
   * 只改视觉，不参与任何玩法判定。
   */
  private syncPerspective(): void {
    // 敌人：缩放 + 层级 + 影子 + 血量文字
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) {
        continue;
      }
      const scale = getPerspectiveScaleAtY(enemy.y);
      const baseScale = (enemy.getData('baseScale') as number) ?? 1;
      // 正在播放受击放大动画的敌人不覆盖其 scale，避免 tween 被每帧重置。
      if (enemy.getData('dying') !== true) {
        enemy.setScale(baseScale * scale);
      }
      const depth = getDepthAtY(enemy.y);
      enemy.setDepth(depth);

      const hpText = enemy.getData('hpText') as
        | Phaser.GameObjects.Text
        | undefined;
      if (hpText?.active) {
        hpText.setPosition(
          enemy.x,
          enemy.y - ENEMY.height * scale * ENEMY.hpTextOffsetRatio,
        );
        hpText.setDepth(depth + 0.1);
      }
      const shadow = enemy.getData('shadow') as
        | Phaser.GameObjects.Ellipse
        | undefined;
      if (shadow?.active) {
        shadow.setPosition(enemy.x, enemy.y + ENEMY.height * scale * 0.44);
        shadow.setScale(scale);
        shadow.setDepth(depth - 0.05);
      }
    }

    // 道具：缩放 + 层级（拾取碰撞随 Arcade body 自动跟随缩放）
    for (const child of this.powerUps.getChildren()) {
      const powerUp = child as Phaser.Physics.Arcade.Sprite;
      if (!powerUp.active) {
        continue;
      }
      const baseScale = (powerUp.getData('baseScale') as number) ?? 1;
      powerUp.setScale(baseScale * getPerspectiveScaleAtY(powerUp.y));
      powerUp.setDepth(getDepthAtY(powerUp.y));
    }

    // 子弹：只排序层级，不改缩放（保持命中判定与观感稳定）
    for (const child of this.bullets.getChildren()) {
      const bullet = child as Phaser.Physics.Arcade.Sprite;
      if (bullet.active) {
        bullet.setDepth(getDepthAtY(bullet.y) + 0.6);
      }
    }
  }

  /** 击杀掉落金币：弹出后飞向右上角金币 HUD，入账时数字弹一下。 */
  private spawnCoins(x: number, y: number): void {
    const count = Phaser.Math.Between(ENEMY.coinDropMin, ENEMY.coinDropMax);
    const targetScale =
      (ENEMY.coinSize / COIN_TEXTURE_SIZE) * getPerspectiveScaleAtY(y);
    for (let index = 0; index < count; index += 1) {
      const coin = this.add
        .image(
          x + Phaser.Math.Between(-gameUnits(40), gameUnits(40)),
          y + Phaser.Math.Between(-gameUnits(24), gameUnits(24)),
          TEX.coin,
        )
        .setDepth(getDepthAtY(y) + 0.3)
        .setScale(0);
      this.tweens.add({
        targets: coin,
        scale: targetScale,
        duration: 90,
        delay: index * 45,
        ease: 'Back.out',
        onComplete: () => {
          this.tweens.add({
            targets: coin,
            x: this.hud.coinTarget.x,
            y: this.hud.coinTarget.y,
            duration: ENEMY.coinFlyMs,
            ease: 'Cubic.in',
            onComplete: () => {
              coin.destroy();
              this.coins += 1;
              this.hud.setCoins(this.coins, true);
            },
          });
        },
      });
    }
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
    this.fx.shakeScreen();

    this.player.setTint(0xff6b6b);
    this.player.anims?.pause();
    for (const follower of this.squadFollowers) {
      follower.setAlpha(0.5);
      follower.anims?.pause();
    }
    for (const child of this.enemies.getChildren()) {
      (child as Phaser.Physics.Arcade.Sprite).anims?.pause();
    }
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
