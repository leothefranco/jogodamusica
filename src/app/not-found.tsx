import { SearchX } from "lucide-react";
import Link from "next/link";

import { FullPageState } from "@/components/full-page-state";

export default function NotFound() {
  return (
    <FullPageState
      icon={
        <SearchX
          className="mx-auto size-12 text-[var(--duel-a)]"
          aria-hidden="true"
        />
      }
      eyebrow="Página não encontrada"
      title="Não encontramos esta página"
      description="O endereço pode estar incorreto ou o conteúdo não está mais disponível."
    >
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--duel-a)] px-5 font-bold text-[var(--app-bg)] outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white"
      >
        Voltar ao início
      </Link>
    </FullPageState>
  );
}
