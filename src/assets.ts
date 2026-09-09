export const IMAGES: Record<string, string> = {};

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
