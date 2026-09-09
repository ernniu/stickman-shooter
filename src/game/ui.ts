import Phaser from 'phaser';

import { gamePixels, gameUnits } from '@/rendering';
import { markEditable } from '@/utils';

export const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", sans-serif';

export interface GameButtonOptions {
  width: number;
  height: number;
  fillColor: number;
  pressedFillColor?: number;
  fontSize: number;
  label: string;
  onPress: () => void;
  editableLocator?: string;
  editableLabel?: string;
}

/**
 * 程序化圆角按钮：由可见的 Graphics 承担输入（本地命中区与绘制区一致），
 * pointerup 触发业务动作，按下时给出颜色与位移反馈。
 */
export const createGameButton = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: GameButtonOptions,
): Phaser.GameObjects.Graphics => {
  const {
    width,
    height,
    fillColor,
    pressedFillColor = fillColor,
    fontSize,
    label,
    onPress,
  } = options;

  const button = scene.add.graphics().setDepth(10);
  const text = scene.add
    .text(x, y, label, {
      fontFamily: FONT_FAMILY,
      fontSize: gamePixels(fontSize),
      color: '#ffffff',
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setDepth(11);

  const redraw = (pressed: boolean): void => {
    const offsetY = pressed ? gameUnits(8) : 0;
    button.clear();
    button.fillStyle(pressed ? pressedFillColor : fillColor, 1);
    button.fillRoundedRect(
      x - width / 2,
      y - height / 2 + offsetY,
      width,
      height,
      height / 2,
    );
    text.y = y + offsetY;
  };

  redraw(false);

  // Graphics 停留在 (0,0)，绘制命令使用画布绝对坐标，
  // 因此本地命中区与绘制区使用同一矩形。
  button.setInteractive(
    new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height),
    Phaser.Geom.Rectangle.Contains,
  );

  button.on('pointerdown', () => redraw(true));
  button.on('pointerout', () => redraw(false));
  button.on('pointerupoutside', () => redraw(false));
  button.on('pointerup', () => {
    redraw(false);
    onPress();
  });

  if (options.editableLocator) {
    markEditable(options.editableLocator, button, {
      label: options.editableLabel ?? label,
    });
  }

  return button;
};

/** floatText 可选项：pop 为 true 时文字先从小到大弹出一次（强提示用）。 */
export interface FloatTextOptions {
  pop?: boolean;
}

/** 击杀 / 拾取等关键事件的漂浮反馈文字，播放完自动销毁。 */
export const floatText = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  color: string,
  options: FloatTextOptions = {},
): void => {
  const label = scene.add
    .text(x, y, message, {
      fontFamily: FONT_FAMILY,
      fontSize: gamePixels(64),
      color,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setDepth(15)
    .setStroke('#0f172a', gameUnits(6));
  if (options.pop) {
    label.setScale(0.4);
    scene.tweens.add({
      targets: label,
      scale: 1,
      duration: 220,
      ease: 'Back.out',
    });
  }
  scene.tweens.add({
    targets: label,
    y: y - gameUnits(140),
    alpha: 0,
    duration: 900,
    ease: 'Cubic.out',
    onComplete: () => label.destroy(),
  });
};
