# 云端火柴人射击

这是一个基于 Phaser、Vite 和 TypeScript 的 2D 游戏项目。

## 快速开始

本地与云端使用相同的项目脚本，不需要判断执行环境或选择运行模式。依赖、Vite cache、日志和构建产物统一保存在
`/tmp/coze-phaser-runtime` 的托管运行目录中；源码、素材、配置和锁文件仍以项目目录为事实源：

```bash
bash ./scripts/dev.sh
```

项目脚本会在 stdout 输出实际端口，但不修改 `.coze`；Agent 按当前 Skill 使用文件工具同步新分配的端口。

通过 Bash 工具在后台启动开发服务时，直接把 `run_in_background` 设为 `true`：

```json
{
  "command": "bash ./scripts/dev.sh",
  "run_in_background": true
}
```

`run_in_background` 是 Bash 工具参数，不要在命令中追加 `&`、`nohup` 或 `disown`。

校验和 production build 使用相同的托管运行目录：

```bash
bash ./scripts/validate.sh
bash ./scripts/build.sh
```

Agent 为页面服务就绪、最终交付或后续 Done 启动并保留服务时仍执行 `bash ./scripts/dev.sh`。`start.sh` 只用于
用户明确要求的生产预览，或由平台按 `.coze [deploy].run` 启动已有 production build；不要用它替代交付阶段的 dev 服务。

不要直接执行项目级 `pnpm`、`npm`、`npx`、`yarn` 或 `bun` 命令。修改依赖时编辑项目根
`package.json`，再执行 `bash ./scripts/prepare.sh`；项目脚本会在托管运行目录安装依赖并同步锁文件。
直接执行 package script 时，guard 会提示对应的项目脚本；依赖安装入口始终是 `bash ./scripts/prepare.sh`。

## 文件结构

```text
├── assets/                     # 图片、序列帧、视频和音频
├── src/assets.ts               # 素材 key 与路径
├── src/main.ts                 # 游戏入口
├── src/rendering.ts            # 自适应高清画幅、统一游戏单位与文字工厂
├── src/layout.ts               # Image/Sprite contain、cover 与原生尺寸例外
├── src/scene/BootScene.ts      # 启动与全量加载
├── src/utils/asset-loader.ts   # 批量和单素材加载
├── src/types.ts                # 类型定义
├── scripts/phaser-runtime.sh   # 托管执行目录管理
└── vite.config.ts              # Bridge 注入与素材目录映射
```

- 素材按类型放在 `assets/`，并登记到 `src/assets.ts` 对应的分类表。
- 序列帧只登记文件夹；Loader 从 `manifest.json` 读取帧数和帧率。
- `BootScene` 加载游戏素材；运行时可用 `loadAsset(this, key)` 单独加载。
- 开发和生产都使用稳定的 `assets/...` 路径，生产构建原样复制素材目录。

Gameplay、UI 和背景的 `Image` / `Sprite` 在创建表达式中立即确定显示尺寸：直接调用
`.setDisplaySize(...)`，或使用 `containImage(...)` / `coverImage(...)`。角色和实体尺寸从格子、槽位等玩法几何推导，UI
图标从按钮或卡牌容器推导，背景从游戏画幅推导。确实以纹理原生尺寸表达玩法意图时，使用
`useNativeImageSize(object, '具体原因')` 显式声明例外；它把原生尺寸视为桌面设计基准，在移动档位仍应用 `GAME_SCALE`。`.setDisplaySize(...)` 与 contain/cover bounds
必须来自运行时画幅、格子或容器；桌面设计字面量先经 `gameUnits(...)` 换算。`bash ./scripts/validate.sh` 会检查是否显式定尺，但不会读取或限制源图像素。

`IMAGES`、`IMAGE_SEQUENCES`、`VIDEOS` 和 `AUDIOS` 是四个素材分类表。

## 自适应高清渲染

模板默认关闭像素画模式，并在 Phaser 启动前选择一次渲染档位：桌面竖屏为 `2160×3840`，移动端与平板竖屏为 `1080×1920`。
横屏游戏在实现前对调 `src/rendering.ts` 的 `GAME_DESIGN_WIDTH` / `GAME_DESIGN_HEIGHT`。
本地 QA 可在 URL 使用 `?renderProfile=mobile` 或 `?renderProfile=desktop` 固定档位；普通玩家入口不带该参数，使用自动判定。

- `src/rendering.ts`：唯一拥有设计基准、设备档位、运行时 `GAME_WIDTH` / `GAME_HEIGHT`、`gameUnits(...)` 和 `gamePixels(...)`。
- `src/main.ts`：`Phaser.Game` 的 `width` / `height` 直接引用运行时 `GAME_WIDTH` / `GAME_HEIGHT`，保持 `pixelArt: false`。
- `src/style.css`：保持 `#game canvas { image-rendering: auto; }`，由 `Phaser.Scale.FIT` 缩放到页面。
- `src/scene/*.ts`：Camera 保持默认 zoom 1。Canvas、Scene、Camera、Pointer、碰撞和玩法几何全部消费启动时选定的同一套运行时坐标，
  不增加 Camera zoom 补偿或 Pointer 倍率换算。

相对布局直接从 `GAME_WIDTH` / `GAME_HEIGHT`、格子、容器或角色槽推导。以 `2160×3840` 设计基准编写的字面间距、尺寸、速度、碰撞半径、
描边以及 Shape / Zone 本地几何必须通过 `gameUnits(...)` 换算，字号通过 `gamePixels(...)` 换算。默认 GameObject 命中区域会跟随对象变换，优先直接使用。自定义
hit area 始终在 input owner 的本地、变换前坐标中定义：未额外缩放的 Shape / Zone 可复用其运行时宽高；Image / Sprite 经 `setDisplaySize` 或 contain/cover 缩放后使用
texture/frame 本地尺寸，不对 `displayWidth` / `displayHeight` 重复应用 `gameUnits(...)`。resize 和屏幕旋转只调整 CSS FIT，不在已运行的游戏中切换坐标档位；
如需重新判定设备档位，整页重新加载。

只有游戏明确采用像素画美术时，才调整 `pixelArt` 和 Canvas `image-rendering`。像素画项目应改用自身较低的原生逻辑基准与整数显示缩放，不照搬普通 2D 的
`2160→1080` 换算，也不用 `0.5` 缩放原生像素素材。

## 流程导航接入 scaffold

模板只提供通用 Bridge、类型和加载页 editable hook，不包含当前游戏的 FlowGraph。游戏工程稳定后，由流程导航
接入阶段根据真实业务流程生成 `debug-runtime/` 合同并校验这些 hook；模板初始状态不表示流程导航接入已经完成。

## 可视化编辑标识

用 `markEditable` 标记可在编辑器中调整的对象；第三个参数可选，仅用于编辑器展示名称：

```ts
markEditable('ui.start-button', button, { label: '开始按钮' });
```
