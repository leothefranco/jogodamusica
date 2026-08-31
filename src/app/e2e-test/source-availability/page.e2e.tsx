import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { SourceAvailabilityStatus } from "@/components/admin/source-availability-status";
import { Button } from "@/components/ui/button";
import { deriveEffectiveSourceAvailability } from "@/domain/music/source-availability";
import {
  createSourceAvailabilityFixtureService,
  readSourceAvailabilityFixture,
} from "@/app/e2e-test/source-availability/source-availability-fixture-store.e2e";

const fixtureIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateFixtureId(value: string | undefined) {
  if (!value || !fixtureIdPattern.test(value)) notFound();
  return value;
}

async function revalidateFixture(fixtureId: string) {
  "use server";
  const requestHeaders = await headers();
  if (requestHeaders.get("x-e2e-test") !== "source-availability") notFound();
  const validatedFixtureId = validateFixtureId(fixtureId);

  await createSourceAvailabilityFixtureService(validatedFixtureId).observe();

  redirect(
    `/e2e-test/source-availability?fixture=${validatedFixtureId}&revalidated=1`,
  );
}

export default async function SourceAvailabilityFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-e2e-test") !== "source-availability") notFound();
  const { fixture } = await searchParams;
  const fixtureId = validateFixtureId(fixture);
  const fixtureState = readSourceAvailabilityFixture(fixtureId);
  const observation = fixtureState.source?.observation ?? null;
  const availability = deriveEffectiveSourceAvailability(
    observation,
    fixtureState.now,
  );
  const revalidateFixtureWithId = revalidateFixture.bind(null, fixtureId);

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

        <p className="mt-4 text-xs text-white/45">
          Chamadas ao provider:{" "}
          <span data-testid="provider-call-count">
            {fixtureState.providerCallCount}
          </span>
        </p>
        <p className="mt-1 text-xs text-white/45">
          Fluxo:{" "}
          <span data-testid="fixture-flow">
            {fixtureState.flow.join(" → ") || "nenhum"}
          </span>
        </p>

        <form action={revalidateFixtureWithId} className="mt-5">
          <Button type="submit" size="lg">
            Revalidar Fonte
          </Button>
        </form>
      </section>
    </main>
  );
}
