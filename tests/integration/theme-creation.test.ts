import { expect, test, vi } from "vitest";

import { applyThemeCoverUploadToFormData } from "@/components/admin/theme-form";
import { createThemeActionAdapter } from "@/server/actions/create-theme-action";
import { createThemeCreationWorkflow } from "@/server/services/create-theme-workflow";
import { createPublicThemeService } from "@/server/services/public-theme-service";
import { createThemeEditorService } from "@/server/services/theme-content-service";
import { createThemeCoverUploader } from "@/lib/supabase/theme-cover-upload";

const admin = {
  userId: "10000000-0000-4000-8000-000000000001",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin" as const,
};
const objectKey = `${admin.userId}/30000000-0000-4000-8000-000000000003.jpg`;
const canonicalCoverUrl = `https://project.supabase.co/storage/v1/object/public/theme-covers/${objectKey}`;

test("formulário, upload, action, workflow e leitura pública compartilham a mesma capa", async () => {
  const uploadObject = vi.fn().mockResolvedValue({ error: null });
  const uploader = createThemeCoverUploader({
    createClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: admin.userId } },
          error: null,
        }),
      },
      storage: {
        from: () => ({
          upload: uploadObject,
          getPublicUrl: () => ({ data: { publicUrl: canonicalCoverUrl } }),
        }),
      },
    }),
    randomUUID: () => "30000000-0000-4000-8000-000000000003",
  });
  const file = new File(
    [Uint8Array.from([0xff, 0xd8, 0xff, 0xdb])],
    "capa.jpg",
    { type: "image/jpeg" },
  );
  const upload = await uploader(file);
  const formData = new FormData();
  formData.set("name", "Clássicos");
  formData.set("slug", "classicos");
  formData.set("description", "Uma seleção clássica.");
  applyThemeCoverUploadToFormData("create", formData, upload);

  let storedTheme:
    | {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        coverUrl: string | null;
        isActive: boolean;
      }
    | undefined;
  const repository = {
    findBySlug: async () => storedTheme ?? null,
    insert: async (values: {
      name: string;
      slug: string;
      description: string | null;
      coverUrl: string | null;
      isActive: false;
    }) => {
      storedTheme = {
        id: "20000000-0000-4000-8000-000000000002",
        ...values,
      };
      return storedTheme.id;
    },
    isCoverUrlReferenced: async () => Boolean(storedTheme?.coverUrl),
  };
  const workflow = createThemeCreationWorkflow({
    repository,
    storage: {
      inspect: async (reference) => {
        expect(reference.objectKey).toBe(objectKey);
        return {
          contentType: "image/jpeg",
          size: file.size,
          signatureBytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]),
        };
      },
      getPublicUrl: async (reference) => {
        expect(reference.objectKey).toBe(objectKey);
        return canonicalCoverUrl;
      },
      remove: async () => "removed",
    },
    withCoverOperationLock: async (_coverUrl, operation) => operation(),
    withCoverUrlLock: async (_coverUrl, operation) => operation(repository),
  });
  const action = createThemeActionAdapter({
    authenticate: async () => admin,
    createTheme: workflow,
  });

  await expect(action(formData)).resolves.toEqual({
    idempotent: false,
    themeId: "20000000-0000-4000-8000-000000000002",
  });
  expect(uploadObject).toHaveBeenCalledWith(objectKey, file, {
    cacheControl: "31536000",
    contentType: "image/jpeg",
    upsert: false,
  });
  expect(storedTheme?.coverUrl).toBe(canonicalCoverUrl);

  const playableTheme = {
    id: storedTheme!.id,
    name: storedTheme!.name,
    slug: storedTheme!.slug,
    description: storedTheme!.description,
    coverUrl: storedTheme!.coverUrl,
    thumbnailUrls: [],
    activeSongCount: 4,
  };
  const publicThemes = createPublicThemeService({
    listPlayableThemes: async () => [playableTheme],
    findPlayableThemeBySlug: async () => playableTheme,
  });
  await expect(publicThemes.listThemes()).resolves.toEqual([
    expect.objectContaining({ coverUrl: canonicalCoverUrl }),
  ]);
  await expect(publicThemes.getTheme("classicos")).resolves.toEqual(
    expect.objectContaining({ coverUrl: canonicalCoverUrl }),
  );

  const getThemeEditor = createThemeEditorService({
    findThemeSummary: async () => ({
      ...storedTheme!,
      activeSongCount: 0,
      totalSongCount: 0,
      updatedAt: new Date("2026-08-25T00:00:00Z"),
    }),
    getEmbedData: async () => {
      throw new Error("não deveria resolver música sem associação");
    },
    listThemeSongs: async () => [],
  });
  await expect(
    getThemeEditor("20000000-0000-4000-8000-000000000002"),
  ).resolves.toEqual(
    expect.objectContaining({
      theme: expect.objectContaining({ coverUrl: canonicalCoverUrl }),
    }),
  );
});
