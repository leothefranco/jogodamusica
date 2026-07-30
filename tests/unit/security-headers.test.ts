import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("cabeçalhos de segurança", () => {
  it("restringe recursos externos ao YouTube, Supabase e APIs necessárias", async () => {
    const rules = await nextConfig.headers?.();
    const globalRule = rules?.find((rule) => rule.source === "/(.*)");
    const headers = Object.fromEntries(
      globalRule?.headers.map(({ key, value }) => [key, value]) ?? [],
    );

    expect(headers["Content-Security-Policy"]).toContain(
      "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
    );
    expect(headers["Content-Security-Policy"]).toContain(
      "connect-src 'self' https://*.supabase.co",
    );
    expect(headers["Content-Security-Policy"]).not.toContain(
      "https://www.googleapis.com",
    );
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
  });
});
