"use client";

import { useRef, useState } from "react";

import {
  initialContentActionState,
  type ContentActionState,
} from "@/components/admin/content-action-state";
import { ThemeForm } from "@/components/admin/theme-form";

export function ThemeFormFixture({
  uploadFails = false,
}: {
  uploadFails?: boolean;
}) {
  const [uploadCount, setUploadCount] = useState(0);
  const [actionCount, setActionCount] = useState(0);
  const [workflowCount, setWorkflowCount] = useState(0);
  const [repositoryCount, setRepositoryCount] = useState(0);
  const [created, setCreated] = useState(false);
  const actionCountRef = useRef(0);

  async function uploadCover() {
    setUploadCount((count) => count + 1);
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (uploadFails) throw new Error("Falha real no upload.");
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
      await Promise.reject(
        new DOMException("Conexão interrompida.", "AbortError"),
      );
    }

    setWorkflowCount((count) => count + 1);
    setRepositoryCount((count) => count + 1);
    window.history.pushState({}, "", "/e2e-test/theme-form?created=1");
    setCreated(true);
    return initialContentActionState;
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <span data-testid="upload-count">{uploadCount}</span>
      <span data-testid="action-count">{actionCount}</span>
      <span data-testid="workflow-count">{workflowCount}</span>
      <span data-testid="repository-count">{repositoryCount}</span>
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
