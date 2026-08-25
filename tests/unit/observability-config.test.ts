import { describe, expect, it } from "vitest";

import { parseObservabilityConfig } from "@/server/observability/config";

describe("configuração segura de observabilidade", () => {
  it("torna a retenção bruta verificável e limita o teto a 30 dias", () => {
    expect(parseObservabilityConfig({})).toEqual({
      environment: "local",
      exporter: "structured",
      rawRetentionDays: 30,
    });
    expect(
      parseObservabilityConfig({
        OBSERVABILITY_ENVIRONMENT: "preview",
        OBSERVABILITY_EXPORTER: "none",
        OBSERVABILITY_RAW_RETENTION_DAYS: "7",
        RELEASE_COMMIT: "2a24bf9059e95ca7b96c2364c0763d7de6e7c70e",
      }),
    ).toEqual({
      environment: "preview",
      exporter: "none",
      rawRetentionDays: 7,
      releaseCommit: "2a24bf9059e95ca7b96c2364c0763d7de6e7c70e",
    });
    expect(() =>
      parseObservabilityConfig({ OBSERVABILITY_RAW_RETENTION_DAYS: "31" }),
    ).toThrow();
  });
});
