"use client";

import {
  themeCoverBucket,
  validateThemeCover,
  type ManagedThemeCoverUpload,
} from "@/domain/music/theme-cover";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

export { themeCoverBucket } from "@/domain/music/theme-cover";

type ThemeCoverUploadClient = {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  storage: {
    from(bucket: string): {
      getPublicUrl(path: string): { data: { publicUrl: string } };
      upload(
        path: string,
        file: File,
        options: {
          cacheControl: string;
          contentType: string;
          upsert: false;
        },
      ): Promise<{ error: unknown }>;
    };
  };
};

type ThemeCoverUploaderDependencies = {
  createClient(): ThemeCoverUploadClient;
  randomUUID(): string;
};

export function createThemeCoverUploader({
  createClient,
  randomUUID,
}: ThemeCoverUploaderDependencies) {
  return async function uploadThemeCover(
    file: File,
  ): Promise<ManagedThemeCoverUpload> {
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

    const objectPath = `${user.id}/${randomUUID()}.${extension}`;
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

    const publicUrl = supabase.storage
      .from(themeCoverBucket)
      .getPublicUrl(objectPath).data.publicUrl;

    return {
      reference: { bucket: themeCoverBucket, objectKey: objectPath },
      publicUrl,
    };
  };
}

export const uploadThemeCover = createThemeCoverUploader({
  createClient: () => createClient() as ThemeCoverUploadClient,
  randomUUID: () => crypto.randomUUID(),
});
