/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { testWorkers } from "./testWorkers";

// In development Vite serves the UI on :5173 and proxies the API to FastAPI (jat serve --dev).
// In production FastAPI serves the built files from dist/ on a single port.
const apiTarget = process.env.JAT_API_URL ?? "http://127.0.0.1:8770";

// The API docs page (/api/docs) loads Swagger UI from /api-docs/ rather than a CDN, so nothing is
// fetched from the web: copied into dist/ by the build, and served straight from node_modules in dev
// (ahead of the /api proxy, whose prefix would otherwise send /api-docs to FastAPI).
const SWAGGER_FILES: Record<string, string> = {
  "swagger-ui-bundle.js": "text/javascript",
  "swagger-ui.css": "text/css",
};

function swaggerUi(): Plugin {
  const root = dirname(createRequire(import.meta.url).resolve("swagger-ui-dist/package.json"));
  return {
    name: "swagger-ui",
    configureServer(server) {
      server.middlewares.use("/api-docs", (req, res, next) => {
        const file = (req.url ?? "").replace(/^\//, "").replace(/\?.*$/, "");
        const type = SWAGGER_FILES[file];
        if (!type) return next();
        res.setHeader("Content-Type", type);
        res.end(readFileSync(join(root, file)));
      });
    },
    generateBundle() {
      for (const file of Object.keys(SWAGGER_FILES)) {
        this.emitFile({
          type: "asset",
          fileName: `api-docs/${file}`,
          source: readFileSync(join(root, file)),
        });
      }
    },
  };
}

// The version this page was built from, shown in the footer next to the running server's.
const pageVersion = (
  JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }
).version;

export default defineConfig({
  plugins: [react(), swaggerUi()],
  define: { __APP_VERSION__: JSON.stringify(pageVersion) },
  server: {
    host: "127.0.0.1",
    port: 5173,
    // The page's own host goes through (not the API's), so the API's same-origin check on writes passes on any
    // dev port, not only 5173 (Vite's shorthand would rewrite Host to the target's).
    proxy: { "/api": { target: apiTarget, changeOrigin: false } },
  },
  build: { outDir: "dist", sourcemap: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "testWorkers.test.ts"], // e2e/ is Playwright's
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    maxWorkers: testWorkers(), // half the cores, or TEST_WORKERS
  },
});
