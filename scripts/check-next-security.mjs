import { readFileSync } from "node:fs";
import path from "node:path";

function readJson(file) {
  return JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8"));
}

function isPatchedVersion(version) {
  const match =
    typeof version === "string" && /^16\.3\.(0|[1-9]\d*)$/.exec(version);
  return Boolean(
    match && Number.isSafeInteger(Number(match[1])) && Number(match[1]) >= 3,
  );
}

try {
  const manifest = readJson("package.json");
  const lock = readJson("package-lock.json");
  const version = manifest.dependencies?.next;
  if (!isPatchedVersion(version)) {
    throw new Error(
      "Next.js deve estar fixado em uma versão estável da linha 16.3, no mínimo 16.3.3.",
    );
  }
  if (lock.lockfileVersion !== 3) {
    throw new Error("O gate requer package-lock.json no formato 3.");
  }
  for (const [name, section] of [
    ["next", "dependencies"],
    ["eslint-config-next", "devDependencies"],
  ]) {
    if (manifest[section]?.[name] !== version) {
      throw new Error(
        `${name}: o manifesto deve usar o mesmo pin exato de Next.js (${version}).`,
      );
    }
    if (
      lock.packages?.[""]?.[section]?.[name] !== version ||
      lock.packages?.[`node_modules/${name}`]?.version !== version
    ) {
      throw new Error(`${name}: o lockfile diverge do manifesto revisado.`);
    }
    const installed = readJson(`node_modules/${name}/package.json`).version;
    if (installed !== version) {
      throw new Error(
        `${name}: versão instalada diverge do manifesto revisado.`,
      );
    }
  }
  console.log(
    `Gate de segurança aprovado: next=${version}; eslint-config-next=${version}; manifesto, lock e instalação conferem.`,
  );
} catch (error) {
  console.error(`Gate de segurança Next.js: ${error.message}`);
  process.exitCode = 1;
}
