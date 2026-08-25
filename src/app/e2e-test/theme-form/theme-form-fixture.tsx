"use client";

import { useRef, useState } from "react";

import {
  initialContentActionState,
  type ContentActionState,
} from "@/components/admin/content-action-state";
import { ThemeForm } from "@/components/admin/theme-form";

export function ThemeFormFixture() {
  const [uploadCount, setUploadCount] = useState(0);
  const [actionCount, setActionCount] = useState(0);
  const [created, setCreated] = useState(false);
  const actionCountRef = useRef(0);

  async function uploadCover() {
    setUploadCount((count) => count + 1);
    await new Promise((resolve) => setTimeout(resolve, 350));
    return {
      reference: {
        bucket: "theme-covers" as const,
        objectKey:
          "10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000003.jpg",
      },
      publicUrl: "https://project.supabase.co/capa.jpg",
    };
  }

  async function action(): Promise<ContentActionState> {
    actionCountRef.current += 1;
    setActionCount(actionCountRef.current);

    if (actionCountRef.current === 1) {
      return {
        status: "error",
        message: "Falha recuperável de transporte.",
        fieldErrors: null,
        coverReferenceStatus: "reusable",
      };
    }

    window.history.pushState({}, "", "/e2e-test/theme-form?created=1");
    setCreated(true);
    return initialContentActionState;
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <span data-testid="upload-count">{uploadCount}</span>
      <span data-testid="action-count">{actionCount}</span>
      {created ? (
        <p role="status">Tema criado</p>
      ) : (
        <ThemeForm
          action={action}
          mode="create"
          submitLabel="Criar tema"
          uploadCover={uploadCover}
        />
      )}
    </main>
  );
}
