import { describe, expect, it } from "vitest";

import { countLabel } from "@/lib/language";

describe("linguagem em português", () => {
  it("pluraliza contagens sem marcadores mecânicos", () => {
    expect(countLabel(1, "modalidade")).toBe("1 modalidade");
    expect(countLabel(2, "modalidade")).toBe("2 modalidades");
    expect(countLabel(1, "música ativa", "músicas ativas")).toBe(
      "1 música ativa",
    );
  });
});
