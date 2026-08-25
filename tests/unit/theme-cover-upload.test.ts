import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import {
  themeCoverBucket,
  uploadThemeCover,
} from "@/lib/supabase/theme-cover-upload";

const mockedCreateClient = vi.mocked(createClient);

describe("upload da capa do tema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envia a imagem para a pasta do usuário autenticado", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: {
        publicUrl:
          "https://project.supabase.co/storage/v1/object/public/theme-covers/admin/capa.jpg",
      },
    });
    const from = vi.fn().mockReturnValue({ upload, getPublicUrl });
    mockedCreateClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "10000000-0000-4000-8000-000000000001" } },
          error: null,
        }),
      },
      storage: { from },
    } as never);

    const file = new File(
      [Uint8Array.from([0xff, 0xd8, 0xff, 0xdb])],
      "capa.jpg",
      {
        type: "image/jpeg",
      },
    );

    await expect(uploadThemeCover(file)).resolves.toContain("theme-covers");
    expect(from).toHaveBeenCalledWith(themeCoverBucket);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(
        /^10000000-0000-4000-8000-000000000001\/[0-9a-f-]+\.jpg$/,
      ),
      file,
      {
        cacheControl: "31536000",
        contentType: "image/jpeg",
        upsert: false,
      },
    );
  });
});
