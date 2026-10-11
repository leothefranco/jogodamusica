import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { createProcessRunner } from "./gate-process.mjs";
import { runGate } from "./gate.mjs";

const execute = promisify(execFile);
const cwd = process.cwd();
const outputDir = join(cwd, "tmp", "gate", `${Date.now()}-${randomUUID()}`);
const port = 3182;
let npmCli;
let baseline;

function block(code) {
  throw Object.assign(new Error(code), { code });
}
const digest = (text) => createHash("sha256").update(text).digest("hex");

async function git(args, env) {
  const result = await execute(
    "git",
    ["-c", `safe.directory=${cwd}`, ...args],
    { cwd, env, windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  return result.stdout.trim();
}

async function snapshot(env) {
  const [commit, tree, status, manifest, lock] = await Promise.all([
    git(["rev-parse", "HEAD"], env),
    git(["rev-parse", "HEAD^{tree}"], env),
    git(["status", "--porcelain", "--untracked-files=normal"], env),
    readFile(join(cwd, "package.json")),
    readFile(join(cwd, "package-lock.json")),
  ]);
  return {
    commit,
    tree,
    status,
    manifestHash: digest(manifest),
    lockHash: digest(lock),
  };
}

async function requireFreePort() {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        Object.assign(new Error("port-unavailable"), {
          code: "port-unavailable",
        }),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}

async function main() {
  let safeEnvironment;
  let expectedNext;
  const evidence = await runGate({
    cwd,
    outputDir,
    port,
    preflight: async ({ env }) => {
      safeEnvironment = env;
      const manifest = JSON.parse(
        await readFile(join(cwd, "package.json"), "utf8"),
      );
      const declaredNode = (await readFile(join(cwd, ".nvmrc"), "utf8")).trim();
      if (
        !/^\d+\.\d+\.\d+$/.test(declaredNode) ||
        !/^npm@\d+\.\d+\.\d+$/.test(manifest.packageManager ?? "")
      )
        block("manifest-invalid");
      if (
        process.versions.node !== declaredNode ||
        manifest.engines?.node !== `${declaredNode.split(".")[0]}.x`
      )
        block("runtime-mismatch");
      const files = await readdir(cwd);
      if (
        files.some(
          (file) =>
            (file.startsWith(".env") && file !== ".env.example") ||
            file.toLowerCase() === ".npmrc",
        )
      )
        block("credential-source");
      npmCli =
        process.env.npm_execpath ??
        join(
          dirname(process.execPath),
          "node_modules",
          "npm",
          "bin",
          "npm-cli.js",
        );
      if (!/[\\/]npm[\\/]bin[\\/]npm-cli\.js$/.test(npmCli))
        block("manifest-invalid");
      const npm = (
        await execute(process.execPath, [npmCli, "--version"], {
          cwd,
          env,
          windowsHide: true,
        })
      ).stdout.trim();
      if (npm !== manifest.packageManager.slice(4)) block("runtime-mismatch");
      const lock = JSON.parse(
        await readFile(join(cwd, "package-lock.json"), "utf8"),
      );
      for (const entry of Object.values(lock.packages ?? {})) {
        if (!entry.resolved) continue;
        const url = new URL(entry.resolved);
        if (
          url.origin !== "https://registry.npmjs.org" ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          block("credential-source");
      }
      expectedNext = manifest.dependencies?.next;
      if (
        !/^\d+\.\d+\.\d+$/.test(expectedNext ?? "") ||
        lock.lockfileVersion !== 3 ||
        lock.packages?.[""]?.dependencies?.next !== expectedNext ||
        lock.packages?.["node_modules/next"]?.version !== expectedNext
      )
        block("manifest-invalid");
      baseline = await snapshot(env);
      if (baseline.status) block("checkout-dirty");
      await requireFreePort();
      return {
        ...baseline,
        node: process.versions.node,
        npm,
        next: expectedNext,
      };
    },
    runner: async (request) => {
      const executeStage = createProcessRunner({ npmCli });
      if (request.stage === "e2e") {
        await requireFreePort();
        const browser = await executeStage({
          ...request,
          args: [
            "exec",
            "--no",
            "--",
            "playwright",
            "install",
            ...(process.platform === "linux" ? ["--with-deps"] : []),
            "chromium",
          ],
        });
        if (browser.exitCode !== 0 || browser.failure) return browser;
        const tests = await executeStage(request);
        return { ...tests, output: browser.output + tests.output };
      }
      const result = await executeStage(request);
      if (request.stage === "install" && result.exitCode === 0) {
        let validation = { result: "passed", reason: "immutable-installation" };
        try {
          const installed = JSON.parse(
            await readFile(
              join(cwd, "node_modules", "next", "package.json"),
              "utf8",
            ),
          );
          if (installed.version !== expectedNext)
            validation = {
              result: "failed",
              reason: "installed-next-mismatch",
            };
          else if (
            JSON.stringify(await snapshot(safeEnvironment)) !==
            JSON.stringify(baseline)
          )
            validation = { result: "failed", reason: "checkout-changed" };
        } catch {
          validation = {
            result: "failed",
            reason: "installation-validation-error",
          };
        }
        return {
          ...result,
          validation,
          output:
            result.output +
            (validation.result === "failed"
              ? `\nPost-install validation failed: ${validation.reason}.\n`
              : ""),
        };
      }
      return result;
    },
    postflight: async () => {
      const current = await snapshot(safeEnvironment);
      if (JSON.stringify(current) !== JSON.stringify(baseline))
        block("checkout-changed");
    },
    onStage: ({ stage, result, exitCode }) =>
      console.log(
        `[gate] ${stage}: ${result}${exitCode !== undefined ? ` (exit ${exitCode})` : ""}`,
      ),
  });
  console.log(`[gate] ${evidence.result}; schema ${evidence.schemaVersion}`);
  if (evidence.preflight?.failure)
    console.log(`[gate] preflight: ${evidence.preflight.failure}`);
  process.exitCode = evidence.result === "passed" ? 0 : 1;
}

try {
  await main();
} catch {
  console.error(
    "[gate] failed: evidence or process infrastructure unavailable",
  );
  process.exitCode = 1;
}
