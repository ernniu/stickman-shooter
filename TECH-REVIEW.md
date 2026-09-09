# 云端火柴人射击 · 技术评审说明（v0.5b）

> 本文整合「项目技术现状」与「技术实现细节」，供外部专家评审技术路线与后续方向。
> 代码基线：v0.5b（含 v0.1 基础玩法 → v0.2 操作/反馈/UI → v0.3 血量/金币/编队 → v0.5 视觉升级）。

---

## 一、项目定位

竖屏 **2D 休闲射击**小游戏，目标端 **手机浏览器**（兼顾 PC 键盘调试）。

玩法为**驻守射击**：玩家固定在跑道底部左右移动，子弹自动发射，敌人从顶部落下；敌人越过底部危险线或撞到玩家即失败。

---

## 二、技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 引擎 | Phaser 3.90 | Canvas / WebGL 自动切换，`Scale.FIT + CENTER_BOTH` |
| 构建 | Vite 8.2 | `server.hmr: false`（刻意关闭，避免热更打断游戏状态） |
| 语言 | TypeScript 5.9，`strict: true` | 全量严格模式 |
| 包管理 | pnpm 9（corepack 锁定） | `packageManager: pnpm@9.0.0` |
| 运行环境 | Node 22（Docker 容器） | 宿主机不装 Node，容器 `-p 5173:5173` 提供 dev server |
| 美术 | **100% 程序化绘制** | CanvasTexture / Graphics，零外部图片素材 |
| 音频 | 无 | 未引入 |

---

## 三、架构与关键模块

```
src/
├── main.ts                  入口，PhaserBridge 绑定（Coze 平台）
├── game-flow/createGame.ts  Phaser.Game 配置 + LaunchSpec → 场景入口映射
├── rendering.ts             设计基准 / 设备档位 / 单位换算（gameUnits、gamePixels）
├── layout.ts                contain / cover 图片适配
├── assets.ts                素材 key 注册（当前 IMAGES/VIDEOS/AUDIOS 均为空）
├── types.ts / global.d.ts   类型 + 全局声明（LaunchSpec、Window.PhaserBridge）
├── game/
│   ├── gameConfig.ts        全部数值配置（9 个配置块）
│   ├── textures.ts          程序化纹理 + 背景 + 跑道绘制 + 跑步动画注册
│   └── ui.ts                字体、飘字 floatText、按钮、HUD 胶囊底板
├── scene/                   Boot / DevLoading / Menu / Game / GameOver
└── utils/                   asset-loader、mark-editable（平台可编辑标记）
```

**坐标体系**

- 桌面基准 `2160×3840`，移动端 `1080×1920`（0.5 档位）。
- 启动时按 UA / 指针能力**一次性**选定档位，可用 `?renderProfile=mobile|desktop` 手动覆盖。
- 所有尺寸 / 速度 / 字号经 `gameUnits()` 换算，Scene、相机、指针、碰撞统一坐标系。

**数值集中**：`gameConfig.ts` 含 `PLAYER / ENEMY / BULLET / POWER_UP / HUD / FEEDBACK / PROGRESS / KILL_STAIN / RUNWAY` 九个配置块，玩法与视觉参数均在此调整。

---

## 四、已实现功能（v0.1 → v0.5b）

### 4.1 玩法

- 双输入：手指拖动 + 键盘 `←/→/A/D`；指数插值平滑跟随 + 最大速度钳制，无瞬移。
- 跑道边界约束（基于实际绘制的跑道边界，非硬编码 margin）。
- 自动射击（300ms / 发，与武器等级无关）。
- **武器等级 = 编队人数**（1 → 2 → 3 人）：V 形编队、弹性跟随、全员齐射。
- 波次系统：每波 `4 + 2n` 个敌人、速度逐波递增、每 2 波掉落道具、清波自动进入下一波。
- 敌人血量数字：第 n 波 `2 + ⌊(n-1)/2⌋` 血，逐发扣减，非致命不停顿。
- 金币掉落：弹出 → 飞向右上角 HUD 入账。
- 分数 / 波次 / 编队 / 金币 HUD；localStorage 保存最高分与最高波次（**各自取 max，互不覆盖**）。

### 4.2 流程与反馈

