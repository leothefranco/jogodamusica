import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const stages = [
  ["install", ["ci", "--no-audit", "--no-fund"]],
  ["format", ["run", "format:check"]],
  ["lint", ["run", "lint"]],
  ["typegen", ["run", "typegen"]],
  ["typecheck", ["run", "typecheck:only"]],
  ["test", ["test"]],
  ["build", ["run", "build"]],
  ["build-fixture", ["run", "build"]],
  [
    "e2e",
    [
      "run",
      "test:e2e",
      "--",
      "--reporter=line",
      "--trace=off",
      "--output=tmp/gate-private/test-results",
    ],
  ],
  ["audit", ["audit", "--omit=dev", "--audit-level=high", "--json"]],
];

function auditResult(output, exitCode) {
  const unavailable = {
    result: "failed",
    reason: "advisory-unavailable",
    counts: null,
  };
  try {
    const report = JSON.parse(output);
    const source = report.metadata?.vulnerabilities;
    const keys = ["info", "low", "moderate", "high", "critical", "total"];
    if (
      report.auditReportVersion !== 2 ||
      report.error ||
      !source ||
      !keys.every(
        (key) => Number.isSafeInteger(source[key]) && source[key] >= 0,
      )
    )
      return unavailable;
    const counts = Object.fromEntries(keys.map((key) => [key, source[key]]));
    if (
      counts.total !==
      counts.info + counts.low + counts.moderate + counts.high + counts.critical
    )
      return unavailable;
    if (exitCode !== 0 && exitCode !== 1) return unavailable;
    if (counts.high || counts.critical)
      return { result: "failed", reason: "vulnerabilities", counts };
    if (exitCode !== 0) return unavailable;
    return { result: "passed", reason: "clean", counts };
  } catch {
    return unavailable;
  }
}

const infrastructureKeys = [
  "PATH",
  "Path",
  "SYSTEMROOT",
  "SystemRoot",
  "WINDIR",
  "windir",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "PATHEXT",
  "COMSPEC",
  "ComSpec",
  "NUMBER_OF_PROCESSORS",
];

function isolatedEnvironment(environment, stage, privateDir, port) {
  const env = Object.fromEntries(
    infrastructureKeys
      .filter((key) => environment[key] !== undefined)
      .map((key) => [key, environment[key]]),
  );
  env.CI = "true";
  env.NEXT_TELEMETRY_DISABLED = "1";
  env.NPM_CONFIG_USERCONFIG = join(privateDir, "user.npmrc");
  env.NPM_CONFIG_GLOBALCONFIG = join(privateDir, "global.npmrc");
  env.NPM_CONFIG_REGISTRY = "https://registry.npmjs.org/";
  env.NPM_CONFIG_CACHE = join(privateDir, "npm-cache");
  env.NPM_CONFIG_UPDATE_NOTIFIER = "false";
  env.PLAYWRIGHT_BROWSERS_PATH = join(privateDir, "browsers");
  env.PLAYWRIGHT_PORT = String(port);
  env.TEMP = join(privateDir, "temp");
  env.TMP = env.TEMP;
  env.TMPDIR = env.TEMP;
  if (stage === "build-fixture" || stage === "e2e") env.E2E_TEST_MODE = "1";
  return env;
}

function redact(output, environment) {
  let safe = String(output ?? "").replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
  for (const value of Object.values(environment)
    .filter((value) => typeof value === "string" && value.length >= 4)
    .sort((a, b) => b.length - a.length))
    safe = safe.replaceAll(value, "[REDACTED]");
  safe = safe.replace(
    /(?:https?|postgres(?:ql)?|redis|mongodb(?:\+srv)?):\/\/[^\s<>"']+/gi,
    "[URL REDACTED]",
  );
  safe = safe.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[EMAIL REDACTED]",
  );
  safe = safe.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP REDACTED]");
  safe = safe.replace(
    /(?<![\w:])(?:[a-f\d]{0,4}:){2,}[a-f\d:.]*(?!\w)/gi,
    "[IP REDACTED]",
  );
  safe = safe.replace(
    /\b[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\b/gi,
    "[CAPABILITY REDACTED]",
  );
  safe = safe.replace(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    "[TOKEN REDACTED]",
  );
  safe = safe.replace(
    /^.*(?:\b(?:set-cookie|cookie|authorization|bearer|gameCapability|capability|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password)\b|\b[A-Z][A-Z0-9_]{2,}\s*=).*$/gim,
    "[SENSITIVE LINE REDACTED]",
  );
  return safe;
}

