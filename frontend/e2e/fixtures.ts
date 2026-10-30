import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
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
const START_ATTEMPTS = 3;

const freePort = () =>
  new Promise<number>((done, fail) => {
    const probe = createServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => done(typeof address === "object" && address ? address.port : 0));
    });
  });

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** The environment for what we start: nothing that could point it at real data or a real repo. */
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("JAT_") || key.startsWith("GIT_")) delete env[key];
  }
  return env;
}

class DemoServer {
  private process: ChildProcess | undefined;
  private folder = "";
  private stderr = "";
  private stopped = false;
  url = "";

  async start() {
    this.stopped = false;
    this.folder = mkdtempSync(join(tmpdir(), "jat-e2e-"));
    const dataDir = join(this.folder, "demo");
    const seeded = spawnSync("uv", ["run", "python", "scripts/seed_demo.py", dataDir], {
      cwd: REPO,
      env: cleanEnv(),
      encoding: "utf8",
      timeout: 60_000,
    });
    if (seeded.status !== 0) throw new Error(`Seeding failed: ${seeded.error ?? seeded.stderr}`);
    const expected = realpathSync(dataDir);
    // Another process can take the port between choosing it and the server binding it.
    for (let attempt = 1; ; attempt++) {
      try {
        await this.launch(dataDir, expected);
        return;
      } catch (error) {
        await this.end();
        if (attempt === START_ATTEMPTS || this.stopped) throw error;
      }
    }
  }

  private async launch(dataDir: string, expected: string) {
    const port = await freePort();
    if (this.stopped) throw new Error("Stopped while starting");
    this.url = `http://127.0.0.1:${port}`;
    this.stderr = "";
    const args = [
      "run",
      "jat",
      "--data-dir",
      dataDir,
      "serve",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ];
    const child = spawn("uv", args, {
      cwd: REPO,
      env: cleanEnv(),
      stdio: ["ignore", "ignore", "pipe"],
      detached: true, // its own process group, so end() also ends what uv started
    });
    this.process = child;
    child.stderr?.on("data", (chunk) => (this.stderr += String(chunk)));
    child.on("error", (error) => (this.stderr += String(error)));
    await this.waitUntilUp(child, expected);
  }

  /** Only our own server will do: whatever else answers on the port must never get a test. */
  private async waitUntilUp(child: ChildProcess, expected: string) {
    for (let i = 0; i < 300; i++) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error(`The app exited while starting:\n${this.stderr}`);
      let health: { data_dir?: string; git_repo?: boolean } | undefined;
      try {
        const response = await fetch(`${this.url}/api/v1/health`);
        if (response.ok) health = (await response.json()) as typeof health;
      } catch {
        // not listening yet
      }
      if (health) {
        if (health.data_dir !== expected || health.git_repo !== false)
          throw new Error(`${this.url} isn't our demo server: ${JSON.stringify(health)}`);
        return;
      }
      await sleep(100);
    }
    throw new Error(`The app didn't start at ${this.url}:\n${this.stderr}`);
  }

  private async end() {
    const child = this.process;
    this.process = undefined;
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise((done) => child.once("exit", done));
    signal(child.pid, "SIGTERM");
    if ((await Promise.race([exited, sleep(5_000).then(() => "late")])) === "late") {
      signal(child.pid, "SIGKILL");
      await exited;
    }
  }

  async stop() {
    this.stopped = true;
    await this.end();
    if (this.folder) rmSync(this.folder, { recursive: true, force: true, maxRetries: 3 });
    this.folder = "";
  }

  /** When the worker is ending and nothing can be awaited. */
  stopNow() {
    if (this.process?.pid && this.process.exitCode === null) signal(this.process.pid, "SIGKILL");
    if (this.folder) rmSync(this.folder, { recursive: true, force: true });
  }
}

function signal(pid: number, name: NodeJS.Signals) {
  try {
    process.kill(-pid, name);
  } catch {
    // already gone
  }
}

export interface Problems {
  /** Expect these in this test (a refused request the test provokes, say). */
  allow(pattern: RegExp): void;
  /** What's gone wrong so far in the browser, allowed or not. */
  list(): string[];
}

/** One server at a time in a worker, replaced when the worker moves on to another file. */
export const test = base.extend<
  { problems: Problems },
  { server: { forFile(file: string): Promise<DemoServer> } }
>({
  server: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const demo = new DemoServer();
      const onExit = () => demo.stopNow();
      process.once("exit", onExit);
      let current = "";
      await use({
        async forFile(file) {
          if (file !== current) {
            await demo.stop();
            await demo.start();
            current = file;
          }
          return demo;
        },
      });
      await demo.stop();
      process.off("exit", onExit);
    },
    { scope: "worker" },
  ],

  // Seeding and starting happen here, on a file's first test: more than a test's own time.
  baseURL: [
    async ({ server }, use, testInfo) => {
      await use((await server.forFile(testInfo.file)).url);
    },
    { scope: "test", timeout: 90_000 },
  ],

  problems: [
    async ({ context }, use) => {
      const seen: string[] = [];
      const allowed: RegExp[] = [];
      let inFlight = 0;
      // The whole context, so a popup or a second page is watched too.
      context.on("console", (message) => {
        // With where it came from: a failed request's message doesn't name its address.
        if (message.type() === "error")
          seen.push(`console error: ${message.text()} (${message.location().url})`);
      });
      context.on("weberror", (error) => seen.push(`uncaught: ${error.error().message}`));
      context.on("response", (response) => {
        if (response.status() >= 400)
          seen.push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
      });
      context.on("request", () => inFlight++);
      context.on("requestfinished", () => inFlight--);
      context.on("requestfailed", (request) => {
        inFlight--;
        // A navigation away cancels what's still loading; that's not a failure.
        if (request.failure()?.errorText !== "net::ERR_ABORTED")
          seen.push(`request failed: ${request.method()} ${request.url()}`);
      });
      await use({ allow: (pattern) => allowed.push(pattern), list: () => [...seen] });
      // Work still under way when the test ended can fail too. Give it a moment, without
      // making a slow request a failure of its own.
      for (let i = 0; i < 30 && inFlight > 0; i++) await sleep(100);
      await sleep(100);
      expect(
        seen.filter((line) => !allowed.some((pattern) => pattern.test(line))),
        "nothing should go wrong in the browser",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