- 开局提示层（ready 状态，点击开始；结算页"再来一局"跳过）。
- 波次横幅"第 X 波"缩放弹出；清波提示"清空！"。
- 受击：闪白 + 数字弹跳；死亡：爆炸（白光 + 圆环 + 8 碎片）。
- 击杀血渍随跑道滚动淡出；"+10"飘字上移淡出。
- Game Over：轻微震屏 + 红光 + 全员动画定格。

### 4.3 视觉

- 背景：四段渐变天空 + 太阳光晕 + 两层波浪云海 + 四角暗角。
- 跑道：护栏阴影带 + 明暗条纹 + 白边线 + 滚动虚线。
- 角色：白描边剪影 + 两帧迈步动画 + 脚下椭圆投影。
- 子弹：粉色光弹（弹头 + 渐隐尾焰，静态纹理实现拖尾）。
- HUD：半透明胶囊底板 + 右侧关卡进度条（5 波一关，顶部旗帜）。

### 4.4 移动端适配

viewport 禁缩放、`touch-action: none`、`overscroll-behavior: none`、禁选中 / 长按菜单 / 点击高亮、`body` 固定防橡皮筋、脚本兜底禁双指与双击缩放。

### 4.5 性能策略

- 特效数量固定（碎片 8、金币 ≤ 2/杀），无粒子发射器。
- 所有 tween / 临时文本 / 图形 `onComplete` 自毁。
- 进度条等为**事件驱动重绘**，非每帧；`update` 中不创建对象。

---

## 五、当前效果定位与能力边界

画面现状：**明快的 2D 卡通竖版射击**——蓝天云海跑道、白描边剪影小人奔跑、粉色弹幕、爆炸血渍、胶囊 HUD、关卡进度条。

与参考效果图（3D 低模兵群跑酷）的差距**根因**：

| 维度 | 参考图 | 本项目 | 性质 |
|---|---|---|---|
| 渲染 | 3D 引擎实时渲染（透视 / 光影 / 体积） | Phaser 2D 程序化绘制 | **媒介差距，非优化可弥补** |
| 视角 | 斜俯视 3D，小人背对镜头往深处跑 | 正面 2D，角色固定底部举枪 | 构图不同 |
| 玩法结构 | 跑酷推进（选择门、关卡终点） | 驻守射击（守底线） | 设计定位不同 |
| 角色规模 | 数十个小兵的兵群 | 1~3 人编队 | 规模不同 |

---

## 六、已知技术债

1. **平台（Coze）耦合**：`markEditable` 散布在场景代码 10+ 处；`assets.ts` 模块顶层调用 `window.PhaserBridge`；`vite.config.ts` 注入外部 CDN bridge（带时间戳防缓存）；全局类型 `declare global`。
2. **配置模块副作用**：`gameConfig` 顶层调用 `gameUnits()`，依赖 `rendering` 顶层的设备档位判定（读 `navigator/window`），数值在 import 时固化；档位判定不可单测、运行时不可切换。
3. **GameScene 过重**：约 800+ 行，承担输入 / 移动 / 波次 / 开火 / 结算 / HUD / 特效 / 流程；`init()` 手动重置 16 个字段，易漏状态。
4. **构建脚本非常规**：`preinstall-guard.sh` 拦截标准 `pnpm install`，依赖装到 `/tmp/coze-phaser-runtime`（重启即失），离开 Coze 环境不友好。
5. **零工程化**：无 ESLint / Prettier、无测试框架、无 CI；纯函数（`selectGameRenderProfile`、`fitImage`、`enemyHpForWave`）本可低成本覆盖。
6. Scene 内仍存少量魔法数（碰撞体比例、部分延迟时长），与"数值集中"约定略有出入。

---

## 七、后续三条路线

| 路线 | 内容 | 效果 | 工作量 | 风险 |
|---|---|---|---|---|
| **A 收敛** | 继续 2D 程序化打磨（动效、连击、拾取星光） | 精致 2D 卡通，天花板明确 | 小（1~2 轮） | 低 |
| **B 引入素材** | 接入 2D 美术素材（背景 / 角色序列帧 / 图标），替换程序化纹理 | 观感跳一档，仍是 2D | 中（素材准备为主 + 接入改造） | 中（风格统一、版权） |
| **C 3D 重做** | 换 Three.js / Babylon 重写，复刻参考图视角与光影 | 真正接近效果图 | 大（等于新项目） | 高（现有迭代废弃） |