export async function runGate({
  cwd,
  outputDir,
  identity,
  runner,
  preflight,
  postflight,
  onStage = () => {},
  environment = process.env,
  port = 3182,
}) {
  await mkdir(outputDir, { recursive: true });
  const privateDir = join(outputDir, ".private");
  await mkdir(join(privateDir, "temp"), { recursive: true });
  await writeFile(join(privateDir, "user.npmrc"), "");
  await writeFile(join(privateDir, "global.npmrc"), "");
  const evidence = {
    schema: "jogodamusica/code-gate",
    schemaVersion: 1,
    commit: null,
    tree: null,
    runtime: { node: process.versions.node, npm: null },
    next: null,
    platform: process.platform,
    startedAt: new Date().toISOString(),
    result: "running",
    stages: stages.map(([stage]) => ({
      stage,
      exitCode: null,
      durationMs: 0,
      result: "not-run",
    })),
  };
  const persist = async () => {
    const temporary = join(outputDir, "evidence.json.tmp");
    await writeFile(temporary, `${JSON.stringify(evidence, null, 2)}\n`);
    await rename(temporary, join(outputDir, "evidence.json"));
  };
  const safeFailure = (error) =>
    [
      "runtime-mismatch",
      "checkout-dirty",
      "checkout-changed",
      "credential-source",
      "manifest-invalid",
      "port-unavailable",
    ].includes(error?.code)
      ? error.code
      : "preflight-error";
  await persist();
  try {
    if (preflight)
      identity = await preflight({
        env: isolatedEnvironment(environment, "preflight", privateDir, port),
      });
    if (
      !identity ||
      !/^[a-f\d]{40}$/.test(identity.commit) ||
      !/^[a-f\d]{40}$/.test(identity.tree) ||
      ![identity.node, identity.npm, identity.next].every((version) =>
        /^\d+\.\d+\.\d+$/.test(version),
      )
    )
      throw new Error("Invalid gate identity");
    evidence.commit = identity.commit;
    evidence.tree = identity.tree;
    evidence.runtime = { node: identity.node, npm: identity.npm };
    evidence.next = identity.next;
    evidence.preflight = {
      result: "passed",
      credentialIsolation: "allowlist-and-empty-config",
    };
  } catch (error) {
    evidence.preflight = { result: "failed", failure: safeFailure(error) };
    evidence.result = "failed";
    evidence.exitCode = 1;
    evidence.finishedAt = new Date().toISOString();
    await persist();
    return evidence;
  }
  for (const [index, [stage, args]] of stages.entries()) {
    const started = performance.now();
    evidence.stages[index].result = "running";
    await persist();
    onStage({ stage, result: "running" });
    let response;
    let failure;
    const stageEnvironment = isolatedEnvironment(
      environment,
      stage,
      privateDir,
      port,
    );
    try {
      response = await runner({ stage, args, cwd, env: stageEnvironment });
    } catch {
      response = { exitCode: null, output: "Process execution failed.\n" };
      failure = "process-error";
    }
    if (["timeout", "output-limit", "interrupted"].includes(response.failure))
      failure = response.failure;
    const audit =
      stage === "audit"
        ? auditResult(response.stdout ?? response.output, response.exitCode)
        : undefined;
    await writeFile(
      join(outputDir, `${stage}.log`),
      audit
        ? `${JSON.stringify(audit)}\n`
        : redact(response.output, { ...environment, ...stageEnvironment }),
    );
    evidence.stages[index] = {
      stage,
      exitCode: response.exitCode,
      durationMs: Math.round(performance.now() - started),
      result: failure
        ? "failed"
        : (audit?.result ?? (response.exitCode === 0 ? "passed" : "failed")),
      ...(audit ? { audit } : {}),
      ...(failure ? { failure } : {}),
    };
    await persist();
    onStage(evidence.stages[index]);
    if (evidence.stages[index].result !== "passed") break;
  }
  evidence.result = evidence.stages.every((stage) => stage.result === "passed")
    ? "passed"
    : "failed";
  if (postflight) {
    try {
      await postflight();
      evidence.postflight = { result: "passed" };
    } catch (error) {
      evidence.postflight = { result: "failed", failure: safeFailure(error) };
      evidence.result = "failed";
    }
  }
  evidence.finishedAt = new Date().toISOString();
  evidence.exitCode = evidence.result === "passed" ? 0 : 1;
  await persist();
  return evidence;
}
