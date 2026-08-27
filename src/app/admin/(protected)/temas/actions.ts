"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  trackAssociationInputSchema,
  themeSongInputSchema,
} from "@/domain/music/content-validation";
import type { ContentActionState } from "@/components/admin/content-action-state";
import { fieldErrorsFromZod, toAppError } from "@/lib/errors";
import { requireAdmin } from "@/server/auth/session";
import { createThemeActionAdapter } from "@/server/actions/create-theme-action";
import { createThemeWithManagedCover } from "@/server/services/create-theme-workflow";
import { parseThemeUpdateFormData } from "@/server/services/theme-form-data";
import {
  attachResolvedTrack,
  deleteTheme,
  removeThemeSong,
  revalidateSourceAvailability,
  setThemePublication,
  updateTheme,
  updateThemeSong,
} from "@/server/services/theme-content-service";

const runCreateThemeAction = createThemeActionAdapter({
  authenticate: requireAdmin,
  createTheme: createThemeWithManagedCover,
});

function errorState(error: unknown): ContentActionState {
  const appError = toAppError(error);
  return {
    status: "error",
    message: appError.message,
    fieldErrors: appError.fieldErrors,
  };
}

function validationState(
  message: string,
  fieldErrors: Record<string, string[] | undefined>,
): ContentActionState {
  return {
    status: "error",
    message,
    fieldErrors: fieldErrorsFromZod(fieldErrors),
  };
}

export async function createThemeAction(
  _previousState: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const result = await runCreateThemeAction(formData);
  if ("status" in result) return result;

  revalidatePath("/admin");
  revalidatePath("/admin/temas");
  redirect(`/admin/temas/${result.themeId}?message=Tema criado`);
}

export async function updateThemeAction(
  themeId: string,
  _previousState: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  await requireAdmin();
  const parsed = parseThemeUpdateFormData(formData);
  if (!parsed.success) {
    return validationState(
      "Revise os campos do tema.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    await updateTheme(themeId, parsed.data);
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/");
  revalidatePath(`/tema/${parsed.data.slug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/temas");
  revalidatePath(`/admin/temas/${themeId}`);
  redirect(`/admin/temas/${themeId}?message=Tema atualizado`);
}

export async function setThemePublicationAction(
  themeId: string,
  isActive: boolean,
) {
  await requireAdmin();

  let message: string;
  try {
    await setThemePublication(themeId, isActive);
    message = isActive ? "Tema publicado" : "Tema desativado";
  } catch (error) {
    message = toAppError(error).message;
    redirect(`/admin/temas/${themeId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/temas");
  revalidatePath(`/admin/temas/${themeId}`);
  redirect(`/admin/temas/${themeId}?message=${encodeURIComponent(message)}`);
}

export async function deleteThemeAction(themeId: string) {
  await requireAdmin();

  try {
    await deleteTheme(themeId);
  } catch (error) {
    redirect(
      `/admin/temas/${themeId}?error=${encodeURIComponent(toAppError(error).message)}`,
    );
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/temas");
  redirect("/admin/temas?message=Tema excluído");
}

export async function attachTrackAction(
  themeId: string,
  _previousState: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  await requireAdmin();
  const parsed = trackAssociationInputSchema.safeParse({
    providerContentId: formData.get("providerContentId"),
    title: formData.get("title"),
    artist: formData.get("artist"),
    startTimeSeconds: formData.get("startTimeSeconds"),
    previewDurationSeconds: formData.get("previewDurationSeconds"),
    isActive: formData.get("isActive") ?? undefined,
  });
  if (!parsed.success) {
    return validationState(
      "Revise os dados da música e do trecho.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    await attachResolvedTrack(themeId, parsed.data);
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/temas");
  revalidatePath(`/admin/temas/${themeId}`);
  redirect(`/admin/temas/${themeId}?message=Música adicionada`);
}

export async function updateThemeSongAction(
  themeId: string,
  songId: string,
  formData: FormData,
) {
  await requireAdmin();
  const parsed = themeSongInputSchema.safeParse({
    title: formData.get("title"),
    artist: formData.get("artist"),
    startTimeSeconds: formData.get("startTimeSeconds"),
    previewDurationSeconds: formData.get("previewDurationSeconds"),
    displayOrder: formData.get("displayOrder"),
    isActive: formData.get("isActive") ?? undefined,
  });

  if (!parsed.success) {
    redirect(
      `/admin/temas/${themeId}?error=${encodeURIComponent("Revise os dados da música e do trecho.")}`,
    );
  }

  try {
    await updateThemeSong(themeId, songId, parsed.data);
  } catch (error) {
    redirect(
      `/admin/temas/${themeId}?error=${encodeURIComponent(toAppError(error).message)}`,
    );
  }

  revalidatePath("/admin/temas");
  revalidatePath(`/admin/temas/${themeId}`);
  redirect(`/admin/temas/${themeId}?message=Música atualizada`);
}

export async function removeThemeSongAction(themeId: string, songId: string) {
  await requireAdmin();

  try {
    await removeThemeSong(themeId, songId);
  } catch (error) {
    redirect(
      `/admin/temas/${themeId}?error=${encodeURIComponent(toAppError(error).message)}`,
    );
  }

  revalidatePath("/admin/temas");
  revalidatePath(`/admin/temas/${themeId}`);
  redirect(`/admin/temas/${themeId}?message=Música removida`);
}

export async function revalidateSourceAvailabilityAction(
  themeId: string,
  songId: string,
) {
  await requireAdmin();

  try {
    await revalidateSourceAvailability(themeId, songId);
  } catch (error) {
    redirect(
      `/admin/temas/${themeId}?error=${encodeURIComponent(toAppError(error).message)}`,
    );
  }

  revalidatePath(`/admin/temas/${themeId}`);
  redirect(`/admin/temas/${themeId}?message=Disponibilidade revalidada`);
}
