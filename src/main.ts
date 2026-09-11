import createGame from './game-flow/createGame';
import { APP_VERSION } from './version';
import './style.css';

// 标题带版本号：真机排查时一眼确认加载的是哪个构建
document.title = `云端火柴人射击 v${APP_VERSION}`;

// 注册游戏到 PhaserBridge，可以在扣子网页游戏开发中编辑评论
if (window.PhaserBridge) {
  window.PhaserBridge.bind({
    launchGame(launchPlan) {
      return createGame(launchPlan);
    },
  });
} else {
  // 未提供 Bridge 的运行环境中，游戏仍可正常启动。
  createGame();
}
