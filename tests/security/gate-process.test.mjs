import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createProcessRunner } from "../../scripts/gate-process.mjs";

test("the process adapter preserves split stdout and stderr without a shell", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "ops-process-"));
  try {
    const npmCli = join(cwd, "npm-stub.mjs");
    await writeFile(
      npmCli,
      'process.stdout.write("opaque-"); setTimeout(() => { process.stdout.write("sentinel\\n"); process.stderr.write("diagnostic\\n"); process.exitCode = 3; }, 20);',
    );
    const result = await createProcessRunner({ npmCli })({
      cwd,
      stage: "format",
      args: [],
      env: {},
    });
    assert.equal(result.exitCode, 3);
    assert.equal(result.stdout, "opaque-sentinel\n");
    assert.ok(result.output.includes("diagnostic\n"));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("the process adapter blocks a stage that exceeds its output limit", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "ops-process-limit-"));
  try {
    const npmCli = join(cwd, "npm-stub.mjs");
    await writeFile(npmCli, 'process.stdout.write("x".repeat(2048));');
    const result = await createProcessRunner({ npmCli, maxOutputBytes: 1024 })({
      cwd,
      stage: "format",
      args: [],
      env: {},
    });
    assert.equal(result.failure, "output-limit");
    assert.notEqual(result.exitCode, 0);
    assert.ok(Buffer.byteLength(result.output) <= 1024);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("the process adapter blocks a stage on timeout", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "ops-process-timeout-"));
  try {
    const npmCli = join(cwd, "npm-stub.mjs");
    await writeFile(npmCli, "setInterval(() => {}, 1000);");
    const result = await createProcessRunner({ npmCli, timeoutMs: 200 })({
      cwd,
      stage: "format",
      args: [],
      env: process.env,
    });
    assert.equal(result.failure, "timeout");
    assert.notEqual(result.exitCode, 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
