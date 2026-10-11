import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runGate } from "../../scripts/gate.mjs";

const identity = {
  commit: "a".repeat(40),
  tree: "b".repeat(40),
  node: "24.18.0",
  npm: "11.16.0",
  next: "16.3.3",
};
const requiredStages = [
  "install",
  "format",
  "lint",
  "typegen",
  "typecheck",
  "test",
  "build",
  "build-fixture",
  "e2e",
  "audit",
];

test("a clean gate runs all ten required stages in order and retains evidence", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "ops-gate-"));
  const observed = [];
  try {
    const result = await runGate({
      cwd: process.cwd(),
      outputDir,
      identity: {
        commit: "a".repeat(40),
        tree: "b".repeat(40),
        node: "24.18.0",
        npm: "11.16.0",
        next: "16.3.3",
      },
      runner: async ({ stage }) => {
        observed.push(stage);
        return {
          exitCode: 0,
          output:
            stage === "audit"
              ? JSON.stringify({
                  auditReportVersion: 2,
                  metadata: {
                    vulnerabilities: {
                      info: 0,
                      low: 0,
                      moderate: 0,
                      high: 0,
                      critical: 0,
                      total: 0,
                    },
                  },
                })
              : "ok\n",
        };
      },
    });
    assert.deepEqual(observed, [
      "install",
      "format",
      "lint",
      "typegen",
      "typecheck",
      "test",
      "build",
      "build-fixture",
      "e2e",
      "audit",
    ]);
    assert.equal(result.result, "passed");
    assert.equal(result.stages.length, 10);
    const retained = JSON.parse(
      await readFile(join(outputDir, "evidence.json"), "utf8"),
    );
    assert.equal(retained.commit, "a".repeat(40));
    assert.equal(retained.result, "passed");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

for (const failedStage of requiredStages) {
  test(`failure in ${failedStage} stops dependent stages and preserves prior results`, async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "ops-gate-failure-"));
    const observed = [];
    try {
      const result = await runGate({
        cwd: process.cwd(),
        outputDir,
        identity,
        runner: async ({ stage }) => {
          observed.push(stage);
          return {
            exitCode: stage === failedStage ? 2 : 0,
            output: `${stage} retained\n`,
          };
        },
      });
      const failedIndex = requiredStages.indexOf(failedStage);
      assert.deepEqual(observed, requiredStages.slice(0, failedIndex + 1));
      assert.equal(result.result, "failed");
      assert.equal(result.stages.length, 10);
      assert.equal(result.stages[failedIndex].exitCode, 2);
      assert.equal(result.stages[failedIndex].result, "failed");
      for (const previous of result.stages.slice(0, failedIndex)) {
        assert.equal(previous.result, "passed");
        assert.equal(
          await readFile(join(outputDir, `${previous.stage}.log`), "utf8"),
          `${previous.stage} retained\n`,
        );
      }
      assert.ok(
        result.stages
          .slice(failedIndex + 1)
          .every(
            (stage) => stage.result === "not-run" && stage.exitCode === null,
          ),
      );
      assert.deepEqual(
        JSON.parse(await readFile(join(outputDir, "evidence.json"), "utf8")),
        result,
      );
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
}

test("gate retains only redacted output and supplies an isolated fixture environment", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "ops-gate-redaction-"));
  const secrets = [
    "env-sentinel-opaque",
    "token-sentinel-opaque",
    "cookie-sentinel-opaque",
    "player@example.invalid",
    "203.0.113.42",
    "2001:db8::a42",
    "url-user-sentinel",
    "url-pass-sentinel",
    "query-sentinel",
    "connection-sentinel",
    "capability-sentinel",
  ];
  const output = [
    "safe progress retained",
    secrets[0],
    `Bearer ${secrets[1]}`,
    `Cookie: session=${secrets[2]}`,
    secrets[3],
    secrets[4],
    secrets[5],
    `https://${secrets[6]}:${secrets[7]}@example.invalid/?token=${secrets[8]}`,
    `postgres://user:${secrets[9]}@example.invalid/db`,
    `gameCapability=${secrets[10]}`,
  ].join("\n");
  const supplied = [];
  try {
    const result = await runGate({
      cwd: process.cwd(),
      outputDir,
      identity,
      environment: {
        PATH: process.env.PATH,
        HOME: "safe-home",
        DATABASE_URL: secrets[0],
        SUPABASE_SERVICE_ROLE_KEY: "admin-key-sentinel",
        YOUTUBE_API_KEY: "yt-key-sentinel",
        E2E_TEST_MODE: "1",
        NODE_OPTIONS: "--require private-module",
        npm_config_registry: "https://private.invalid",
        HTTP_PROXY: "http://private.invalid",
      },
      runner: async ({ stage, env }) => {
        supplied.push({ stage, env });
        return { exitCode: stage === "format" ? 3 : 0, output };
      },
    });
    assert.equal(result.result, "failed");
    const retained =
      (await readFile(join(outputDir, "install.log"), "utf8")) +
      (await readFile(join(outputDir, "format.log"), "utf8")) +
      (await readFile(join(outputDir, "evidence.json"), "utf8"));
    for (const secret of secrets)
      assert.ok(!retained.includes(secret), `must not retain ${secret}`);
    assert.ok(retained.includes("safe progress retained"));
    for (const { env } of supplied) {
      assert.equal(env.CI, "true");
      assert.equal(env.DATABASE_URL, undefined);
      assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, undefined);
      assert.equal(env.YOUTUBE_API_KEY, undefined);
      assert.equal(env.NODE_OPTIONS, undefined);
      assert.equal(env.npm_config_registry, undefined);
      assert.equal(env.HTTP_PROXY, undefined);
      assert.equal(env.E2E_TEST_MODE, undefined);
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("a process exception fails closed and retains a safe stage result", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "ops-gate-exception-"));
  try {
    const result = await runGate({
      cwd: process.cwd(),
      outputDir,
      identity,
      runner: async () => {
        throw new Error("private-token@example.invalid");
      },
    });
    assert.equal(result.result, "failed");
    assert.equal(result.stages[0].failure, "process-error");
    assert.equal(result.stages[0].exitCode, null);
    assert.ok(
      !(await readFile(join(outputDir, "evidence.json"), "utf8")).includes(
        "private-token",
      ),
    );
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("generic token and password diagnostics never reach publishable logs", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "ops-gate-labels-"));
  const sentinels = [
    "ops-token-synthetic-92",
    "ops-pass-synthetic-92",
    "ops-session-synthetic-92",
    "ops-mysql-user-92",
    "ops-mysql-pass-92",
  ];
  try {
    await runGate({
      cwd: process.cwd(),
      outputDir,
      identity,
      environment: {},
      runner: async () => ({
        exitCode: 1,
        output: `safe installation progress\ntoken: ${sentinels[0]}\nsenha: ${sentinels[1]}\n{"sessionToken":"${sentinels[2]}"}\nmysql://${sentinels[3]}:${sentinels[4]}@example.invalid/db\nsafe final diagnostic\n`,
      }),
    });
    const retained =
      (await readFile(join(outputDir, "install.log"), "utf8")) +
      (await readFile(join(outputDir, "evidence.json"), "utf8"));
    for (const sentinel of sentinels) assert.ok(!retained.includes(sentinel));
    assert.ok(retained.includes("safe installation progress"));
    assert.ok(retained.includes("safe final diagnostic"));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("the gate uses real project commands and fixture mode only for the fixture build and browser tests", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "ops-gate-commands-"));
  const observed = [];
  try {
    await runGate({
      cwd: process.cwd(),
      outputDir,
      identity,
      environment: { E2E_TEST_MODE: "1" },
      runner: async (request) => {
        observed.push({
          stage: request.stage,
          args: request.args,
          fixture: request.env.E2E_TEST_MODE,
        });
        return {
          exitCode: 0,
          output:
            request.stage === "audit"
              ? '{"auditReportVersion":2,"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}}}'
              : "ok",
        };
      },
    });
    assert.deepEqual(observed, [
      {
        stage: "install",
        args: ["ci", "--no-audit", "--no-fund"],
        fixture: undefined,
      },
      { stage: "format", args: ["run", "format:check"], fixture: undefined },
      { stage: "lint", args: ["run", "lint"], fixture: undefined },
      { stage: "typegen", args: ["run", "typegen"], fixture: undefined },
      {
        stage: "typecheck",
        args: ["run", "typecheck:only"],
        fixture: undefined,
      },
      { stage: "test", args: ["test"], fixture: undefined },
      { stage: "build", args: ["run", "build"], fixture: undefined },
      { stage: "build-fixture", args: ["run", "build"], fixture: "1" },
      {
        stage: "e2e",
        args: [
          "run",
          "test:e2e",
          "--",
          "--reporter=line",
          "--trace=off",
          "--output=tmp/gate-private/test-results",
        ],
        fixture: "1",
      },
      {
        stage: "audit",
        args: ["audit", "--omit=dev", "--audit-level=high", "--json"],
        fixture: undefined,
      },
    ]);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

for (const scenario of [
  {
    label: "clean",
    exitCode: 0,
    high: 0,
    critical: 0,
    expected: "passed",
    reason: "clean",
  },
  {
    label: "high",
    exitCode: 1,
    high: 1,
    critical: 0,
    expected: "failed",
    reason: "vulnerabilities",
  },
  {
    label: "critical",
    exitCode: 1,
    high: 0,
    critical: 1,
    expected: "failed",
    reason: "vulnerabilities",
  },
  {
    label: "unavailable",
    exitCode: 1,
    raw: '{"error":{"code":"ENOAUDIT","summary":"private advisory response"}}',
    expected: "failed",
    reason: "advisory-unavailable",
  },
  {
    label: "invalid response with zero exit",
    exitCode: 0,
    raw: "not JSON",
    expected: "failed",
    reason: "advisory-unavailable",
  },
  {
    label: "high with misleading zero exit",
    exitCode: 0,
    high: 1,
    critical: 0,
    expected: "failed",
    reason: "vulnerabilities",
  },
  {
    label: "clean JSON with failed request",
    exitCode: 2,
    high: 0,
    critical: 0,
    expected: "failed",
    reason: "advisory-unavailable",
  },
]) {
  test(`production audit fails closed: ${scenario.label}`, async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "ops-gate-audit-"));
    const raw =
      scenario.raw ??
      JSON.stringify({
        auditReportVersion: 2,
        metadata: {
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: scenario.high,
            critical: scenario.critical,
            total: scenario.high + scenario.critical,
          },
        },
        vulnerabilities: {
          example: {
            via: [
              {
                url: "https://private.example/token-secret",
                name: "raw-advisory-marker",
              },
            ],
          },
        },
      });
    try {
      const result = await runGate({
        cwd: process.cwd(),
        outputDir,
        identity,
        runner: async ({ stage }) => ({
          exitCode: stage === "audit" ? scenario.exitCode : 0,
          output: stage === "audit" ? raw : "ok",
        }),
      });
      assert.equal(result.result, scenario.expected);
      assert.equal(result.stages[9].audit.reason, scenario.reason);
      const retained =
        (await readFile(join(outputDir, "audit.log"), "utf8")) +
        (await readFile(join(outputDir, "evidence.json"), "utf8"));
      assert.ok(
        !retained.includes("raw-advisory-marker") &&
          !retained.includes("private.example") &&
          !retained.includes("private advisory response"),
      );
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
}
