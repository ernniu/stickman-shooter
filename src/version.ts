declare const __GIT_VERSION__: string;

/**
 * 构建时注入的 git 短版本号（例如 33a519d）。
 * 由 vite.config.ts 的 define 注入；无法获取时显示 dev。
 */
export const GIT_VERSION: string =
  typeof __GIT_VERSION__ === 'string' ? __GIT_VERSION__ : 'dev';
