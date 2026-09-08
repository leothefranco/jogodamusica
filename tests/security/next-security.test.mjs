import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const command = fileURLToPath(
  new URL("../../scripts/check-next-security.mjs", import.meta.url),
);

function fixture(t, version = "16.3.3") {
  const fixtureRoot = path.resolve(tmpdir());
  const cwd = mkdtempSync(path.join(fixtureRoot, "next-security-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(cwd)), fixtureRoot);
    assert.ok(path.basename(cwd).startsWith("next-security-"));
    rmSync(cwd, { recursive: true, force: true });
  });
  const manifest = {
    dependencies: { next: version },
    devDependencies: { "eslint-config-next": version },
  };
  const lock = {
    lockfileVersion: 3,
    packages: {
      "": structuredClone(manifest),
      "node_modules/next": { version },
      "node_modules/eslint-config-next": { version },
    },
  };
  const write = (name, value) => {
    const destination = path.join(cwd, name);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, JSON.stringify(value));
  };
  write("package.json", manifest);
  write("package-lock.json", lock);
  write("node_modules/next/package.json", { version });
  write("node_modules/eslint-config-next/package.json", { version });
  return {
    cwd,
    manifest,
    lock,
    write,
    run: () =>
      spawnSync(process.execPath, [command], { cwd, encoding: "utf8" }),
  };
}

test("rejeita a instalação vulnerável 16.3.0 mesmo com manifesto e lock coerentes", (t) => {
  const result = fixture(t, "16.3.0").run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /16\.3\.3/);
});
test("aceita a versão corrigida 16.3.3", (t) => {
  const result = fixture(t).run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /16\.3\.3/);
});

test("rejeita downgrade instalado mesmo quando o manifesto e lock prometem o patch", (t) => {
  const project = fixture(t);
  project.write("node_modules/next/package.json", { version: "16.3.0" });
  const result = project.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /instalada/);
});
for (const [description, mutate] of [
  [
    "versão vulnerável no lock",
    (project) => {
      project.lock.packages["node_modules/next"].version = "16.3.0";
    },
  ],
  [
    "pin divergente na raiz do lock",
    (project) => {
      project.lock.packages[""].dependencies.next = "^16.3.3";
    },
  ],
  [
    "ESLint Next fora da versão do framework",
    (project) => {
      project.manifest.devDependencies["eslint-config-next"] = "16.3.0";
    },
  ],
]) {
  test(`rejeita ${description}`, (t) => {
    const project = fixture(t);
    mutate(project);
    project.write("package.json", project.manifest);
    project.write("package-lock.json", project.lock);
    const result = project.run();
    assert.equal(result.status, 1, result.stdout + result.stderr);
  });
}
for (const version of [
  "16.3.1",
  "16.3.2",
  "^16.3.3",
  "16.3.3-canary.1",
  "16.4.0",
  "17.0.0",
  "16.3.03",
]) {
  test(`rejeita versão não aprovada: ${version}`, (t) => {
    const result = fixture(t, version).run();
    assert.equal(result.status, 1, result.stdout + result.stderr);
  });
}

test("compara o número do patch sem ordenação textual", (t) => {
  const result = fixture(t, "16.3.10").run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("rejeita ESLint Next instalado divergente", (t) => {
  const project = fixture(t);
  project.write("node_modules/eslint-config-next/package.json", {
    version: "16.3.0",
  });
  const result = project.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /instalada/);
});

test("falha quando o lock não contém a instalação do Next", (t) => {
  const project = fixture(t);
  delete project.lock.packages["node_modules/next"];
  project.write("package-lock.json", project.lock);
  const result = project.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
});
