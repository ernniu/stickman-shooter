import type Phaser from 'phaser';

declare global {
  interface LaunchSpec {
    protocol_version: 1;
    target: {
      graph_id: string;
      node_id: string;
    };
    input: Record<string, any>;
  }

  interface PhaserBridgeBinding {
    launchGame: (launchSpec: LaunchSpec | undefined) => Phaser.Game;
  }

  interface PhaserBridgeApi {
    bind: (binding: PhaserBridgeBinding) => Phaser.Game;
    markEditable?: <T extends Phaser.GameObjects.GameObject>(
      stableId: string,
      gameObject: T,
      options?: {
        label?: string;
        assetTarget?: Phaser.GameObjects.GameObject;
      },
    ) => T;
    markImageAssetMap?: (images: Record<string, string>) => void;
    markImageSequenceAssetMap?: (
      imageSequences: Record<string, string>,
    ) => void;
    markVideoAssetMap?: (videos: Record<string, string>) => void;
    markAudioAssetMap?: (audios: Record<string, string>) => void;
  }

  interface Window {
    PhaserBridge?: PhaserBridgeApi;
  }
}

export {};
