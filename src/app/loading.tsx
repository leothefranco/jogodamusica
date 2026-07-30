import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="grid min-h-screen place-items-center bg-[#08080f] px-5 text-white"
    >
      <div role="status" className="text-center">
        <LoaderCircle
          className="mx-auto size-9 animate-spin text-violet-300"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm text-white/60">Carregando...</p>
      </div>
    </main>
  );
}
