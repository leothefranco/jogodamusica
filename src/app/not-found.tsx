import { SearchX } from "lucide-react";
import Link from "next/link";

import { FullPageState } from "@/components/full-page-state";

export default function NotFound() {
  return (
    <FullPageState
      icon={
        <SearchX
          className="mx-auto size-12 text-violet-300"
          aria-hidden="true"
        />
      }
      eyebrow="Página não encontrada"
      title="Esta faixa saiu do catálogo"
      description="O endereço pode estar incorreto ou o conteúdo não está mais disponível."
    >
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-300 px-5 font-bold text-[#160d25] outline-none hover:bg-violet-200 focus-visible:ring-2 focus-visible:ring-white"
      >
        Voltar ao início
      </Link>
    </FullPageState>
  );
}
