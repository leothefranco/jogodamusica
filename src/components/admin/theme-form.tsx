"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";

import {
  initialContentActionState,
  type ContentActionState,
} from "@/components/admin/content-action-state";
import { adminInputClassName } from "@/components/admin/form-styles";
import { Button } from "@/components/ui/button";

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
  const [state, formAction, pending] = useActionState(
    action,
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

      <label className="grid gap-2 text-sm font-semibold">
        URL da imagem de capa
        <input
          name="coverUrl"
          type="url"
          defaultValue={defaults?.coverUrl}
          placeholder="https://..."
          className={adminInputClassName}
          aria-invalid={Boolean(state.fieldErrors?.coverUrl)}
        />
        <FieldError errors={state.fieldErrors?.coverUrl} />
      </label>

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
