import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

const source = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);

describe("service worker público", () => {
  it("serve JavaScript atualizável com acesso ao escopo raiz", async () => {
    const rules = await nextConfig.headers?.();
    const serviceWorkerRule = rules?.find((rule) => rule.source === "/sw.js");
    const headers = Object.fromEntries(
      serviceWorkerRule?.headers.map(({ key, value }) => [key, value]) ?? [],
    );

    expect(headers["Content-Type"]).toBe(
      "application/javascript; charset=utf-8",
    );
    expect(headers["Cache-Control"]).toBe("no-cache");
    expect(headers["Service-Worker-Allowed"]).toBe("/");
    expect(source).toContain("self.addEventListener");
  });

  it("limita o cache a assets públicos e usa fallback somente para navegação", () => {
    expect(source).toContain("url.origin !== self.location.origin");
    expect(source).toContain('url.pathname.startsWith("/_next/static/")');
    expect(source).toContain('url.pathname.startsWith("/icons/")');
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('url.pathname.startsWith("/admin")');
    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain('cache.match("/offline")');
    expect(source).toContain('request.method !== "GET"');
    expect(source).not.toContain("CACHEABLE_DESTINATIONS");
  });
});
