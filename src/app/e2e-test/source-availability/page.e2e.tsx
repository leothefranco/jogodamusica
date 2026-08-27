import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { SourceAvailabilityStatus } from "@/components/admin/source-availability-status";
import { Button } from "@/components/ui/button";
import {
  applySourceAvailabilityResult,
  deriveEffectiveSourceAvailability,
} from "@/domain/music/source-availability";

const observedAt = new Date("2026-01-01T00:00:00.000Z");
const track = {
  providerContentId: "dQw4w9WgXcQ",
  sourceTitle: "Fonte E2E",
  sourceChannel: "Canal E2E",
  thumbnailUrl: "https://example.com/thumb.jpg",
  durationSeconds: 180,
  isEmbeddable: true,
  isRegionAllowed: true,
};
const persistedObservation = applySourceAvailabilityResult({
  current: null,
  observedAt,
  result: { type: "available", reason: "available", track },
});

async function revalidateFixture() {
  "use server";
  redirect("/e2e-test/source-availability?revalidated=1");
}

export default async function SourceAvailabilityFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ revalidated?: string }>;
}) {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-e2e-test") !== "source-availability") notFound();
  const { revalidated } = await searchParams;
  const observation = revalidated === "1" ? persistedObservation : null;
  const availability = deriveEffectiveSourceAvailability(
    observation,
    observedAt,
  );

  return (
    <main className="min-h-screen bg-[#08080f] px-5 py-10 text-white">
      <section className="mx-auto max-w-3xl rounded-2xl border border-white/8 bg-[#0d0d18] p-6">
        <h1 className="text-2xl font-black">Editor de Fonte E2E</h1>
        <p className="mt-2 text-sm text-white/45">
          Estado regional persistido e derivado sem consulta externa no GET.
        </p>

        <SourceAvailabilityStatus
          availability={availability}
          observation={observation}
        />

        <form action={revalidateFixture} className="mt-5">
          <Button type="submit" size="lg">
            Revalidar Fonte
          </Button>
        </form>
      </section>
    </main>
  );
}
