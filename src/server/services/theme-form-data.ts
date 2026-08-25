import "server-only";

import { themeInputSchema } from "@/domain/music/content-validation";

export function parseThemeFormData(
  formData: FormData,
  coverUrl: string | null,
) {
  return themeInputSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    coverUrl,
  });
}

export function parseThemeUpdateFormData(formData: FormData) {
  const currentCoverUrl = formData.get("coverUrl");
  const coverUrl =
    formData.get("removeCover") === "on"
      ? null
      : typeof currentCoverUrl === "string"
        ? currentCoverUrl
        : null;

  return parseThemeFormData(formData, coverUrl);
}
