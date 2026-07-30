"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { FullPageState } from "@/components/full-page-state";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset(): void;
}) {
  useEffect(() => {
    console.error("Falha ao renderizar a página", error);
  }, [error]);

  return (
    <FullPageState
      icon={null}
      eyebrow="Algo saiu do ritmo"
      eyebrowTone="danger"
      title="Não foi possível continuar"
      description="Verifique sua conexão e tente novamente. Nenhum voto é registrado automaticamente quando ocorre uma falha."
    >
      <Button
        type="button"
        size="lg"
        onClick={reset}
        className="min-h-12 rounded-xl"
      >
        <RotateCcw aria-hidden="true" />
        Tentar novamente
      </Button>
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 font-semibold outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        Voltar ao início
      </Link>
    </FullPageState>
  );
}
