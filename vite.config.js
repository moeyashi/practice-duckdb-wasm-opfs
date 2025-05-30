// 日本語コメント: React用のバンドル設定（Vite）
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "./",
  base: "/practice-duckdb-wasm-opfs/", // 日本語コメント: GitHub Pages用のbaseパスを設定
  build: {
    outDir: "dist",
  },
});
