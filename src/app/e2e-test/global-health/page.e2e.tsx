import Link from "next/link";
import { redirect } from "next/navigation";
import {
  assertOwnHttpFixture,
  changeHttpSource,
  httpFixtureState,
} from "@/app/e2e-test/global-health/fixture.e2e";

async function changeSource(available: boolean) {
  "use server";
  await assertOwnHttpFixture();
  await changeHttpSource(available);
  redirect("/e2e-test/global-health");
}

export default async function GlobalHealthFixturePage() {
  const state = await httpFixtureState();
  return (
    <main>
      <h1>Saúde global — QA local</h1>
      <nav aria-label="Destinos da verificação">
        <Link href="/">Catálogo</Link>
        <Link href="/tema/cat08-0">Tema 0</Link>
        <Link href="/tema/cat08-1">Tema 1</Link>
      </nav>
      {state.themes.map((theme, index) => (
        <p key={theme.id} data-testid={`theme-state-${index}`}>
          {theme.editorialState} {theme.visibility} {theme.operationalState}{" "}
          {theme.counts.playableCount}
        </p>
      ))}
      {state.projections.map((projection) => (
        <p
          key={projection.id}
          data-testid={`projection-state-${state.themes.findIndex((theme) => theme.id === projection.id)}`}
        >
          {projection.editorial} {projection.visibility}{" "}
          {projection.operational} {projection.playable}
        </p>
      ))}
      <p data-testid="provider-count">{state.providerCalls}</p>
      <p data-testid="outbox-total">{state.delivery.total}</p>
      <p data-testid="outbox-pending">{state.delivery.pending}</p>
      <form action={changeSource.bind(null, false)}>
        <button type="submit">Indisponibilizar Fonte</button>
      </form>
      <form action={changeSource.bind(null, true)}>
        <button type="submit">Recuperar Fonte</button>
      </form>
    </main>
  );
}
