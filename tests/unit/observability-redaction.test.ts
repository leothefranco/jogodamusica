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
});
