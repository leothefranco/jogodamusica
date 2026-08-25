import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/theme-cover-upload", () => ({
  uploadThemeCover: vi.fn(),
}));

import { ThemeForm } from "@/components/admin/theme-form";

describe("formulário de tema", () => {
  it("oferece anexo de imagem em vez de exigir uma URL", () => {
    const html = renderToStaticMarkup(
      createElement(ThemeForm, {
        action: vi.fn(),
        mode: "create",
        submitLabel: "Salvar",
      }),
    );

    expect(html).toContain('type="file"');
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).not.toContain('type="url"');
    expect(html).toContain('name="coverReference"');
    expect(html).not.toContain('name="coverUrl"');
    expect(html).not.toContain('name="removeCover"');
  });

  it("mantém explicitamente o contrato de capa da edição", () => {
    const html = renderToStaticMarkup(
      createElement(ThemeForm, {
        action: vi.fn(),
        mode: "edit",
        submitLabel: "Salvar",
        defaults: {
          name: "Clássicos",
          slug: "classicos",
          description: "",
          coverUrl: "https://example.com/capa.jpg",
        },
      }),
    );

    expect(html).toContain('name="coverUrl"');
    expect(html).toContain('name="removeCover"');
    expect(html).not.toContain('name="coverReference"');
  });
});
