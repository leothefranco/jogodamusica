import { describe, expect, it } from "vitest";

import { siteConfig } from "@/lib/site";

describe("siteConfig", () => {
  it("mantém a identidade pública em português brasileiro", () => {
    expect(siteConfig.name).toBe("Jogo da Música");
    expect(siteConfig.shortName).toBe("Jogo Música");
    expect(siteConfig.locale).toBe("pt-BR");
    expect(siteConfig.description).toContain("músicas");
  });
});
