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
        submitLabel: "Salvar",
      }),
    );

    expect(html).toContain('type="file"');
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).not.toContain('type="url"');
  });
});