---

## 八、请专家决策的问题

1. 验收标准是"2D 卡通风可接受"，还是"必须接近参考图的 3D 观感"？（决定 A/B vs C）
2. 若走 B：是否允许解除"零图片素材"约束？素材预算与来源（AI 生成 / 素材站 / 外包）？
3. 玩法是否要向参考图靠拢（跑酷推进 + 选择门 + 兵群），还是维持当前驻守射击定位？
4. 是否清理 Coze 平台耦合与非常规构建脚本（影响可移植性与团队协作）？
5. 是否补测试 / lint / CI（当前为零）？

---

## 九、技术实现细节

### 9.1 输入与移动

```
handleMovement(dt)
├─ pointerId ≠ null（手指按下）→ 拖动优先，targetX 由事件更新
└─ 否则键盘：direction = 右 - 左 → targetX = clamp(player.x + dir × moveSpeed × dt)

moveTowardsTarget(dt)
  distance = targetX - player.x
  |distance| ≤ 0.5                      → 直接吸附（避免浮点抖动）
  smoothing = 1 - e^(-followLerp × dt)  ← 帧率无关的指数插值
  step = clamp(distance × smoothing, ±moveSpeed × dt)  ← 近距减速、远距限速
  player.x = clampToLane(player.x + step)
```

- **拖动为相对模式**：`pointerdown` 时记 `dragOffsetX = player.x - pointer.worldX`，之后 `targetX = pointer.x + offset`——手指可停在屏幕任意位置操控，避免"必须按在角色身上"和手指遮挡；只跟踪第一根手指（`pointerId`），多指不打架。
- **边界基于实际跑道**：`clampToLane` 使用 `drawRunway` 返回的 `laneLeft / laneRight`（= `RUNWAY_MARGIN_X` 与 `GAME_WIDTH - RUNWAY_MARGIN_X`），内缩 `PLAYER.width × 0.35`。
- 键盘走同一套平滑 + 钳制，PC 与手机手感一致。

### 9.2 编队系统

| 项 | 实现 |
|---|---|
| 人数映射 | 武器等级 1/2/3 = 编队 1/2/3 人；`FOLLOWER_DX`：`1: []`、`2: [+150]`、`3: [-150, +150]` |
| 成员创建 | `syncSquad()` 按等级**只增不减**补建；本体是中心成员，跟随者 y 落后 `squadYOffset(60)` 呈 V 形 |
| 跟随 | `follower.x += (clamp(player.x + dx) - follower.x) × smoothing`，`squadLerp = 14`（略滞后于本体 `followLerp = 12`，形成弹性拖尾） |
| 开火 | `fire()` 遍历 `[player, ...followers]`，每成员 1 发**平行弹**（`velocity(0, -2600)`），枪口 `member.y - height × 0.52` |
| 碰撞 / 拾取 | 每个跟随者独立注册 `overlap(enemies)` 与 `overlap(powerUps)`，与本体同等承伤、同等拾取 |

### 9.3 血量、金币与进度

- **血量**：`enemyHpForWave(w) = 2 + ⌊(w-1)/2⌋`（第 1-2 波 2 血，3-4 波 3 血……）。
- **扣血分支**（`hitEnemy`）：
  - `hp > 0`：`setTintFill(白)` + 60ms 后 `clearTint` + 数字弹跳（`scale 1.35`，70ms yoyo）—— **不打断下落**；
  - `hp ≤ 0`：置 `dying = true`、`velocityY = 0`（停住）、放大 `1.15`（80ms）→ `killEnemy`。
- **防重复结算**：`onBulletHitEnemy` 见 `dying` 只销毁子弹；`onPlayerTouchedByEnemy` 跳过 `dying` 敌人（避免"停在半空的敌人"误判 Game Over）。
- **金币**：`spawnCoins` 掉 1~2 枚 → 弹出（`Back.out` 90ms，间隔 45ms）→ 飞向 HUD 图标（`Cubic.in` 420ms）→ 入账 + 数字/图标弹跳。
- **进度**：`progress = ((wave-1) % 5 + killedThisWave / waveTotal) / 5`，`killed = spawnedThisWave - 存活数`；**事件驱动重绘**（在 `updateHud` 中触发），非每帧。

