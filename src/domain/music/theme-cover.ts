import { AppError } from "@/lib/errors";

export const themeCoverBucket = "theme-covers";
export const themeCoverMaxBytes = 5 * 1024 * 1024;

export type ManagedThemeCoverReference = {
  bucket: typeof themeCoverBucket;
  objectKey: string;
};

export type ManagedThemeCoverUpload = {
  reference: ManagedThemeCoverReference;
  publicUrl: string;
};

export type ManagedThemeCoverMetadata = {
  contentType: string | null;
  size: number | null;
};

const extensionByContentType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function invalidManagedReference(message: string): never {
  throw new AppError("INVALID_THEME_COVER_REFERENCE", message, 400, {
    coverFile: [message],
  });
}

export function parseManagedThemeCoverReference(
  value: FormDataEntryValue,
  userId: string,
): ManagedThemeCoverReference {
  if (typeof value !== "string") {
    return invalidManagedReference("A referência da capa é inválida.");
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(value);
  } catch {
    return invalidManagedReference("A referência da capa é inválida.");
  }

  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("bucket" in candidate) ||
    candidate.bucket !== themeCoverBucket ||
    !("objectKey" in candidate) ||
    typeof candidate.objectKey !== "string"
  ) {
    return invalidManagedReference("A referência da capa é inválida.");
  }

  const [prefix, fileName, extraSegment] = candidate.objectKey.split("/");
  const managedFilePattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

  if (
    prefix !== userId ||
    !fileName ||
    extraSegment !== undefined ||
    !managedFilePattern.test(fileName)
  ) {
    return invalidManagedReference(
      "A referência da capa não pertence à sua sessão.",
    );
  }

  return {
    bucket: themeCoverBucket,
    objectKey: candidate.objectKey,
  };
}

export function validateManagedThemeCoverMetadata(
  reference: ManagedThemeCoverReference,
  metadata: ManagedThemeCoverMetadata,
) {
  const extension = reference.objectKey.slice(
    reference.objectKey.lastIndexOf(".") + 1,
  );
  const expectedExtension =
    metadata.contentType && metadata.contentType in extensionByContentType
      ? extensionByContentType[
          metadata.contentType as keyof typeof extensionByContentType
        ]
      : null;

  if (!expectedExtension || expectedExtension !== extension) {
    throw new AppError(
      "INVALID_THEME_COVER_METADATA",
      "O tipo da capa enviada não é permitido.",
      400,
      { coverFile: ["Envie uma imagem JPEG, PNG ou WebP válida."] },
    );
  }

  if (
    metadata.size === null ||
    !Number.isSafeInteger(metadata.size) ||
    metadata.size <= 0 ||
    metadata.size > themeCoverMaxBytes
  ) {
    throw new AppError(
      "INVALID_THEME_COVER_METADATA",
      "O tamanho da capa enviada não é permitido.",
      400,
      { coverFile: ["Envie uma imagem de até 5 MB."] },
    );
  }
}

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
