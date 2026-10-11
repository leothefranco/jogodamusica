import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("the CLI rejects a mismatched declared runtime before installing and retains safe evidence", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "ops-cli-"));
  try {
    await writeFile(join(cwd, ".nvmrc"), "24.0.0\n");
    await writeFile(
      join(cwd, "package.json"),
      JSON.stringify({
        engines: { node: "24.x" },
        packageManager: "npm@11.16.0",
        dependencies: { next: "16.3.3" },
      }),
    );
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../../scripts/gate-cli.mjs", import.meta.url))],
      {
        cwd,
        env: { ...process.env, DATABASE_URL: "preflight-private-sentinel" },
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      },
    );
    assert.equal(child.status, 1);
    const evidenceDirectory = join(cwd, "tmp", "gate");
    const runs = await readdir(evidenceDirectory);
    assert.equal(runs.length, 1);
    const raw = await readFile(
      join(evidenceDirectory, runs[0], "evidence.json"),
      "utf8",
    );
    const evidence = JSON.parse(raw);
    assert.equal(evidence.result, "failed");
    assert.equal(evidence.preflight.failure, "runtime-mismatch");
    assert.ok(evidence.stages.every((stage) => stage.result === "not-run"));
    assert.ok(
      !(raw + child.stdout + child.stderr).includes(
        "preflight-private-sentinel",
      ),
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

for (const scenario of [
  "installed-next-mismatch",
  "checkout-changed",
  "installation-validation-error",
]) {
  test(`a successful immutable install retains its output and process exit when ${scenario}`, async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ops-cli-validation-"));
    try {
      await writeFile(join(cwd, ".nvmrc"), `${process.versions.node}\n`);
      await writeFile(join(cwd, ".gitignore"), "node_modules/\ntmp/\n");
      await writeFile(
        join(cwd, "package.json"),
        JSON.stringify({
          engines: { node: `${process.versions.node.split(".")[0]}.x` },
          packageManager: "npm@11.16.0",
          dependencies: { next: "16.3.3" },
        }),
      );
      await writeFile(
        join(cwd, "package-lock.json"),
        JSON.stringify({
          lockfileVersion: 3,
          packages: {
            "": { dependencies: { next: "16.3.3" } },
            "node_modules/next": { version: "16.3.3" },
          },
        }),
      );
      const npmCli = join(cwd, "tools", "npm", "bin", "npm-cli.js");
      await mkdir(join(cwd, "tools", "npm", "bin"), { recursive: true });
      await writeFile(
        npmCli,
        `const fs = require("node:fs");
if (process.argv.includes("--version")) { console.log("11.16.0"); }
else {
console.log("original install output retained");
fs.mkdirSync("node_modules/next", { recursive: true });
fs.writeFileSync("node_modules/next/package.json", ${JSON.stringify(scenario === "installation-validation-error" ? "not-json" : JSON.stringify({ version: scenario === "installed-next-mismatch" ? "16.3.0" : "16.3.3" }))});
${scenario === "checkout-changed" ? 'fs.appendFileSync("package-lock.json", "\\n");' : ""}
}`,
      );
      for (const args of [
        ["init", "--initial-branch=codex/ops-fixture"],
        ["add", "."],
        [
          "-c",
          "user.name=OPS fixture",
          "-c",
          "user.email=ops@example.invalid",
          "commit",
          "-m",
          "test fixture",
        ],
      ]) {
        const result = spawnSync(
          "git",
          [
            "-c",
            `safe.directory=${cwd}`,
            "-c",
            `core.hooksPath=${join(cwd, "tmp", "no-hooks")}`,
            ...args,
          ],
          { cwd, encoding: "utf8", windowsHide: true },
        );
        assert.equal(result.status, 0);
      }
      const child = spawnSync(
        process.execPath,
        [fileURLToPath(new URL("../../scripts/gate-cli.mjs", import.meta.url))],
        {
          cwd,
          env: { ...process.env, npm_execpath: npmCli },
          encoding: "utf8",
          timeout: 20_000,
          windowsHide: true,
        },
      );
      assert.equal(child.status, 1);
      const runs = await readdir(join(cwd, "tmp", "gate"));
      const directory = join(cwd, "tmp", "gate", runs[0]);
      const evidence = JSON.parse(
        await readFile(join(directory, "evidence.json"), "utf8"),
      );
      assert.equal(evidence.stages[0].exitCode, 0);
      assert.equal(evidence.stages[0].result, "failed");
      assert.equal(evidence.stages[0].validation.reason, scenario);
      assert.ok(
        (await readFile(join(directory, "install.log"), "utf8")).includes(
          "original install output retained",
        ),
      );
      assert.ok(
        evidence.stages.slice(1).every((stage) => stage.result === "not-run"),
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
}
