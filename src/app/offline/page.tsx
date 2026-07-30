import { WifiOff } from "lucide-react";
import Link from "next/link";

import { FullPageState } from "@/components/full-page-state";

export const metadata = {
  title: "Sem conexão",
};

export default function OfflinePage() {
  return (
    <FullPageState
      icon={
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-300/10 text-violet-200">
          <WifiOff aria-hidden="true" />
        </span>
      }
      title="Você está sem conexão"
      description="O catálogo, o estado da partida e os vídeos do YouTube precisam de internet. Reconecte-se para continuar com segurança."
    >
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-300 px-5 font-bold text-[#160d25] outline-none hover:bg-violet-200 focus-visible:ring-2 focus-visible:ring-white"
      >
        Tentar novamente
      </Link>
    </FullPageState>
  );
}
