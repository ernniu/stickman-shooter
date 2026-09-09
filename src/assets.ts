export const IMAGES: Record<string, string> = {};

/**
 * 可选素材（试验版）：文件存在则优先使用图片，不存在自动回退到程序化纹理。
 * 目录约定：src/assets/image/<文件名>.png
 * dev 下由 vite 的 /assets 中间件提供，构建时整体复制到 dist/assets。
 */
export const OPTIONAL_IMAGES: Record<string, string> = {
  player_sprite: 'assets/image/player_sprite.png',
  enemy_normal_sprite: 'assets/image/enemy_normal_sprite.png',
  bullet_sprite: 'assets/image/bullet_sprite.png',
  powerup_weapon_sprite: 'assets/image/powerup_weapon_sprite.png',
};

export const IMAGE_SEQUENCES: Record<string, string> = {
  'coze-game-loading': 'assets/image_sequence/coze-game-loading',
};

export const VIDEOS: Record<string, string> = {};

export const AUDIOS: Record<string, string> = {};

// 注册素材到 PhaserBridge，可以在扣子网页游戏开发中定位
window.PhaserBridge?.markImageAssetMap?.(IMAGES);
window.PhaserBridge?.markImageSequenceAssetMap?.(IMAGE_SEQUENCES);
window.PhaserBridge?.markVideoAssetMap?.(VIDEOS);
window.PhaserBridge?.markAudioAssetMap?.(AUDIOS);
