import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  readThemeStateFixture,
  runThemeStateFixture,
} from "@/app/e2e-test/theme-state/theme-state-fixture.e2e";
import { ThemeStateStatus } from "@/components/admin/theme-state-status";
import { SupportedGameModes } from "@/components/admin/supported-game-modes";
import { Button } from "@/components/ui/button";
import { toAppError } from "@/lib/errors";

const commandSchema = z.enum([
  "publish",
  "draft",
  "confirm",
  "grace",
  "expire",
  "recover",
  "unavailable",
  "remove",
  "catalog32",
  "catalog64",
  "catalog128",
]);
async function authorizeFixture(id: unknown) {
  if (
    process.env.E2E_TEST_MODE !== "1" ||
    (await headers()).get("x-e2e-test") !== "theme-state"
  )
    notFound();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) notFound();
  return parsed.data;
}
async function fixtureAction(id: string, command: string) {
  "use server";
  const fixture = await authorizeFixture(id);
  const parsed = commandSchema.safeParse(command);
  if (!parsed.success) notFound();
  let error = "";
  try {
    await runThemeStateFixture(fixture, parsed.data);
  } catch (caught) {
    error = toAppError(caught).message;
  }
  redirect(
    `/e2e-test/theme-state?fixture=${fixture}${error ? `&error=${encodeURIComponent(error)}` : ""}`,
  );
}

export default async function ThemeStateFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string; error?: string }>;
}) {
  const query = await searchParams;
  const fixture = await authorizeFixture(query.fixture);
  const { editor, providerCalls, lastEventCause } =
    await readThemeStateFixture(fixture);
  const commands = [
    ["publish", "Publicar tema"],
    ["draft", "Voltar a rascunho"],
    ["confirm", "Confirmar quarta Entrada"],
    ["grace", "Avançar para tolerância"],
    ["expire", "Expirar confirmação"],
    ["recover", "Confirmar recuperação"],
    ["unavailable", "Confirmar indisponibilidade"],
    ["remove", "Retirar última Entrada"],
    ["catalog32", "Preparar 32 Entradas"],
    ["catalog64", "Preparar 64 Entradas"],
    ["catalog128", "Preparar 128 Entradas"],
  ] as const;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <h1 className="text-3xl font-bold">Editor de Tema E2E</h1>
      {query.error ? <p role="alert">{query.error}</p> : null}
      <ThemeStateStatus state={editor.state} />
      <SupportedGameModes modes={editor.state.modes} />
      <div className="flex flex-wrap gap-3">
        {commands.map(([command, label]) => (
          <form
            key={command}
            action={fixtureAction.bind(null, fixture, command)}
          >
            <Button type="submit" variant="outline">
              {label}
            </Button>
          </form>
        ))}
      </div>
      <p>
        Chamadas ao provider:{" "}
        <span data-testid="provider-call-count">{providerCalls}</span>
      </p>
      <p>
        Última causa:{" "}
        <span data-testid="last-event-cause">{lastEventCause}</span>
      </p>
    </main>
  );
}
