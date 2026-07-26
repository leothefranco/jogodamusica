import { describe, expect, it } from "vitest";

import { loginSchema } from "@/server/auth/validation";

describe("loginSchema", () => {
  it("normaliza um login válido", () => {
    expect(
      loginSchema.parse({
        email: " admin@example.com ",
        password: "senha-segura",
      }),
    ).toEqual({
      email: "admin@example.com",
      password: "senha-segura",
    });
  });

  it("rejeita e-mail inválido e senha vazia", () => {
    const result = loginSchema.safeParse({
      email: "email-inválido",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});
