import { readFileSync } from "node:fs";
import { realpathSync } from "node:fs";
import { cp } from "node:fs/promises";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import serveStatic from "serve-static";

const PHASER_BRIDGE_URL = new URL(
  "https://lf-coze-web-cdn.coze.cn/obj/eden-cn/lm-lgvj/ljhwZthlaukjlkulzlp/coze-game/js/phaser-bridge.min.js",
);

// 每次加载配置时换一个 URL，以绕过浏览器已有的 Bridge 本地缓存。
PHASER_BRIDGE_URL.searchParams.set("hash", Date.now().toString());

const executionRoot = import.meta.dirname;

// 应用版本号：读取 package.json 的 version（发版时更新该字段即可）
const APP_VERSION =
  (JSON.parse(
    readFileSync(path.join(executionRoot, "package.json"), "utf-8"),
  ) as { version?: string }).version ?? "0.0.0";
const sourceRoot = path.dirname(
  realpathSync(path.join(executionRoot, "src")),
);

function injectPhaserBridge(): Plugin {
  return {
    name: "phaser-bridge",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { src: PHASER_BRIDGE_URL.href, async: true },
          injectTo: "head",
        },
      ];
    },
  };
}

function mountDevAssets(directory: string): Plugin {
  const serveAssets = serveStatic(directory, {
    cacheControl: false,
    dotfiles: "allow",
    fallthrough: false,
    index: false,
    redirect: false,
    setHeaders(response) {
      response.setHeader("Cache-Control", "no-cache");
    },
  });

  return {
    name: "phaser-dev-assets",
    configureServer(server) {
      server.middlewares.use("/assets", (request, response, next) => {
        const isRead = request.method === "GET" || request.method === "HEAD";
        if (!isRead || request.url?.includes("?")) {
          response.statusCode = 404;
          response.end("Not Found\n");
          return;
        }
        serveAssets(request, response, next);
      });
    },
  };
}

function copyGameAssets(directory: string): Plugin {
  return {
    name: "phaser-build-assets",
    async writeBundle(outputOptions) {
      const outputDirectory = path.resolve(
        executionRoot,
        outputOptions.dir ?? "dist",
      );

      await cp(directory, path.join(outputDirectory, "assets"), {
        recursive: true,
        force: true,
        filter(source) {
          return path.basename(source) !== ".DS_Store";
        },
      });
    },
  };
}

export default defineConfig(() => {
  const isDev = process.env.COZE_PHASER_GAME_ENV === "DEV";
  const assetsDirectory = path.join(sourceRoot, "assets");

  return {
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    cacheDir: path.join(executionRoot, "node_modules/.vite"),
    envDir: sourceRoot,
    publicDir: path.join(sourceRoot, "public"),
    resolve: {
      preserveSymlinks: true,
      alias: {
        "@": path.resolve(executionRoot, "src"),
      },
    },
    server: {
      // 游戏需用户手动刷新，防止游玩过程中丢失游戏状态
      hmr: false,
      fs: {
        allow: [executionRoot, sourceRoot],
      },
    },
    build: {
      outDir: path.join(executionRoot, "dist"),
    },
    plugins: [
      copyGameAssets(assetsDirectory),
      injectPhaserBridge(),
      ...(isDev ? [mountDevAssets(assetsDirectory)] : []),
    ],
  };
});
