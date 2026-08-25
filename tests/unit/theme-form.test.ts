import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/theme-cover-upload", () => ({
  uploadThemeCover: vi.fn(),
}));

import { ThemeForm } from "@/components/admin/theme-form";
import { submitThemeForm } from "@/components/admin/theme-form";
import { initialContentActionState } from "@/components/admin/content-action-state";

describe("formulário de tema", () => {
  it("preserva o upload quando a action rejeita e o reutiliza no retry", async () => {
    const file = new File([Uint8Array.from([0xff, 0xd8, 0xff])], "capa.jpg", {
      type: "image/jpeg",
    });
    const upload = {
      reference: {
        bucket: "theme-covers" as const,
        objectKey:
          "10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000003.jpg",
      },
      publicUrl: "https://project.supabase.co/capa.jpg",
    };
    const uploadCover = vi.fn().mockResolvedValue(upload);
    const action = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("abortado", "AbortError"))
      .mockResolvedValueOnce(initialContentActionState);
    const firstFormData = new FormData();
    firstFormData.set("coverFile", file);

    const first = await submitThemeForm({
      action,
      cachedUpload: null,
      formData: firstFormData,
      mode: "create",
      previousState: initialContentActionState,
      selectedFile: file,
      uploadCover,
    });

    expect(first.state).toMatchObject({
      status: "error",
      coverReferenceStatus: "reusable",
    });
    expect(first.cachedUpload).toEqual({ file, upload });

    const retryFormData = new FormData();
    retryFormData.set("coverFile", file);
    await expect(
      submitThemeForm({
        action,
        cachedUpload: first.cachedUpload,
        formData: retryFormData,
        mode: "create",
        previousState: first.state,
        selectedFile: file,
        uploadCover,
      }),
    ).resolves.toMatchObject({ state: initialContentActionState });
    expect(uploadCover).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("não converte redirect do framework em erro recuperável", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/admin/temas;303;",
    });

    await expect(
      submitThemeForm({
        action: vi.fn().mockRejectedValue(redirectError),
        cachedUpload: null,
        formData: new FormData(),
        mode: "create",
        previousState: initialContentActionState,
        selectedFile: null,
        uploadCover: vi.fn(),
      }),
    ).rejects.toBe(redirectError);
  });

  it("não chama action, workflow ou repositório quando o upload rejeita", async () => {
    const repository = vi.fn();
    const workflow = vi.fn(() => repository());
    const action = vi.fn(() => workflow());
    const file = new File([Uint8Array.from([0xff, 0xd8, 0xff])], "capa.jpg", {
      type: "image/jpeg",
    });
    const formData = new FormData();
    formData.set("coverFile", file);

    await expect(
      submitThemeForm({
        action,
        cachedUpload: null,
        formData,
        mode: "create",
        previousState: initialContentActionState,
        selectedFile: file,
        uploadCover: vi.fn().mockRejectedValue(new Error("upload failed")),
      }),
    ).resolves.toMatchObject({ state: { status: "error" } });
    expect(action).not.toHaveBeenCalled();
    expect(workflow).not.toHaveBeenCalled();
    expect(repository).not.toHaveBeenCalled();
  });

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
