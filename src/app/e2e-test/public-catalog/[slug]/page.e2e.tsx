import Link from "next/link";
import { notFound } from "next/navigation";

import {
  findCatalogTheme,
  requirePublicCatalogFixture,
} from "@/app/e2e-test/public-catalog/catalog-fixture.e2e";
import { StartGameForm } from "@/components/game/start-game-form";

export default async function PublicCatalogThemeFixturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requirePublicCatalogFixture();
  const theme = await findCatalogTheme((await params).slug);
  if (!theme) notFound();

  return (
    <main>
      <Link href="/e2e-test/public-catalog">Voltar aos temas</Link>
      <h1>{theme.name}</h1>
      <p>{theme.activeSongCount} músicas disponíveis</p>
      <StartGameForm
        themeId={theme.id}
        activeSongCount={theme.activeSongCount}
        supportedBracketSizes={theme.supportedBracketSizes}
      />
    </main>
  );
}
