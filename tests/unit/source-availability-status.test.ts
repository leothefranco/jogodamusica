import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SourceAvailabilityStatus } from "@/components/admin/source-availability-status";
import { applySourceAvailabilityResult } from "@/domain/music/source-availability";

const track = {
  providerContentId: "dQw4w9WgXcQ",
  sourceTitle: "Fonte",
  sourceChannel: "Canal",
  thumbnailUrl: "https://example.com/thumb.jpg",
  durationSeconds: 180,
  isEmbeddable: true,
  isRegionAllowed: true,
};
const observedAt = new Date("2026-01-01T00:00:00.000Z");
const observation = applySourceAvailabilityResult({
  current: null,
  observedAt,
  result: { type: "available", reason: "available", track },
});

describe("estado editorial da disponibilidade", () => {
  it("mostra estado, última tentativa, confirmação e vencimentos", () => {
    const html = renderToStaticMarkup(
      createElement(SourceAvailabilityStatus, {
        availability: {
          state: "available_grace",
          playable: true,
          degraded: true,
        },
        observation,
      }),
    );

    expect(html).toContain("Em tolerância");
    expect(html).toContain("policy v1");
    expect(html).toContain("Última tentativa");
    expect(html).toContain("Última confirmação");
    expect(html).toContain("Validade");
    expect(html).toContain("Fim da tolerância");
    expect(html).toContain('dateTime="2026-01-01T00:00:00.000Z"');
    expect(html).toContain('dateTime="2026-01-08T00:00:00.000Z"');
    expect(html).toContain('dateTime="2026-01-09T00:00:00.000Z"');
  });

  it("explicita legado desconhecido sem fabricar confirmação", () => {
    const html = renderToStaticMarkup(
      createElement(SourceAvailabilityStatus, {
        availability: { state: "unknown", playable: false, degraded: false },
        observation: null,
      }),
    );

    expect(html).toContain("Desconhecida");
    expect(html).toContain("Nunca verificada no Brasil");
    expect(html).not.toContain("isEmbeddable");
  });
});
