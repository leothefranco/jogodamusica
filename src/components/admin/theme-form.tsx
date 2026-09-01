"use client";

import { useActionState, useRef, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { unstable_rethrow } from "next/navigation";

import {
  initialContentActionState,
  type ContentActionState,
} from "@/components/admin/content-action-state";
import { adminInputClassName } from "@/components/admin/form-styles";
import { Button } from "@/components/ui/button";
import { toAppError } from "@/lib/errors";
import { uploadThemeCover } from "@/lib/supabase/theme-cover-upload";
import type { ManagedThemeCoverUpload } from "@/domain/music/theme-cover";

type ThemeFormValues = {
  name: string;
  slug: string;
  description: string;
  coverUrl: string;
};

type ThemeFormProps = {
  action: (
    state: ContentActionState,
    formData: FormData,
  ) => Promise<ContentActionState>;
  defaults?: ThemeFormValues;
  mode: "create" | "edit";
  submitLabel: string;
  uploadCover?: (file: File) => Promise<ManagedThemeCoverUpload>;
};

type CachedThemeCoverUpload = {
  file: File;
  upload: ManagedThemeCoverUpload;
};

export async function submitThemeForm({
  action,
  cachedUpload,
  formData,
  mode,
  previousState,
  selectedFile,
  uploadCover,
}: {
  action: ThemeFormProps["action"];
  cachedUpload: CachedThemeCoverUpload | null;
  formData: FormData;
  mode: ThemeFormProps["mode"];
  previousState: ContentActionState;
  selectedFile: File | null;
  uploadCover: NonNullable<ThemeFormProps["uploadCover"]>;
}): Promise<{
  state: ContentActionState;
  cachedUpload: CachedThemeCoverUpload | null;
}> {
  const coverFile = formData.get("coverFile");
  let nextCachedUpload = cachedUpload;

  try {
    if (coverFile instanceof File && coverFile.size > 0) {
      const file = selectedFile ?? coverFile;
      const upload =
        cachedUpload?.file === file
          ? cachedUpload.upload
          : await uploadCover(file);
      nextCachedUpload = { file, upload };
      applyThemeCoverUploadToFormData(mode, formData, upload);
    } else if (mode === "create") {
      formData.delete("coverReference");
    }
    formData.delete("coverFile");
  } catch (error) {
    const appError = toAppError(error);
    return {
      state: {
        status: "error",
        message: appError.message,
        fieldErrors: appError.fieldErrors,
      },
      cachedUpload: nextCachedUpload,
    };
  }

  try {
    const state = await action(previousState, formData);
    if (
      state.coverReferenceStatus === "removed" ||
      state.coverReferenceStatus === "already-absent" ||
      state.coverReferenceStatus === "rejected" ||
      state.coverReferenceStatus === "preserved-in-use"
    ) {
      nextCachedUpload = null;
    }
    return { state, cachedUpload: nextCachedUpload };
  } catch (error) {
    unstable_rethrow(error);
    return {
      state: {
        status: "error",
        message: "Falha recuperável de transporte. Tente novamente.",
        fieldErrors: null,
        coverReferenceStatus:
          mode === "create" && nextCachedUpload ? "reusable" : undefined,
      },
      cachedUpload: nextCachedUpload,
    };
  }
}

export function applyThemeCoverUploadToFormData(
  mode: ThemeFormProps["mode"],
  formData: FormData,
  upload: ManagedThemeCoverUpload,
) {
  if (mode === "create") {
    formData.set("coverReference", JSON.stringify(upload.reference));
    formData.delete("coverUrl");
  } else {
    formData.set("coverUrl", upload.publicUrl);
    formData.delete("coverReference");
  }
  formData.delete("removeCover");
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ThemeForm({
  action,
  defaults,
  mode,
  submitLabel,
  uploadCover = uploadThemeCover,
}: ThemeFormProps) {
  const cachedUpload = useRef<CachedThemeCoverUpload | null>(null);
  const selectedCoverFile = useRef<File | null>(null);
  const submissionLocked = useRef(false);
  const [submissionInFlight, setSubmissionInFlight] = useState(false);

  async function uploadCoverBeforeSubmit(
    previousState: ContentActionState,
    formData: FormData,
  ) {
    try {
      const result = await submitThemeForm({
        action,
        cachedUpload: cachedUpload.current,
        formData,
        mode,
        previousState,
        selectedFile: selectedCoverFile.current,
        uploadCover,
      });
      cachedUpload.current = result.cachedUpload;
      return result.state;
    } finally {
      submissionLocked.current = false;
      setSubmissionInFlight(false);
    }
  }

  const [state, formAction, pending] = useActionState(
    uploadCoverBeforeSubmit,
    initialContentActionState,
  );
  const [name, setName] = useState(defaults?.name ?? "");
  const [slug, setSlug] = useState(defaults?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(defaults?.slug));
  const submissionPending = pending || submissionInFlight;

  return (
    <form
      action={formAction}
      aria-busy={submissionPending}
      className="space-y-6"
      onSubmit={(event) => {
        if (submissionLocked.current) {
          event.preventDefault();
          return;
        }
        submissionLocked.current = true;
        setSubmissionInFlight(true);
      }}
    >
      {state.message ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300/20 bg-red-400/8 px-4 py-3 text-sm text-red-100"
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Nome
          <input
            name="name"
            value={name}
            maxLength={120}
            required
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              if (!slugEdited) setSlug(slugify(nextName));
            }}
            className={adminInputClassName}
            aria-invalid={Boolean(state.fieldErrors?.name)}
          />
          <FieldError errors={state.fieldErrors?.name} />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Slug
          <input
            name="slug"
            value={slug}
            maxLength={140}
            required
            onChange={(event) => {
              setSlug(event.target.value.toLowerCase());
              setSlugEdited(true);
            }}
            className={adminInputClassName}
            aria-invalid={Boolean(state.fieldErrors?.slug)}
          />
          <FieldError errors={state.fieldErrors?.slug} />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold">
        Descrição
        <textarea
          name="description"
          defaultValue={defaults?.description}
          maxLength={2_000}
          rows={4}
          className={`${adminInputClassName} py-3`}
          aria-invalid={Boolean(state.fieldErrors?.description)}
        />
        <FieldError errors={state.fieldErrors?.description} />
      </label>

      <div className="grid gap-3 text-sm font-semibold">
        Imagem de capa
        {mode === "create" ? (
          <input name="coverReference" type="hidden" value="" />
        ) : (
          <input
            name="coverUrl"
            type="hidden"
            value={defaults?.coverUrl ?? ""}
          />
        )}
        {defaults?.coverUrl ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            {/* A URL já foi validada antes de ser persistida. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={defaults.coverUrl}
              alt="Capa atual do tema"
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        ) : null}
        <input
          name="coverFile"
          type="file"
          aria-label="Imagem de capa"
          accept="image/jpeg,image/png,image/webp"
          disabled={submissionPending}
          onChange={(event) => {
            selectedCoverFile.current = event.currentTarget.files?.[0] ?? null;
            cachedUpload.current = null;
          }}
          className={`${adminInputClassName} file:mr-4 file:rounded-lg file:border-0 file:bg-violet-300 file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#130d22]`}
          aria-invalid={Boolean(state.fieldErrors?.coverFile)}
        />
        <span className="text-xs leading-5 font-normal text-white/38">
          JPEG, PNG ou WebP, com até 5 MB. A imagem enviada substitui os cards
          de miniaturas.
        </span>
        <FieldError errors={state.fieldErrors?.coverFile} />
        {mode === "edit" && defaults?.coverUrl ? (
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/8 bg-black/15 px-4 text-sm font-semibold">
            <input
              type="checkbox"
              name="removeCover"
              className="size-4 accent-violet-400"
            />
            Remover a capa atual e voltar aos cards
          </label>
        ) : null}
        {state.coverReferenceStatus === "removed" ||
        state.coverReferenceStatus === "already-absent" ? (
          <span className="text-xs leading-5 font-normal text-amber-200">
            A capa enviada foi removida com segurança. Ela será reenviada ao
            tentar novamente.
          </span>
        ) : null}
        {state.coverReferenceStatus === "cleanup-failed" ? (
          <span className="text-xs leading-5 font-normal text-amber-200">
            A limpeza da capa não pôde ser confirmada. A mesma referência será
            validada novamente na próxima tentativa.
          </span>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={submissionPending}
        className="min-h-11 rounded-xl px-5"
      >
        {submissionPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Save aria-hidden="true" />
        )}
        {submissionPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.[0]) return null;
  return <span className="text-xs font-medium text-red-200">{errors[0]}</span>;
}
