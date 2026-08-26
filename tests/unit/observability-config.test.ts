import { describe, expect, it, vi } from "vitest";

import { getObservabilityEnv } from "@/lib/env-runtime";
import { parseObservabilityConfig } from "@/lib/env-schema";

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

  it("deriva preview e production sem rotulá-los como local", () => {
    expect(
      getObservabilityEnv({ VERCEL_ENV: "preview", NODE_ENV: "production" }),
    ).toMatchObject({ environment: "preview", exporter: "structured" });
    expect(
      getObservabilityEnv({ VERCEL_ENV: "production", NODE_ENV: "production" }),
    ).toMatchObject({ environment: "production", exporter: "structured" });
    expect(getObservabilityEnv({ NODE_ENV: "production" })).toMatchObject({
      environment: "production",
    });
    expect(getObservabilityEnv({ NODE_ENV: "development" })).toMatchObject({
      environment: "local",
    });
  });

  it("diagnostica configuração inválida sem valores e interrompe a inicialização", () => {
    const diagnostic = vi.fn();

    expect(() =>
      getObservabilityEnv(
        {
          OBSERVABILITY_ENVIRONMENT: "ambiente-inválido",
          OBSERVABILITY_RAW_RETENTION_DAYS: "31",
        },
        diagnostic,
      ),
    ).toThrow("Configuração de observabilidade inválida.");
    expect(diagnostic).toHaveBeenCalledWith("[observability-config-error]", {
      code: "INVALID_OBSERVABILITY_CONFIG",
      fields: expect.arrayContaining([
        "OBSERVABILITY_ENVIRONMENT",
        "OBSERVABILITY_RAW_RETENTION_DAYS",
      ]),
    });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain(
      "ambiente-inválido",
    );
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("31");
  });
});
