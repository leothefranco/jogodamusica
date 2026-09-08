import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="grid min-h-screen place-items-center bg-[var(--app-bg)] px-5 text-white"
    >
      <div role="status" className="text-center">
        <LoaderCircle
          className="mx-auto size-9 animate-spin text-[var(--duel-a)]"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm text-[var(--app-muted)]">Carregando...</p>
      </div>
    </main>
  );
}
