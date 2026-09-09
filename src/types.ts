export type AssetSources = Readonly<Record<string, string>>;

export interface AssetCollections {
  images?: AssetSources;
  imageSequences?: AssetSources;
  videos?: AssetSources;
  audios?: AssetSources;
}

export interface ImageSequenceManifest {
  schema_version: string;
  id: string;
  type: 'image_sequence';
  name: string;
  properties: {
    fps: number;
    frame_count: number;
  };
  sources: readonly string[];
}

export type LoadedAsset =
  | {
      kind: 'image' | 'video' | 'audio';
      key: string;
    }
  | {
      kind: 'image-sequence';
      key: string;
      texture: string;
      animation: string;
    };
