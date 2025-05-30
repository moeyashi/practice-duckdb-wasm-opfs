import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "./",
  // GitHub Pages用のbaseパスを設定
  base: "/practice-duckdb-wasm-opfs/",
  build: {
    outDir: "dist",
  },
});
