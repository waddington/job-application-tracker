/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development Vite serves the UI on :5173 and proxies the API to FastAPI (jat serve --dev).
// In production FastAPI serves the built files from dist/ on a single port.
const apiTarget = process.env.JAT_API_URL ?? "http://127.0.0.1:8770";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": apiTarget },
  },
  build: { outDir: "dist", sourcemap: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
