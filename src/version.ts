declare const __APP_VERSION__: string;

/**
 * 应用版本号：来自 package.json 的 version 字段，由 vite define 注入。
 * 发版时更新 package.json 的 version 即可，例如 1.2.0。
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
