import { spawn } from "node:child_process";
import { join } from "node:path";

function stopTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const executable = join(
      process.env.SYSTEMROOT ?? process.env.SystemRoot ?? "C:\\Windows",
      "System32",
      "taskkill.exe",
    );
    const killer = spawn(executable, ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.on("error", () => child.kill());
    killer.on("exit", (code) => {
      if (code !== 0) child.kill();
    });
    const fallback = setTimeout(() => child.kill(), 2000);
    fallback.unref();
    child.once("close", () => clearTimeout(fallback));
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

export function createProcessRunner({
  npmCli,
  timeoutMs = 20 * 60 * 1000,
  maxOutputBytes = 32 * 1024 * 1024,
}) {
  return ({ cwd, args, env }) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [npmCli, ...args], {
        cwd,
        env,
        shell: false,
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout = [];
      const stderr = [];
      let bytes = 0;
      let failure;
      const timeout = setTimeout(() => {
        failure = "timeout";
        stopTree(child);
      }, timeoutMs);
      const receive = (target) => (chunk) => {
        if (failure) return;
        if (bytes + chunk.length > maxOutputBytes) {
          failure = "output-limit";
          stopTree(child);
          return;
        }
        bytes += chunk.length;
        target.push(chunk);
      };
      child.stdout.on("data", receive(stdout));
      child.stderr.on("data", receive(stderr));
      const interrupt = () => {
        failure = "interrupted";
        stopTree(child);
      };
      process.once("SIGINT", interrupt);
      process.once("SIGTERM", interrupt);
      const cleanup = () => {
        clearTimeout(timeout);
        process.removeListener("SIGINT", interrupt);
        process.removeListener("SIGTERM", interrupt);
      };
      child.once("error", (error) => {
        cleanup();
        reject(error);
      });
      child.once("close", (exitCode) => {
        cleanup();
        const out = Buffer.concat(stdout).toString("utf8");
        resolve({
          exitCode: failure ? null : exitCode,
          stdout: out,
          output: out + Buffer.concat(stderr).toString("utf8"),
          ...(failure ? { failure } : {}),
        });
      });
    });
}
