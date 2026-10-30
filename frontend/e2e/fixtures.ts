import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { test as base, expect } from "@playwright/test";

// What every browser test builds on:
// - each test file gets its own server on freshly seeded demo data in a temp folder, so files
//   can't disturb each other and nothing can reach a real data folder;
// - each test gets a fresh browser context (nothing left in localStorage);
// - a console error, an uncaught exception or a failed request fails the test, unless the test
//   said it expects it with problems.allow(/…/).

const REPO = resolve(import.meta.dirname, "../..");

const freePort = () =>
  new Promise<number>((done, fail) => {
    const probe = createServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => done(typeof address === "object" && address ? address.port : 0));
    });
  });

class DemoServer {
  private process: ChildProcess | undefined;
  private folder = "";
  url = "";

  async start() {
    this.folder = mkdtempSync(join(tmpdir(), "jat-e2e-"));
    const dataDir = join(this.folder, "demo");
    // --data-dir wins anyway; this leaves a real folder's path out of the server's environment.
    const env = { ...process.env };
    delete env.JAT_DATA_DIR;
    const seeded = spawnSync("uv", ["run", "python", "scripts/seed_demo.py", dataDir], {
      cwd: REPO,
      env,
      encoding: "utf8",
    });
    if (seeded.status !== 0) throw new Error(`Seeding failed:\n${seeded.stderr}`);
    const port = await freePort();
    this.url = `http://127.0.0.1:${port}`;
    this.process = spawn("uv", ["run", "jat", "--data-dir", dataDir, "serve", "--port", String(port)], {
      cwd: REPO,
      env,
      stdio: "ignore",
      detached: true, // its own process group, so stop() also ends what uv started
    });
    await this.waitUntilUp();
  }

  private async waitUntilUp() {
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(`${this.url}/api/v1/health`)).ok) return;
      } catch {
        // not listening yet
      }
      await new Promise((done) => setTimeout(done, 200));
    }
    throw new Error(`The app didn't start at ${this.url}`);
  }

  stop() {
    if (this.process?.pid) {
      try {
        process.kill(-this.process.pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
    this.process = undefined;
    if (this.folder) rmSync(this.folder, { recursive: true, force: true });
    this.folder = "";
  }
}

export interface Problems {
  /** Expect these in this test (a refused request the test provokes, say). */
  allow(pattern: RegExp): void;
  /** What's gone wrong so far in the browser. */
  list(): string[];
}

/** One server at a time in a worker, replaced when the worker moves on to another file. */
const workerFixtures = base.extend<
  { problems: Problems },
  { server: { forFile(file: string): Promise<DemoServer> } }
>({
  server: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const demo = new DemoServer();
      let current = "";
      await use({
        async forFile(file) {
          if (file !== current) {
            demo.stop();
            await demo.start();
            current = file;
          }
          return demo;
        },
      });
      demo.stop();
    },
    { scope: "worker", timeout: 60_000 },
  ],

  baseURL: async ({ server }, use, testInfo) => {
    await use((await server.forFile(testInfo.file)).url);
  },

  problems: [
    async ({ page }, use) => {
      const seen: string[] = [];
      const allowed: RegExp[] = [];
      page.on("console", (message) => {
        // With where it came from: a failed request's message doesn't name its address.
        if (message.type() === "error")
          seen.push(`console error: ${message.text()} (${message.location().url})`);
      });
      page.on("pageerror", (error) => seen.push(`uncaught: ${error.message}`));
      page.on("response", (response) => {
        if (response.status() >= 400)
          seen.push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
      });
      page.on("requestfailed", (request) => {
        // A navigation away cancels what's still loading; that's not a failure.
        if (request.failure()?.errorText !== "net::ERR_ABORTED")
          seen.push(`request failed: ${request.method()} ${request.url()}`);
      });
      await use({
        allow: (pattern) => allowed.push(pattern),
        list: () => seen.filter((line) => !allowed.some((pattern) => pattern.test(line))),
      });
      expect(
        seen.filter((line) => !allowed.some((pattern) => pattern.test(line))),
        "nothing should go wrong in the browser",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export const test = workerFixtures;
export { expect };
