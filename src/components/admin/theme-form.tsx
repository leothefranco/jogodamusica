"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";

import {
  initialContentActionState,
  type ContentActionState,
} from "@/components/admin/content-action-state";
import { adminInputClassName } from "@/components/admin/form-styles";
import { Button } from "@/components/ui/button";
import { toAppError } from "@/lib/errors";
import { uploadThemeCover } from "@/lib/supabase/theme-cover-upload";

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
  submitLabel: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ThemeForm({ action, defaults, submitLabel }: ThemeFormProps) {
  async function uploadCoverBeforeSubmit(
    previousState: ContentActionState,
    formData: FormData,
  ) {
    const coverFile = formData.get("coverFile");

    try {
      if (coverFile instanceof File && coverFile.size > 0) {
        formData.set("coverUrl", await uploadThemeCover(coverFile));
        formData.delete("removeCover");
      }
      formData.delete("coverFile");
    } catch (error) {
      const appError = toAppError(error);
      return {
        status: "error" as const,
        message: appError.message,
        fieldErrors: appError.fieldErrors,
      };
    }

    return action(previousState, formData);
  }

  const [state, formAction, pending] = useActionState(
    uploadCoverBeforeSubmit,
    initialContentActionState,
  );
  const [name, setName] = useState(defaults?.name ?? "");
  const [slug, setSlug] = useState(defaults?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(defaults?.slug));

  return (
    <form action={formAction} className="space-y-6">
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
        <input name="coverUrl" type="hidden" value={defaults?.coverUrl ?? ""} />
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
          accept="image/jpeg,image/png,image/webp"
          className={`${adminInputClassName} file:mr-4 file:rounded-lg file:border-0 file:bg-violet-300 file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#130d22]`}
          aria-invalid={Boolean(state.fieldErrors?.coverFile)}
        />
        <span className="text-xs leading-5 font-normal text-white/38">
          JPEG, PNG ou WebP, com até 5 MB. A imagem enviada substitui os cards
          de miniaturas.
        </span>
        <FieldError errors={state.fieldErrors?.coverFile} />
        {defaults?.coverUrl ? (
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/8 bg-black/15 px-4 text-sm font-semibold">
            <input
              type="checkbox"
              name="removeCover"
              className="size-4 accent-violet-400"
            />
            Remover a capa atual e voltar aos cards
          </label>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="min-h-11 rounded-xl px-5"
      >
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Save aria-hidden="true" />
        )}
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.[0]) return null;
  return <span className="text-xs font-medium text-red-200">{errors[0]}</span>;
}
