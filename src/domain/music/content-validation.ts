import { z } from "zod";

import { AppError } from "@/lib/errors";

export const bracketSizes = [4, 8, 16, 32, 64, 128] as const;
export type BracketSize = (typeof bracketSizes)[number];
export const minimumPlayableSongCount = 4;

export const bracketSizeSchema = z.coerce
  .number()
  .refine(
    (value): value is BracketSize =>
      bracketSizes.includes(value as BracketSize),
    "Escolha 4, 8, 16, 32, 64 ou 128 músicas.",
  );

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(maximum).nullable(),
  );

const optionalHttpUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string()
    .trim()
    .url("Informe uma URL válida.")
    .refine(
      (value) => ["http:", "https:"].includes(new URL(value).protocol),
      "A URL precisa usar HTTP ou HTTPS.",
    )
    .nullable(),
);

const checkboxBooleanSchema = z
  .union([z.literal("on"), z.literal("true"), z.boolean()])
  .optional()
  .transform((value) => value === true || value === "on" || value === "true");

export const themeInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(120),
  slug: z
    .string()
    .trim()
    .min(1, "Informe o slug.")
    .max(140)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use apenas letras minúsculas, números e hífens.",
    ),
  description: optionalText(2_000),
  coverUrl: optionalHttpUrl,
});

export const trackAssociationInputSchema = z.object({
  providerContentId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string().trim().min(1, "Informe o título.").max(200),
  artist: z.string().trim().min(1, "Informe o artista.").max(200),
  startTimeSeconds: z.coerce.number().int().min(0),
  previewDurationSeconds: z.coerce
    .number()
    .int()
    .min(1, "Informe uma duração maior que zero."),
  isActive: checkboxBooleanSchema,
});

export const themeSongInputSchema = z.object({
  title: z.string().trim().min(1, "Informe o título.").max(200),
  artist: z.string().trim().min(1, "Informe o artista.").max(200),
  startTimeSeconds: z.coerce.number().int().min(0),
  previewDurationSeconds: z.coerce
    .number()
    .int()
    .min(1, "Informe uma duração maior que zero."),
  displayOrder: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce.number().int().min(0).nullable(),
  ),
  isActive: checkboxBooleanSchema,
});

export function validatePreviewWindow(input: {
  durationSeconds: number;
  startTimeSeconds: number;
  previewDurationSeconds: number;
}) {
  if (
    input.startTimeSeconds + input.previewDurationSeconds >
    input.durationSeconds
  ) {
    throw new AppError(
      "INVALID_PREVIEW_WINDOW",
      "O trecho ultrapassa a duração total do vídeo.",
      400,
      {
        startTimeSeconds: [
          "Ajuste o início ou a duração para caber dentro do vídeo.",
        ],
      },
    );
  }
}

export function getThemePublishability(activeSongCount: number) {
  const missingSongCount = Math.max(
    minimumPlayableSongCount - activeSongCount,
    0,
  );

  return {
    canPublish: missingSongCount === 0,
    missingSongCount,
  };
}

export function getSupportedBracketSizes(
  activeSongCount: number,
): BracketSize[] {
  return bracketSizes.filter((size) => activeSongCount >= size);
}
