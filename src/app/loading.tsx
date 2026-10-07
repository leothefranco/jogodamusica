import { BrandMark } from "@/components/brand-mark";
import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="grid min-h-screen place-items-center bg-[var(--app-bg)] px-5 text-white"
    >
      <div role="status" className="text-center">
        <div className="mb-6 flex justify-center">
          <BrandMark size={48} />
        </div>
        <LoaderCircle
          className="mx-auto size-9 animate-spin text-[#D4FF46] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm text-[var(--app-muted)]">Carregando...</p>
      </div>
    </main>
  );
}
