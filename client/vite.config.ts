import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd())

  /** 是否为 Electron 桌面端构建 */
  const isElectron = mode === "electron"

  return {
    base: isElectron ? "./" : "/client/",
    plugins: [vue()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
      extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
    },
    server: {
      port: parseInt(env.VITE_PORT || '5173'),
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
        },
        "/socket.io": {
          target: env.VITE_API_BASE_URL,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: isElectron ? "../desktop/dist/client" : "../service/public/client",
      emptyOutDir: true,
    },
  };
});
