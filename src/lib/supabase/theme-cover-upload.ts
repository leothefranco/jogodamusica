"use client";

import { validateThemeCover } from "@/domain/music/theme-cover";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

export const themeCoverBucket = "theme-covers";

export async function uploadThemeCover(file: File) {
  const { contentType, extension } = await validateThemeCover(file);
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AppError(
      "ADMIN_SESSION_REQUIRED",
      "Sua sessão expirou. Entre novamente para enviar a capa.",
      401,
    );
  }

  const objectPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(themeCoverBucket)
    .upload(objectPath, file, {
      cacheControl: "31536000",
      contentType,
      upsert: false,
    });

  if (error) {
    throw new AppError(
      "THEME_COVER_UPLOAD_FAILED",
      "Não foi possível enviar a imagem de capa.",
      502,
      { coverFile: ["Tente enviar a imagem novamente."] },
    );
  }

  return supabase.storage.from(themeCoverBucket).getPublicUrl(objectPath).data
    .publicUrl;
}
