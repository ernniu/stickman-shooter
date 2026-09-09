# Assets

## Production Visual Target

- 路径：`assets/image/production-visual-target-v1/`（payload：`production-visual-target.jpg`，1600×2848 JPEG，已通过 `lineage.validate_asset_root`）
- 目标视口：`2160x3840`（游戏运行时自适应档位，移动端 `1080x1920`）
- 职责：摄像机（固定竖屏卷轴）、投影（正俯视）、主体比例（火柴人约占屏宽 12%）、画面密度、色彩与材质基调、最终运行画面验收基线
- QA 记录：全部玩法元素与层级符合（HUD 分数/波次、蓝天渐变、白色半透明跑道、红色敌群、黑色玩家举枪、黄色子弹、紫色升级道具、底部红色虚线危险线与警示区）；已记录小偏差：画面含标题字样（实际玩法画面无）、跑道带透视装饰（实际为等宽）、道具箭头数为 1（实现为双箭头）。均不影响基线职责。

## Fixed Global Style Description

```text
明快清爽的手机休闲小游戏扁平卡通插画风。晴朗蓝天由深蓝渐变到浅蓝白，配扁平白云；主体是简洁矢量线条的简笔火柴人（黑色玩家、红色敌人带白色眼睛），圆头、火柴身躯、圆头线帽。子弹为黄色发光小圆，武器升级道具为紫色圆形配白色向上箭头。危险元素用红色虚线与淡红色警示区。色彩高饱和、明亮，无复杂纹理，细节密度低，轮廓清晰，正俯视纵向卷轴构图。
```

| 素材 | 领域·媒体·角色 | 游戏作用 | 交付说明 | 游戏内规格 | Reference 与职责 | 路径/状态 |
|---|---|---|---|---|---|---|
| （本版无正式 Runtime 媒体行） | — | — | — | — | — | — |

## Runtime-owned visuals

- 天空背景：`CanvasTexture` 垂直渐变（`src/game/textures.ts`，`tex-sky`），全屏拉伸
- 云层：`Phaser.Graphics` 白色圆组（`CloudField`），缓慢下移循环，营造云端高度感
- 云端跑道：半透明白色圆角长条 + 两侧边界线（`drawRunway`）+ 循环下移虚线（速度感）
- 玩家火柴人：`CanvasTexture`（`tex-stickman-player`，黑色，双臂上举举枪姿势），240×340 纹理，显示 `240x340` 游戏单位
- 敌人火柴人：`CanvasTexture`（`tex-stickman-enemy`，红色带白眼），240×340 纹理，显示 `240x340` 游戏单位
- 子弹：`CanvasTexture`（`tex-bullet`，黄色发光圆），显示 `24x24` 游戏单位
- 武器升级道具：`CanvasTexture`（`tex-powerup`，紫色圆 + 白色双箭头），显示 `160x160` 游戏单位，带脉动动画
- 危险线：红色虚线横线 + 底部淡红色警示区（`drawDangerLine`）
- HUD 与文字：分数、波次、波次公告、飘字反馈、按钮（`Phaser.Text` + `Graphics` 圆角）
- 击杀反馈：白色扩散圆环（`Arc` tween）+ 上浮加分文字
