import { AppError } from "@/lib/errors";

export const themeCoverMaxBytes = 5 * 1024 * 1024;

const supportedSignatures = [
  {
    contentType: "image/jpeg",
    extension: "jpg",
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    contentType: "image/png",
    extension: "png",
    matches: (bytes: Uint8Array) =>
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (byte, index) => bytes[index] === byte,
      ),
  },
  {
    contentType: "image/webp",
    extension: "webp",
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
  },
] as const;

export async function validateThemeCover(file: File): Promise<{
  contentType: (typeof supportedSignatures)[number]["contentType"];
  extension: (typeof supportedSignatures)[number]["extension"];
}> {
  if (file.size > themeCoverMaxBytes) {
    throw new AppError(
      "THEME_COVER_TOO_LARGE",
      "A imagem de capa deve ter no máximo 5 MB.",
      400,
      { coverFile: ["Escolha uma imagem de até 5 MB."] },
    );
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const signature = supportedSignatures.find(
    ({ contentType, matches }) => contentType === file.type && matches(bytes),
  );

  if (!signature) {
    throw new AppError(
      "INVALID_THEME_COVER",
      "A capa precisa ser uma imagem JPEG, PNG ou WebP válida.",
      400,
      { coverFile: ["Envie uma imagem JPEG, PNG ou WebP válida."] },
    );
  }

  return {
    contentType: signature.contentType,
    extension: signature.extension,
  };
}
