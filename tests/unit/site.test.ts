import { describe, expect, it } from "vitest";

import { siteConfig } from "@/lib/site";

describe("siteConfig", () => {
  it("identifica Last Track Standing e distingue o launcher administrativo sem traduzir a interface", () => {
    expect(siteConfig).toMatchObject({
      name: "Last Track Standing",
      shortName: "Last Track",
      adminName: "Last Track Standing Admin",
      adminShortName: "LTS Admin",
    });
    expect(siteConfig.locale).toBe("pt-BR");
    expect(siteConfig.description).toContain("músicas");
  });
});
