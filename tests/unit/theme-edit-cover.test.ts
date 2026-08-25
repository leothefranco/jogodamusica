import { describe, expect, it } from "vitest";

import { applyThemeCoverUploadToFormData } from "@/components/admin/theme-form";
import { parseThemeUpdateFormData } from "@/server/services/theme-form-data";

const currentCoverUrl = "https://example.com/current.jpg";
const replacementCoverUrl = "https://example.com/replacement.jpg";

function editFormData() {
  const formData = new FormData();
  formData.set("name", "Clássicos");
  formData.set("slug", "classicos");
  formData.set("description", "");
  formData.set("coverUrl", currentCoverUrl);
  return formData;
}

describe("edição da capa do tema", () => {
  it("preserva a capa ao salvar sem novo arquivo", () => {
    expect(parseThemeUpdateFormData(editFormData())).toMatchObject({
      success: true,
      data: { coverUrl: currentCoverUrl },
    });
  });

  it("substitui a capa pelo upload novo", () => {
    const formData = editFormData();
    formData.set("removeCover", "on");
    applyThemeCoverUploadToFormData("edit", formData, {
      reference: {
        bucket: "theme-covers",
        objectKey:
          "10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000003.jpg",
      },
      publicUrl: replacementCoverUrl,
    });

    expect(parseThemeUpdateFormData(formData)).toMatchObject({
      success: true,
      data: { coverUrl: replacementCoverUrl },
    });
    expect(formData.has("removeCover")).toBe(false);
  });

  it("remove a capa quando solicitado sem novo upload", () => {
    const formData = editFormData();
    formData.set("removeCover", "on");

    expect(parseThemeUpdateFormData(formData)).toMatchObject({
      success: true,
      data: { coverUrl: null },
    });
  });
});
