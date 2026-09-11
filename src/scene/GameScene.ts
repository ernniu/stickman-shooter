import Phaser from 'phaser';

import {
  BULLET,
  BARREL,
  DANGER_LINE_Y,
  ENEMY,
  EQUIPMENT,
  FEEDBACK,
  GATE,
  GROWTH,
  PLAYER,
  REWARD_BOX,
  PLAYER_Y,
  POWER_UP,
  RAGE,
  RUNWAY,
  SQUAD_FORMATION,
  enemyCountForWave,
  enemyHpForWave,
  enemySpeedForWave,
  type GateReward,
} from '@/game/gameConfig';
import { FxSystem } from '@/game/FxSystem';
import { GateSystem } from '@/game/GateSystem';
import { HudController } from '@/game/HudController';
import { RunwayRenderer } from '@/game/RunwayRenderer';
import {
  getDepthAtY,
  getLaneBoundsAtY,
  getLaneHalfWidthAtY,
  getPerspectiveScaleAtY,
} from '@/game/perspective';
import {
  CloudField,
  OPTIONAL_TEX,
  TEX,
  addSkyBackground,
  drawDangerLine,
  ensureGameTextures,
  hasOptionalTexture,
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



export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private powerUps!: Phaser.Physics.Arcade.Group;
  private rewardBoxes!: Phaser.Physics.Arcade.Group;
  private barrels!: Phaser.Physics.Arcade.Group;
  private banner!: Phaser.GameObjects.Text;
  private playerShadow?: Phaser.GameObjects.Ellipse;
  private cloudField?: CloudField;
  // 子系统：只负责表现与编排，玩法状态仍由 GameScene 持有
  private readonly hud = new HudController(this);
  private readonly fx = new FxSystem(this);
  private readonly runway = new RunwayRenderer(this);
  private readonly gates = new GateSystem(this, (reward, x, y) =>
    this.applyGateReward(reward, x, y),
  );
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
  // 敌人摆动用的累积时间（只驱动轻微左右摆动，不影响下落速度）
  private swingTime = 0;
  // 狂暴射击：rageEndsAt 之前处于狂暴状态（更快的射击间隔 + 增强视觉）
  private rageEndsAt = 0;
  private rageWasActive = false;
  // 装备生命系统：护盾层数（上限 EQUIPMENT.shieldMax）与无敌截止时间
  private shieldCount = 0;
  private invincibleUntil = 0;
  // 成长强化：基础值 + 累积加成（非复利），上限见 GROWTH
  private damageBonus = 0;
  private attackSpeedBonus = 0;
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
    this.weaponLevel = EQUIPMENT.start;
    this.waveTotal = 0;
    this.spawnedThisWave = 0;
    this.swingTime = 0;
    this.rageEndsAt = 0;
    this.rageWasActive = false;
    this.shieldCount = 0;
    this.invincibleUntil = 0;
    this.damageBonus = 0;
    this.attackSpeedBonus = 0;
    this.gates.reset();
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
    this.syncSquad();
    this.targetX = this.player.x;
    this.hud.create();
    this.updateHud();
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

    this.refreshFireTimer();
    this.startWave(this.wave);
  }

  private buildPhysicsObjects(): void {
    const playerTexture = resolveTexture(this, 'player', TEX.player);
    this.player = this.physics.add
      .sprite(GAME_CENTER_X, PLAYER_Y, playerTexture)
      .setDisplaySize(
        PLAYER.width * PLAYER.displayScale,
        PLAYER.height * PLAYER.displayScale,
      )
      .setDepth(getDepthAtY(PLAYER_Y));
    this.setBodySize(this.player, PLAYER.width * 0.72, PLAYER.height * 0.9);
    this.player.setData(
      'aura',
      this.createAura(PLAYER.width * PLAYER.displayScale),
    );
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
    this.rewardBoxes = this.physics.add.group();
    this.barrels = this.physics.add.group();

    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      this.onBulletHitEnemy,
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.bullets,
      this.rewardBoxes,
      this.onBulletHitRewardBox,
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.bullets,
      this.barrels,
      this.onBulletHitBarrel,
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
      this.gates.clear();
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

    // 增益门：生成波次（奇数波）已与道具（偶数波）错开
    this.gates.onWaveStart(wave);

    // 奖励目标：概率生成，且避开屏上的门组
    this.spawnRewardTargets(wave);
  }

  /** 奖励箱 / 爆炸桶的按波概率生成（频率、上限见 REWARD_BOX / BARREL 配置）。 */
  private spawnRewardTargets(wave: number): void {
    // 门组活动时不生成，避免与门重叠
    if (this.gates.hasActiveGroup()) {
      return;
    }

    if (
      wave >= REWARD_BOX.startWave &&
      (wave - REWARD_BOX.startWave) % REWARD_BOX.everyWaves === 0 &&
      Math.random() < REWARD_BOX.spawnChance &&
      this.rewardBoxes.countActive(true) < REWARD_BOX.maxOnScreen
    ) {
      this.spawnRewardBox();
    }

    if (
      wave >= BARREL.startWave &&
      (wave - BARREL.startWave) % BARREL.everyWaves === 0 &&
      Math.random() < BARREL.spawnChance &&
      this.barrels.countActive(true) < BARREL.maxOnScreen
    ) {
      const count = Math.min(
        BARREL.maxOnScreen - this.barrels.countActive(true),
        Phaser.Math.Between(BARREL.spawnMin, BARREL.spawnMax),
      );
      for (let index = 0; index < count; index += 1) {
        this.spawnBarrel();
      }
    }
  }

  /** 生成透视跑道内的目标 x 坐标（顶部外侧生成，随跑道下移）。 */
  private spawnTargetX(spawnY: number): number {
    const bounds = getLaneBoundsAtY(spawnY);
    const edge = REWARD_BOX.size * 0.5;
    return Phaser.Math.Clamp(
      GAME_CENTER_X +
        Phaser.Math.FloatBetween(-0.6, 0.6) * getLaneHalfWidthAtY(spawnY),
      bounds.left + edge,
      bounds.right - edge,
    );
  }

  private spawnRewardBox(): void {
    const spawnY = -REWARD_BOX.size;
    const x = this.spawnTargetX(spawnY);
    const texture = resolveTexture(this, 'rewardBox', TEX.rewardBox);
    const box = this.rewardBoxes.create(x, spawnY, texture) as
      Phaser.Physics.Arcade.Sprite;
    box
      .setDisplaySize(REWARD_BOX.size, REWARD_BOX.size)
      .setDepth(getDepthAtY(spawnY));
    box.setData('baseScale', box.scaleX);
    box.setData('hp', REWARD_BOX.hp);
    this.setBodySize(box, REWARD_BOX.size * REWARD_BOX.bodyRatio, REWARD_BOX.size * REWARD_BOX.bodyRatio);
    box.setVelocityY(REWARD_BOX.speed);
    const shadow = this.createShadow(
      REWARD_BOX.size * 0.9,
      getDepthAtY(spawnY) - 0.05,
    );
    shadow.setPosition(x, spawnY + REWARD_BOX.size * 0.42);
    box.setData('shadow', shadow);
  }

  private spawnBarrel(): void {
    const spawnY = -BARREL.size;
    // 优先贴着现存敌人落点，形成"打桶清场"的机会
    const activeEnemies = this.enemies
      .getChildren()
      .filter(
        (child) =>
          (child as Phaser.Physics.Arcade.Sprite).active &&
          (child as Phaser.Physics.Arcade.Sprite).y > 0 &&
          (child as Phaser.Physics.Arcade.Sprite).y < DANGER_LINE_Y,
      ) as Phaser.Physics.Arcade.Sprite[];
    let x: number;
    if (activeEnemies.length > 0) {
      const reference =
        activeEnemies[Phaser.Math.Between(0, activeEnemies.length - 1)];
      x = reference.x + Phaser.Math.Between(-gameUnits(120), gameUnits(120));
    } else {
      x = this.spawnTargetX(spawnY);
    }
    const bounds = getLaneBoundsAtY(spawnY);
    const edge = BARREL.size * 0.5;
    x = Phaser.Math.Clamp(x, bounds.left + edge, bounds.right - edge);

    const texture = resolveTexture(this, 'barrel', TEX.barrel);
    const barrel = this.barrels.create(x, spawnY, texture) as
      Phaser.Physics.Arcade.Sprite;
    barrel
      .setDisplaySize(BARREL.size, BARREL.size)
      .setDepth(getDepthAtY(spawnY));
    barrel.setData('baseScale', barrel.scaleX);
    barrel.setData('hp', BARREL.hp);
    this.setBodySize(barrel, BARREL.size * BARREL.bodyRatio, BARREL.size * BARREL.bodyRatio);
    barrel.setVelocityY(BARREL.speed);
    const shadow = this.createShadow(
      BARREL.size * 0.9,
      getDepthAtY(spawnY) - 0.05,
    );
    shadow.setPosition(x, spawnY + BARREL.size * 0.42);
    barrel.setData('shadow', shadow);
  }

  private spawnEnemy(): void {
    if (this.state !== 'playing') {
      return;
    }
    // 阵型：按本波序号分配横向车道 + 抖动；纵向随机错开，避免单列排队
    const laneCount = Math.max(1, ENEMY.formationLanes);
    const laneIndex = this.spawnedThisWave % laneCount;
    const jitterU = Phaser.Math.FloatBetween(-0.06, 0.06);
    const laneU = Phaser.Math.Clamp(
      ((laneIndex + 0.5) / laneCount) * 1.5 - 0.75 + jitterU,
      -0.75,
      0.75,
    );
    const spawnY =
      ENEMY.spawnTopY - ENEMY.height * ENEMY.spawnJitterRatio * Math.random();
    const spawnBounds = getLaneBoundsAtY(spawnY);
    const edge = ENEMY.width * 0.45;
    const spawnX = Phaser.Math.Clamp(
      GAME_CENTER_X + laneU * getLaneHalfWidthAtY(spawnY) * 0.92,
      spawnBounds.left + edge,
      spawnBounds.right - edge,
    );
    const enemyTexture = resolveTexture(this, 'enemy', TEX.enemy);
    const enemy = this.enemies.create(
      spawnX,
      spawnY,
      enemyTexture,
    ) as Phaser.Physics.Arcade.Sprite;
    enemy.setData('laneU', laneU);
    enemy.setData('swingPhase', Math.random() * Math.PI * 2);
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
      getDepthAtY(spawnY) - 0.05,
    );
    shadow.setPosition(spawnX, spawnY + ENEMY.height * 0.44);
    enemy.setData('shadow', shadow);

    // 头顶血量数字：跟随敌人下落，受击时逐发扣减。
    const hp = enemyHpForWave(this.wave);
    enemy.setData('hp', hp);
    const hpText = addGameText(
      this,
      spawnX,
      spawnY - ENEMY.height * ENEMY.hpTextOffsetRatio,
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
      .setDepth(getDepthAtY(spawnY) + 0.1);
    enemy.setData('hpText', hpText);
    enemy.setData('maxHp', hp);

    // 头顶小血条：背景 + 前景两个矩形，跟随敌人移动/缩放/层级
    const barWidth = ENEMY.width * ENEMY.hpBarWidthRatio;
    const barHeight = ENEMY.hpBarHeight;
    const barY = spawnY - ENEMY.height * ENEMY.hpBarOffsetRatio;
    const barBg = this.add
      .rectangle(spawnX, barY, barWidth, barHeight, 0x2b1b1b, 0.55)
      .setDepth(getDepthAtY(spawnY) + 0.06);
    const barFill = this.add
      .rectangle(spawnX - barWidth / 2, barY, barWidth, barHeight, 0x7ee081)
      .setOrigin(0, 0.5)
      .setDepth(getDepthAtY(spawnY) + 0.07);
    enemy.setData('hpBarBg', barBg);
    enemy.setData('hpBarFill', barFill);

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

  private isRaging(): boolean {
    return this.time.now < this.rageEndsAt;
  }

  /** 触发狂暴：剩余时长 +5 秒，总时长不超过上限；并按新状态重建开火定时器。 */
  private startRage(): void {
    const now = this.time.now;
    const remaining = Math.max(0, this.rageEndsAt - now);
    const stacked = Math.min(remaining + RAGE.durationMs, RAGE.maxStackMs);
    this.rageEndsAt = now + stacked;
    this.refreshFireTimer();
  }

  /**
   * 当前单发子弹伤害 = 基础伤害 + 累积伤害加成（加法叠加，非乘法复利）。
   * 血量内部为浮点，头顶数字向上取整显示。
   */
  private currentBulletDamage(): number {
    // 乘区公式：base × (1 + 加成)。加成小数累计（+30% = 0.3，上限 1.5），
    // 基础伤害为 1 时与加法形式等价；基础伤害调整后不会复利。
    return GROWTH.baseBulletDamage * (1 + this.damageBonus);
  }

  /**
   * 当前射击间隔 = 基础（或狂暴）间隔 ÷ (1 + 攻速加成)，再钳制下限。
   * 狂暴与攻速强化同时生效：狂暴在强化后的基础上进一步取更短间隔。
   */
  private currentFireInterval(): number {
    const base = this.isRaging() ? RAGE.fireIntervalMs : BULLET.fireIntervalMs;
    return Math.max(
      GROWTH.minFireIntervalMs,
      Math.round(base / (1 + this.attackSpeedBonus)),
    );
  }

  /** 按当前狂暴状态与攻速加成重建开火定时器。 */
  private refreshFireTimer(): void {
    this.fireTimer?.remove();
    this.fireTimer = this.time.addEvent({
      delay: this.currentFireInterval(),
      loop: true,
      callback: this.fire,
      callbackScope: this,
    });
  }

  /** 狂暴脚下光圈：跟随成员位置，激活时可见并呼吸；未激活隐藏。 */
  private updateAuras(raging: boolean): void {
    const pulse =
      1 + Math.sin((this.time.now / RAGE.pulseMs) * Math.PI) * 0.12;
    const members: Array<[Phaser.Physics.Arcade.Sprite, number]> = [
      [this.player, PLAYER.width * PLAYER.displayScale],
      ...this.squadFollowers.map(
        (follower) =>
          [follower, PLAYER.width * PLAYER.displayScale] as [
            Phaser.Physics.Arcade.Sprite,
            number,
          ],
      ),
    ];
    for (const [member, width] of members) {
      if (!member.active) {
        continue;
      }
      const aura = member.getData('aura') as
        | Phaser.GameObjects.Arc
        | undefined;
      if (!aura?.active) {
        continue;
      }
      if (!raging) {
        aura.setVisible(false);
        continue;
      }
      aura.setVisible(true);
      aura.setPosition(member.x, member.y + member.displayHeight * 0.55);
      aura.setScale(pulse * RAGE.auraScale);
      aura.setDepth(getDepthAtY(member.y) - 0.08);
    }
  }

  private fire(): void {
    if (this.state !== 'playing') {
      return;
    }
    const raging = this.isRaging();
    const muzzleOffsetY = PLAYER.height * PLAYER.displayScale * 0.42;
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
        .setDisplaySize(
          BULLET.size * BULLET.displayScale,
          BULLET.size * BULLET.displayScale * 2,
        )
        .setDepth(getDepthAtY(member.y - muzzleOffsetY) + 0.6);
      if (raging) {
        // 狂暴：子弹加暖黄高光并略微放大（只影响视觉）
        bullet.setTint(RAGE.bulletTint);
        bullet.setScale(bullet.scaleX * RAGE.bulletScale);
      }
      // 显示放大后仍需保证“实际碰撞尺寸 = BULLET.size”，按最终缩放反算源尺寸
      const bulletScale = bullet.scaleX || 1;
      if (bulletTexture === TEX.bullet) {
        // 程序化纹理：上半弹头、下半尾焰，碰撞体只取弹头区域
        (bullet.body as Phaser.Physics.Arcade.Body).setSize(
          BULLET.size / bulletScale,
          BULLET.size / bulletScale,
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

  /**
   * 子弹命中奖励箱：同帧防重复（子弹销毁后 active=false，后续回调自动跳过）。
   * 血量归零 → 开箱结算；未破只闪白。
   */
  private onBulletHitRewardBox(
    bulletObject: unknown,
    boxObject: unknown,
  ): void {
    if (this.state !== 'playing') {
      return;
    }
    const bullet = bulletObject as Phaser.Physics.Arcade.Sprite;
    const box = boxObject as Phaser.Physics.Arcade.Sprite;
    if (!bullet.active || !box.active) {
      return;
    }
    bullet.destroy();
    const hp = (box.getData('hp') as number) - this.currentBulletDamage();
    box.setData('hp', hp);
    if (hp > 0) {
      box.setTintFill(0xffffff);
      this.time.delayedCall(Math.round(FEEDBACK.hitFlashMs * 0.75), () => {
        if (box.active) {
          box.clearTint();
        }
      });
      return;
    }
    this.openRewardBox(box);
  }

  /** 子弹命中爆炸桶：血量归零 → 范围伤害 + 自毁（exploded 标记防重复触发）。 */
  private onBulletHitBarrel(bulletObject: unknown, barrelObject: unknown): void {
    if (this.state !== 'playing') {
      return;
    }
    const bullet = bulletObject as Phaser.Physics.Arcade.Sprite;
    const barrel = barrelObject as Phaser.Physics.Arcade.Sprite;
    if (!bullet.active || !barrel.active) {
      return;
    }
    bullet.destroy();
    const hp = (barrel.getData('hp') as number) - this.currentBulletDamage();
    barrel.setData('hp', hp);
    if (hp > 0) {
      barrel.setTintFill(0xffffff);
      this.time.delayedCall(Math.round(FEEDBACK.hitFlashMs * 0.75), () => {
        if (barrel.active) {
          barrel.clearTint();
        }
      });
      return;
    }
    this.explodeBarrel(barrel);
  }

  /** 开奖励箱：装备+1（未满）→ 护盾+1（无盾）→ 金币；满装备沿用狂暴+金币规则。 */
  private openRewardBox(box: Phaser.Physics.Arcade.Sprite): void {
    const x = box.x;
    const y = box.y;
    this.destroyTargetWithShadow(box);
    this.fx.deathBurst(x, y);

    if (this.weaponLevel < POWER_UP.maxWeaponLevel) {
      this.weaponLevel += 1;
      this.syncSquad();
      this.updateHud();
      floatText(this, x, y, '装备 +1！', '#38bdf8', { pop: true });
      return;
    }
    if (this.shieldCount < EQUIPMENT.shieldMax) {
      this.applyShield();
      return;
    }
    // 装备与护盾均已满：转为金币奖励
    this.coins += REWARD_BOX.coinReward;
    this.hud.setCoins(this.coins, true);
    this.spawnCoins(
      x,
      y,
      2,
      REWARD_BOX.coinReward / 2,
    );
    floatText(
      this,
      x,
      y,
      `金币 +${REWARD_BOX.coinReward}！`,
      '#facc15',
      { pop: true },
    );
  }

  /** 引爆炸弹桶：范围伤害走 hitEnemy 现有结算；桶自身立即销毁防重复。 */
  private explodeBarrel(barrel: Phaser.Physics.Arcade.Sprite): void {
    const x = barrel.x;
    const y = barrel.y;
    this.destroyTargetWithShadow(barrel);
    this.fx.barrelBlast(x, y);

    for (const child of [...this.enemies.getChildren()]) {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active || enemy.getData('dying')) {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance <= BARREL.blastRadius) {
        this.hitEnemy(enemy, BARREL.blastDamage);
      }
    }
  }

  /** 销毁奖励目标并连带清理影子。 */
  private destroyTargetWithShadow(target: Phaser.Physics.Arcade.Sprite): void {
    const shadow = target.getData('shadow') as
      | Phaser.GameObjects.Ellipse
      | undefined;
    this.tweens.killTweensOf(target);
    target.destroy();
    shadow?.destroy();
  }
  private hitEnemy(
    enemy: Phaser.Physics.Arcade.Sprite,
    damage: number = this.currentBulletDamage(),
  ): void {
    const hp = (enemy.getData('hp') as number) - damage;
    enemy.setData('hp', hp);
    const hpText = enemy.getData('hpText') as
      | Phaser.GameObjects.Text
      | undefined;

    if (hp > 0) {
      // 非致命：命中火花（有素材时）+ 短促闪白，不打断下落
      this.spawnHitSpark(enemy.x, enemy.y);
      enemy.setTintFill(0xffffff);
      this.time.delayedCall(Math.round(FEEDBACK.hitFlashMs * 0.75), () => {
        if (enemy.active) {
          enemy.clearTint();
        }
      });
      if (hpText?.active) {
        // 血量为浮点（伤害加成所致），头顶数字向上取整显示
        hpText.setText(String(Math.ceil(hp)));
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
    this.spawnHitSpark(enemy.x, enemy.y);
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
    this.destroyEnemySilently(enemy, x, y);
    this.score += ENEMY.score;
    this.updateHud();
    this.fx.killStain(x, y);
    this.spawnCoins(x, y);
    floatText(this, x, y - gameUnits(80), `+${ENEMY.score}`, '#fff8dc');
    this.checkWaveCleared();
  }

  /**
   * 静默销毁敌人（挂载物一并清理 + 爆散反馈），不结算分数/金币/飘字。
   * 供击杀、漏怪、碰撞消散三条路径复用。
   */
  private destroyEnemySilently(
    enemy: Phaser.Physics.Arcade.Sprite,
    x: number,
    y: number,
  ): void {
    const hpText = enemy.getData('hpText') as
      | Phaser.GameObjects.Text
      | undefined;
    const shadow = enemy.getData('shadow') as
      | Phaser.GameObjects.Ellipse
      | undefined;
    const hpBarBg = enemy.getData('hpBarBg') as
      | Phaser.GameObjects.Rectangle
      | undefined;
    const hpBarFill = enemy.getData('hpBarFill') as
      | Phaser.GameObjects.Rectangle
      | undefined;
    this.tweens.killTweensOf(enemy);
    enemy.destroy();
    hpText?.destroy();
    // 敌人销毁时其脚下投影必须一并销毁，否则会永久残留成灰色椭圆阴影
    shadow?.destroy();
    hpBarBg?.destroy();
    hpBarFill?.destroy();
    this.fx.deathBurst(x, y);
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
        '装备 +1！',
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

  /** 触发增益门：应用奖励并给出提示飘字（编队已满时自动转为金币/分数）。 */
  private applyGateReward(
    reward: GateReward,
    x: number,
    y: number,
  ): void {
    const color = `#${reward.color.toString(16).padStart(6, '0')}`;
    let toast = reward.toast;
    // 护盾成功时 applyShield 自带飘字，跳过末尾的统一飘字避免重复
    let skipToast = false;

    if (reward.squad > 0) {
      if (this.weaponLevel < POWER_UP.maxWeaponLevel) {
        this.weaponLevel += 1;
        this.syncSquad();
        this.player.setTint(0x38bdf8);
        this.time.delayedCall(180, () => {
          if (this.player.active) {
            this.player.clearTint();
          }
        });
      } else {
        // 满编：+1人 门转为狂暴射击，并附少量金币。
        // 预留：后续可把“超出上限的装备”转换为伤害加成（本轮不实现）。
        this.startRage();
        this.coins += GATE.squadFullCoins;
        this.hud.setCoins(this.coins, true);
        toast = GATE.squadFullToast;
      }
    } else if (reward.damage > 0) {
      // 伤害门：累积加成 + 上限钳制（加法叠加，不复利）
      this.damageBonus = Math.min(
        GROWTH.damageBonusCap,
        this.damageBonus + reward.damage,
      );
    } else if (reward.attackSpeed > 0) {
      // 攻速门：累积加成 + 上限钳制；重建开火定时器立即生效
      this.attackSpeedBonus = Math.min(
        GROWTH.attackSpeedBonusCap,
        this.attackSpeedBonus + reward.attackSpeed,
      );
      this.refreshFireTimer();
    } else if (reward.shield > 0) {
      if (this.shieldCount >= EQUIPMENT.shieldMax) {
        // 护盾已满：不浪费，转为少量金币
        this.coins += GATE.shieldFullCoins;
        this.hud.setCoins(this.coins, true);
        toast = `${GATE.shieldFullToast} +${GATE.shieldFullCoins}金币`;
      } else {
        this.applyShield();
        skipToast = true;
      }
    } else {
      // 保留型奖励（金币/分数门，供满编转换与未来系统使用）
      this.coins += reward.coins;
      this.score += reward.score;
      if (reward.coins > 0) {
        this.hud.setCoins(this.coins, true);
      }
    }

    this.updateHud();
    if (!skipToast) {
      floatText(this, x, y - gameUnits(60), toast, color, { pop: true });
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
    // 正在播放受击特效（已停止下落）的敌人不再触发玩家受伤。
    if (!enemy.active || enemy.getData('dying')) {
      return;
    }
    enemy.setData('dying', true);
    const x = enemy.x;
    const y = enemy.y;
    // 是否扣装备由 damagePlayer 决定（无敌期内忽略）；敌人一律销毁，
    // 杜绝无敌结束后同一个敌人贴着小队重复造成伤害。
    this.damagePlayer();
    this.destroyEnemySilently(enemy, x, y);
  }

  update(_time: number, delta: number): void {
    const deltaSeconds = delta / 1000;
    this.cloudField?.update(deltaSeconds);
    this.runway.updateDashes(deltaSeconds);
    if (this.state !== 'playing') {
      return;
    }
    // 狂暴状态：进入/退出时切换开火间隔，同步脚下光圈与 HUD
    const raging = this.isRaging();
    if (raging !== this.rageWasActive) {
      this.rageWasActive = raging;
      this.refreshFireTimer();
    }
    this.updateAuras(raging);
    this.hud.setRage(
      raging,
      raging ? this.rageEndsAt - this.time.now : 0,
      RAGE.maxStackMs,
    );
    this.swingTime += deltaSeconds;
    this.handleMovement(deltaSeconds);
    this.playerShadow?.setPosition(
      this.player.x,
      this.player.y + PLAYER.height * 0.44,
    );
    this.updateSquadFormation(deltaSeconds);
    this.syncPerspective();
    // 门触发以玩家本体（小队中心）为准：跟随成员不单独触发，
    // 避免 8 人编队宽度变大后同时吃到两个门。
    this.gates.update(deltaSeconds, [this.player]);
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
      .ellipse(0, 0, width, width * 0.3, 0x10253a, 0.36)
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

  /** 狂暴脚下光圈（平时隐藏，由 updateAuras 控制显隐与呼吸）。 */
  private createAura(width: number): Phaser.GameObjects.Arc {
    return this.add
      .circle(0, 0, width / 2, RAGE.auraColor, RAGE.auraAlpha)
      .setDepth(getDepthAtY(PLAYER_Y) - 0.08)
      .setVisible(false);
  }

  /** 当前编队等级对应的跟随者阵位（dx 为 squadSpread 的倍数，row 为行号）。 */
  private squadSlots(): ReadonlyArray<{
    readonly dx: number;
    readonly row: number;
  }> {
    const level = Phaser.Math.Clamp(this.weaponLevel, 1, PLAYER.maxSquadSize);
    return SQUAD_FORMATION[level] ?? [];
  }

  /** 按当前装备等级同步跟随成员数量（可增可减，减员走 removeFollower 清理）。 */
  private syncSquad(): void {
    const slots = this.squadSlots();
    // 装备减少：先移除多出的跟随成员（保持数组与阵位一致）
    while (this.squadFollowers.length > slots.length) {
      this.removeFollower(this.squadFollowers.length - 1);
    }
    while (this.squadFollowers.length < slots.length) {
      const index = this.squadFollowers.length;
      const slot = slots[index];
      const followerTexture = resolveTexture(this, 'player', TEX.player);
      const follower = this.physics.add
        .sprite(
          this.player.x + slot.dx * PLAYER.squadSpread,
          PLAYER_Y + PLAYER.squadYOffset * slot.row,
          followerTexture,
        )
        .setDisplaySize(
          PLAYER.width * PLAYER.displayScale,
          PLAYER.height * PLAYER.displayScale,
        )
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
      follower.setData(
        'aura',
        this.createAura(PLAYER.width * PLAYER.displayScale),
      );
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

  /** 移除指定下标的跟随成员：连带清理影子、光圈与 tween，避免残留。 */
  private removeFollower(index: number): void {
    const follower = this.squadFollowers[index];
    if (!follower) {
      return;
    }
    this.squadFollowers.splice(index, 1);
    const shadow = follower.getData('shadow') as
      | Phaser.GameObjects.Ellipse
      | undefined;
    const aura = follower.getData('aura') as
      | Phaser.GameObjects.Arc
      | Phaser.GameObjects.Graphics
      | undefined;
    this.tweens.killTweensOf(follower);
    follower.destroy();
    shadow?.destroy();
    aura?.destroy();
  }

  /**
   * 装备受伤入口：本体或任意成员被敌人接触时调用。
   * 优先消耗护盾 → 其次损失一个装备（移除最外侧跟随成员）→ 只剩本体时 Game Over。
   */
  private damagePlayer(): void {
    if (this.state !== 'playing') {
      return;
    }
    if (this.time.now < this.invincibleUntil) {
      return;
    }

    // 1. 护盾优先抵伤
    if (this.shieldCount > 0) {
      this.shieldCount -= 1;
      this.updateHud();
      this.startInvincibility();
      floatText(
        this,
        this.player.x,
        this.player.y - PLAYER.height * PLAYER.displayScale,
        '护盾抵挡！',
        '#7dd3fc',
        { pop: true },
      );
      return;
    }

    // 2. 还有跟随成员：损失一个装备（最后加入 = 最外侧阵位）
    if (this.squadFollowers.length > 0) {
      const index = this.squadFollowers.length - 1;
      const lostX = this.squadFollowers[index].x;
      const lostY = this.squadFollowers[index].y;
      this.removeFollower(index);
      this.weaponLevel = Math.max(1, this.weaponLevel - 1);
      this.syncSquad();
      this.startInvincibility();
      this.updateHud();
      floatText(this, lostX, lostY, '-1 装备', '#fca5a5', { pop: true });
      return;
    }

    // 3. 只剩本体：Game Over
    this.gameOver();
  }

  /** 受伤后的短暂无敌：全员半透明闪烁，期间不重复扣装备。 */
  private startInvincibility(): void {
    this.invincibleUntil = this.time.now + EQUIPMENT.invincibleMs;
    const members = [this.player, ...this.squadFollowers];
    for (const member of members) {
      this.tweens.killTweensOf(member);
      this.tweens.add({
        targets: member,
        alpha: { from: 0.3, to: 1 },
        duration: EQUIPMENT.invincibleMs / 6,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
    this.time.delayedCall(EQUIPMENT.invincibleMs, () => {
      this.endInvincibility();
    });
  }

  private endInvincibility(): void {
    this.invincibleUntil = 0;
    if (this.state === 'over') {
      return;
    }
    for (const member of [this.player, ...this.squadFollowers]) {
      this.tweens.killTweensOf(member);
      member.setAlpha(1);
    }
  }

  /**
   * 预留接口：护盾门 / 奖励箱等后续玩法调用。
   * 超过 EQUIPMENT.shieldMax 不叠加。
   */
  applyShield(): void {
    if (this.state !== 'playing') {
      return;
    }
    if (this.shieldCount >= EQUIPMENT.shieldMax) {
      return;
    }
    this.shieldCount += 1;
    this.updateHud();
    floatText(
      this,
      this.player.x,
      this.player.y - PLAYER.height * PLAYER.displayScale,
      '护盾！',
      '#7dd3fc',
      { pop: true },
    );
  }

  /** 跟随成员平滑贴向阵位（略滞后于本体，形成编队弹性）。 */
  private updateSquadFormation(deltaSeconds: number): void {
    const slots = this.squadSlots();
    const smoothing = 1 - Math.exp(-PLAYER.squadLerp * deltaSeconds);
    this.squadFollowers.forEach((follower, index) => {
      const slot = slots[index];
      const targetX = this.clampToLane(
        this.player.x + (slot?.dx ?? 0) * PLAYER.squadSpread,
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
    for (const child of [...this.enemies.getChildren()]) {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active || enemy.getData('leaked')) {
        continue;
      }
      if (enemy.getBounds().bottom >= DANGER_LINE_Y) {
        // 漏怪：销毁敌人并按装备规则扣损（无敌期不扣），装备归零才 Game Over。
        // 提示复用 damagePlayer 的 "-1 装备"/"护盾抵挡！"，不重复堆叠文字。
        enemy.setData('leaked', true);
        const x = enemy.x;
        const y = enemy.y;
        this.destroyEnemySilently(enemy, x, y);
        this.damagePlayer();
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
    // 奖励箱 / 爆炸桶越过危险线：直接销毁，不给奖励、不扣装备
    for (const group of [this.rewardBoxes, this.barrels]) {
      for (const child of group.getChildren()) {
        const target = child as Phaser.Physics.Arcade.Sprite;
        if (target.active && target.y > DANGER_LINE_Y) {
          this.destroyTargetWithShadow(target);
        }
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
      shieldCount: this.shieldCount,
      damageBonus: this.damageBonus,
      attackSpeedBonus: this.attackSpeedBonus,
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
      const isDying = enemy.getData('dying') === true;
      // 沿透视车道下落 + 轻微左右摆动：只改 x，不影响下落速度与难度
      if (!isDying) {
        const laneU = (enemy.getData('laneU') as number) ?? 0;
        const phase = (enemy.getData('swingPhase') as number) ?? 0;
        const halfWidth = getLaneHalfWidthAtY(enemy.y);
        const swing =
          (Math.sin(this.swingTime * ENEMY.swingSpeed + phase) *
            ENEMY.swingAmplitude) /
          Math.max(halfWidth, 1);
        const bounds = getLaneBoundsAtY(enemy.y);
        const edge = ENEMY.width * 0.45;
        enemy.x = Phaser.Math.Clamp(
          GAME_CENTER_X + (laneU + swing) * halfWidth * 0.92,
          bounds.left + edge,
          bounds.right - edge,
        );
        // 正在播放受击放大动画的敌人不覆盖其 scale，避免 tween 被每帧重置。
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
      const hpBarBg = enemy.getData('hpBarBg') as
        | Phaser.GameObjects.Rectangle
        | undefined;
      const hpBarFill = enemy.getData('hpBarFill') as
        | Phaser.GameObjects.Rectangle
        | undefined;
      if (hpBarBg?.active && hpBarFill?.active) {
        const maxHp = (enemy.getData('maxHp') as number) ?? 1;
        const hp = (enemy.getData('hp') as number) ?? 1;
        const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
        const barWidth = ENEMY.width * scale * ENEMY.hpBarWidthRatio;
        const barHeight = ENEMY.hpBarHeight * scale;
        const barY = enemy.y - ENEMY.height * scale * ENEMY.hpBarOffsetRatio;
        hpBarBg.setPosition(enemy.x, barY);
        hpBarBg.setSize(barWidth, barHeight);
        hpBarBg.setDepth(depth + 0.06);
        hpBarFill.setPosition(enemy.x - barWidth / 2, barY);
        hpBarFill.setSize(barWidth * ratio, barHeight);
        hpBarFill.setDepth(depth + 0.07);
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

    // 奖励箱 / 爆炸桶：缩放 + 层级 + 影子（碰撞体由 setBodySize 按最终 scale 反算，判定不漂移）
    for (const group of [this.rewardBoxes, this.barrels]) {
      for (const child of group.getChildren()) {
        const target = child as Phaser.Physics.Arcade.Sprite;
        if (!target.active) {
          continue;
        }
        const targetBaseScale = (target.getData('baseScale') as number) ?? 1;
        const targetScale = getPerspectiveScaleAtY(target.y);
        target.setScale(targetBaseScale * targetScale);
        target.setDepth(getDepthAtY(target.y));
        const targetShadow = target.getData('shadow') as
          | Phaser.GameObjects.Ellipse
          | undefined;
        if (targetShadow?.active) {
          targetShadow.setPosition(
            target.x,
            target.y + target.displayHeight * 0.46,
          );
          targetShadow.setScale(targetScale);
          targetShadow.setDepth(getDepthAtY(target.y) - 0.05);
        }
      }
    }

    // 子弹：只排序层级，不改缩放（保持命中判定与观感稳定）
    for (const child of this.bullets.getChildren()) {
      const bullet = child as Phaser.Physics.Arcade.Sprite;
      if (bullet.active) {
        bullet.setDepth(getDepthAtY(bullet.y) + 0.6);
      }
    }
  }

  /** 命中火花：仅当 hit_spark_sprite 素材存在时播放，短暂缩放淡出后自毁。 */
  private spawnHitSpark(x: number, y: number): void {
    if (!hasOptionalTexture(this, 'hitSpark')) {
      return;
    }
    const spark = this.add
      .image(x, y, OPTIONAL_TEX.hitSpark)
      .setDisplaySize(FEEDBACK.hitSparkSize, FEEDBACK.hitSparkSize)
      .setDepth(getDepthAtY(y) + 0.5);
    this.tweens.add({
      targets: spark,
      scale: spark.scale * 1.35,
      alpha: 0,
      duration: FEEDBACK.hitSparkMs,
      ease: 'Quad.out',
      onComplete: () => spark.destroy(),
    });
  }

  /**
   * 金币飞向 HUD：默认敌人掉落（数量随机、每枚 +1）。
   * 奖励箱等大额奖励可指定数量与每枚面值。
   */
  private spawnCoins(
    x: number,
    y: number,
    count: number = Phaser.Math.Between(ENEMY.coinDropMin, ENEMY.coinDropMax),
    valuePerCoin = 1,
  ): void {
    const coinTexture = resolveTexture(this, 'coin', TEX.coin);
    const displaySize = ENEMY.coinSize * getPerspectiveScaleAtY(y);
    for (let index = 0; index < count; index += 1) {
      const coin = this.add
        .image(
          x + Phaser.Math.Between(-gameUnits(40), gameUnits(40)),
          y + Phaser.Math.Between(-gameUnits(24), gameUnits(24)),
          coinTexture,
        )
        .setDisplaySize(displaySize, displaySize)
        .setDepth(getDepthAtY(y) + 0.3)
        .setScale(0);
      this.tweens.add({
        targets: coin,
        scale: 1,
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
              this.coins += valuePerCoin;
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
    // 先终止无敌闪烁 tween，再定格半透明表现
    this.tweens.killTweensOf([this.player, ...this.squadFollowers]);
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