### 9.4 特效生命周期（全部自毁）

| 特效 | 构成 | 时长 | 销毁 |
|---|---|---|---|
| 死亡爆炸 | 白光圆（46 → ×1.7）+ 圆环（30 → ×2.6）+ **8 个**红色碎片（扇形 + 随机距离） | 180~360ms | 各自 `onComplete: destroy` |
| 击杀血渍 | 椭圆（半径 46~72，×1.2 压扁），depth −4 | ≤2000ms，随跑道 `scrollSpeed(560)` 下滚并淡出 | tween 结束 |
| 加分飘字 | Text（64 设计单位）上移 140 + 淡出 | 900ms | `onComplete: destroy` |
| 拾取提示 | 同飘字 + `pop`（scale 0.4 → 1，`Back.out` 220ms） | 900ms | 同上 |
| 波次 / 清波横幅 | 复用同一 Text：alpha 0→1、scale 0.6→1，hold 620ms 后 yoyo | ~1060ms | 归零复用，不新建 |
| Game Over | 震屏 `shake(260ms, 0.008)` + 红光淡入 + 全员动画暂停 | 950ms 后切场景 | 随场景切换 |

### 9.5 程序化纹理规格

| 纹理 | 尺寸 | 绘制要点 |
|---|---|---|
| 火柴人（玩家 / 敌人 × 2 帧） | 240×340 | `drawLimbs(48, 白)` 打底 → `drawLimbs(30, 主色)` 叠剪影；头：白圆 r48 + 实心 r36；双腿两帧坐标 `56/184`（迈步）↔ `92/148`（收腿）；敌人加白眼红瞳 |
| 子弹 | 36×72 | 三角尾渐变 `rgba(249,168,212,.9) → 0`；弹头 `#f472b6` r15 + 白心 r8 |
| 金币 | 96×96 | `#b45309` r42 / `#fbbf24` r36 / 描边 `#d97706` r24 / 高光白点 |
| 天空 | 8×512 | 四段 `#2b6cb8 → #5ba3dd(.4) → #9ed2f2(.7) → #eef9ff`，纵向拉伸 |
| 太阳 / 暗角 | 256×256 / 512×512 | 径向渐变（暖黄光晕 / 边缘 `rgba(10,22,44,.4)`、中心透明） |
| 跑道 | Graphics | 护栏阴影带 `0x274b73` α.3（宽 40）+ 路面 α.18 圆角 90 + 明暗条纹（周期 260，α.07）+ 白边线 α.75（宽 10）+ 滚动虚线 α.2 |

**显示 / 碰撞体对应**（Arcade body 尺寸 = 纹理空间 size × sprite.scale）：

- 玩家 / 敌人：`displaySize(240, 340)`；玩家 `body(0.72w, 0.9h, center)`，敌人 `body(0.66w, 0.88h, center)`。
- 子弹：`displaySize(24, 48)`，`body(24, 24, center = false)`——纹理改为 36×72（上半弹头、下半尾焰）后，碰撞体**只取上半弹头区**，实际判定尺寸与改版前逐像素一致。

### 9.6 状态机与生命周期

```
GameScene
 init(data? { skipIntro }) → 重置 16 个实例字段（coins / squadFollowers / readyLayer / pointerId …）
 create()                  → 纹理 + 动画注册 → 背景 / 跑道 → 物理对象 → HUD → 输入绑定
   ├ skipIntro = false     → buildReadyOverlay()（state='ready'，遮罩 depth 40 + 呼吸提示）
   │                          点击 → startGame()：销毁提示层（killTweensOf + destroy）→ 开火定时器 + startWave(1)
   └ skipIntro = true      → 直接 startGame()（Game Over 页"再来一局"传入）
 update()                  → 云 / 跑道虚线（常驻）→ state === 'playing' 时：
                             移动 → 编队 → 玩家影子 → 血条 / 影子同步 → 危险线 → 清理出场对象
 gameOver()                → physics.pause + shake + tint + anims.pause + 红光 → 950ms → scene.start('game-over', { score, wave })
 shutdown()                → 移除 pointer 监听 + 清理 4 个 timer
```

