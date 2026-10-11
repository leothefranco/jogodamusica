import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
