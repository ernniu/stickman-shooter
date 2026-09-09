import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '../rendering';
import { BootScene } from '../scene/BootScene';
import { DevLoadingScene } from '../scene/DevLoadingScene';
import { GameOverScene } from '../scene/GameOverScene';
import { GameScene } from '../scene/GameScene';
import { MenuScene } from '../scene/MenuScene';

interface LaunchTarget {
  scene: string;
  data?: Record<string, unknown>;
}

const resolveGameOverInput = (input: Record<string, any>): Record<string, unknown> => {
  const score =
    typeof input?.score === 'number' && Number.isFinite(input.score)
      ? Math.max(0, Math.floor(input.score))
      : 0;
  const wave =
    typeof input?.wave === 'number' && Number.isFinite(input.wave)
      ? Math.max(1, Math.floor(input.wave))
      : 1;
  return { score, wave };
};

// 流程导航接入薄层：把 LaunchSpec 显式映射为工程已声明的真实入口，不发明新流程。
const resolveLaunchTarget = (launchPlan?: LaunchSpec): LaunchTarget => {
  if (!launchPlan) {
    return { scene: 'menu' };
  }
  const { graph_id, node_id } = launchPlan.target;
  if (graph_id !== 'main') {
    throw new Error(`未知的流程图: ${graph_id}`);
  }
  if (node_id === 'menu') {
    return { scene: 'menu' };
  }
  if (node_id === 'game') {
    return { scene: 'game' };
  }
  if (node_id === 'game-over') {
    return { scene: 'game-over', data: resolveGameOverInput(launchPlan.input) };
  }
  throw new Error(`未知的流程节点: ${node_id}`);
};

const createGame = (launchPlan?: LaunchSpec): Phaser.Game => {
  const target = resolveLaunchTarget(launchPlan);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    pixelArt: false,
    parent: 'game',
    // 运行时单坐标系：Canvas、Scene、Camera、Pointer 与碰撞完全一致。
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#dff1ff',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, DevLoadingScene, MenuScene, GameScene, GameOverScene],
  });
  game.registry.set('launchTarget', target);
  return game;
};

export default createGame;
