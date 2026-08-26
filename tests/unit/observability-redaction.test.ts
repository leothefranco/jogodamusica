import { describe, expect, it } from "vitest";

import { redactDiagnosticValue } from "@/server/observability/redaction";

describe("redaction operacional central", () => {
  it("remove sentinelas sensíveis inclusive em campos aninhados", () => {
    const sensitiveValues = [
      "pessoa@example.com",
      "203.0.113.10",
      "2001:db8::1",
      "Bearer token-super-secreto",
      "token=token-super-secreto",
      "capability=games:write",
      "postgres://alice:senha@db.example.com/game",
      "Server=db.example.com;User Id=alice;Password=senha;Database=game",
      "https://alice:senha@example.com/private?token=segredo",
    ];
    const diagnostic = {
      message: sensitiveValues.join(" | "),
      nested: [{ cause: sensitiveValues }],
    };

    const serialized = JSON.stringify(redactDiagnosticValue(diagnostic));

    for (const sensitiveValue of sensitiveValues) {
      expect(serialized).not.toContain(sensitiveValue);
    }
    expect(serialized).toContain("[REDACTED");
  });

  it("remove chaves compostas snake, kebab e camel em strings e objetos", () => {
    const sensitiveAssignments = [
      "YOUTUBE_API_KEY=sentinela-youtube-string",
      "RATE_LIMIT_KEY_SECRET=sentinela-rate-string",
      "client_secret=sentinela-client-string",
      "access_token=sentinela-access-string",
      "client-secret=sentinela-kebab-string",
      "accessToken=sentinela-camel-string",
    ];
    const diagnostic = {
      message: sensitiveAssignments.join(" | "),
      nested: {
        YOUTUBE_API_KEY: "sentinela-youtube-object",
        RATE_LIMIT_KEY_SECRET: "sentinela-rate-object",
        client_secret: "sentinela-client-object",
        access_token: "sentinela-access-object",
        "client-secret": "sentinela-kebab-object",
        accessToken: "sentinela-camel-object",
      },
    };
    const forbiddenValues = [
      ...sensitiveAssignments,
      ...Object.values(diagnostic.nested),
    ];

    const serialized = JSON.stringify(redactDiagnosticValue(diagnostic));

    for (const forbiddenValue of forbiddenValues) {
      expect(serialized).not.toContain(forbiddenValue);
    }
    expect(serialized.match(/\[REDACTED\]/g)).toHaveLength(12);
  });

  it("remove por inteiro assignments sensíveis citados com espaços e delimitadores", () => {
    const sensitiveAssignments = [
      'client_secret="alpha beta"',
      "access_token='gamma delta;epsilon'",
      'client-secret="zeta eta,theta"',
      "accessToken='iota kappa|lambda'",
      'YOUTUBE_API_KEY="mu nu:xi"',
      "RATE_LIMIT_KEY_SECRET='omicron pi=rho'",
      'client_secret="escaped \\"inner\\" tail"',
      `access_token="lineone
linetwo"`,
    ];
    const diagnostic = {
      message: sensitiveAssignments.join(" | "),
      nested: {
        client_secret: "sigma tau",
        access_token: "upsilon phi",
        "client-secret": "chi psi",
        accessToken: "omega alphaobject",
        YOUTUBE_API_KEY: "betaobject gammaobject",
        RATE_LIMIT_KEY_SECRET: "deltaobject epsilonobject",
      },
      ordinary: 'tokenizer="nota pública de catálogo permanece intacta"',
    };
    const forbiddenFragments = [
      "alpha",
      "beta",
      "gamma",
      "delta",
      "epsilon",
      "zeta",
      "eta",
      "theta",
      "iota",
      "kappa",
      "lambda",
      "mu",
      "nu",
      "xi",
      "omicron",
      "pi",
      "rho",
      "sigma",
      "tau",
      "upsilon",
      "phi",
      "chi",
      "psi",
      "omega",
      "alphaobject",
      "betaobject",
      "gammaobject",
      "deltaobject",
      "epsilonobject",
      "escaped",
      "inner",
      "tail",
      "lineone",
      "linetwo",
    ];

    const serialized = JSON.stringify(redactDiagnosticValue(diagnostic));

    for (const fragment of forbiddenFragments) {
      expect(serialized).not.toContain(fragment);
    }
    expect(serialized).toContain(
      'tokenizer=\\"nota pública de catálogo permanece intacta\\"',
    );
    expect(serialized.match(/\[REDACTED\]/g)).toHaveLength(14);
  });
});