- 场景导航：`BootScene` 加载完成后读 `registry.launchTarget` 决定入口，默认 `menu`。
- 结算数据：`scene.start('game-over', { score, wave })`；`writeBestRecord` **内部按分数 / 波次各自取 max 合并**后写 localStorage。

### 9.7 平台耦合点（精确定位）

| 位置 | 内容 |
|---|---|
| `src/main.ts` | `window.PhaserBridge?.bind({ launchGame })`，无 bridge 时仍可独立启动 |
| `src/assets.ts` | **模块顶层**执行 4 个 `markXxxAssetMap`（import 即副作用） |
| `src/utils/mark-editable.ts` | `window.PhaserBridge?.markEditable?.(...) ?? gameObject`，散布各 Scene 10+ 处 |
| `vite.config.ts` | `injectPhaserBridge` 插件向 `<head>` 注入 CDN 脚本（`async: true`，URL 带 `Date.now()` 防缓存） |
| `src/global.d.ts` | `declare global { LaunchSpec / PhaserBridgeApi / Window.PhaserBridge }` |
| `scripts/*.sh` | `preinstall-guard` 拦截标准安装，依赖落于 `/tmp/coze-phaser-runtime` |

### 9.8 实现中的坑与规避（已处理）

1. **`body.setSize` 是纹理空间坐标**：改子弹纹理后必须 `center = false` 对齐弹头，否则判定区跑到尾焰上。
2. **`fillRoundedRect` 圆角不得大于半高**：进度条填充高度极小时用 `min(width/2, fillHeight/2)` 兜底。
3. **`init()` 手动重置易漏**：已集中在 `init` 内重置（16 项），但仍属隐患点。
4. **档位固化**：`gameConfig` 顶层调用 `gameUnits()`，数值在 import 时按当时档位固化，运行时不可切换、档位判定难单测。
5. **开发体验**：`hmr: false`，改代码后必须**手动硬刷新**（Ctrl+Shift+R / 手机清缓存）。
6. **层级选择**：云海 `-9.8`、暗角 `-3`、影子 `3~4`、角色 `5`、子弹 `6`、HUD `9~12`、提示层 `40+`——确保暗角不压角色、影子在角色脚下。

### 9.9 性能现状

- 同屏峰值对象（后期波次）：敌人 ≤ 20（每个 + 1 血条 Text + 1 影子 Ellipse）、子弹 ~30、金币 ~10、飘字 ~5、特效 ~10 图元——量级在数百以内，Canvas 2D 无压力。
- 无粒子发射器、无每帧对象创建（进度条 / 血条为事件驱动或位置同步，非新建）。
- 未做对象池（当前规模不需要；若敌人规模上到 100+ 需引入）。

---

## 十、附录：核心配置入口（`src/game/gameConfig.ts`）

| 配置块 | 关键字段 | 用途 |
|---|---|---|
| `PLAYER` | `moveSpeed`、`followLerp`、`halfWidthRatio`、`squadSpread`、`squadYOffset`、`squadLerp` | 移动手感与编队 |
| `ENEMY` | `baseSpeed`、`speedPerWave`、`baseHp`、`hpWaveStep`、`coinDropMin/Max`、`coinFlyMs` | 难度与掉落 |
| `BULLET` | `speed`、`size`、`fireIntervalMs` | 射击节奏 |
| `POWER_UP` | `dropEveryWaves`、`maxWeaponLevel`、`maxedBonusScore` | 道具与编队上限 |
| `FEEDBACK` | `hitFlashMs`、`hitScale`、`explosionShards/Radius/DurationMs`、`shakeDurationMs/Intensity` | 打击与震屏反馈 |
| `PROGRESS` | `wavesPerLevel`、`marginX`、`barWidth`、`fillColor`、`flagColor` | 关卡进度条 |
| `KILL_STAIN` | `alpha`、`minRadius/maxRadius`、`fadeMs`、`scrollSpeed` | 击杀血渍 |
| `RUNWAY` | `dashSpacing`、`scrollSpeed`、`sideWidth`、`stripeHeight` | 跑道滚动与立体感 |
| `HUD` | `marginX`、`y`、`fontSize`、`pillHeight` | 顶部 HUD 布局 |

> 提示：全部数值以**桌面设计基准（2160×3840）**表达，运行时经 `gameUnits()` 按档位换算；调整配置后需**手动硬刷新**浏览器（`hmr: false`）。
