import { notFound } from "next/navigation";
import { StartGameForm } from "@/components/game/start-game-form";
import { catalogFixture } from "../../fixture.e2e";

export default async function CatalogThemeFixture({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const theme = await (await catalogFixture()).getTheme((await params).slug);
  if (!theme) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-3xl">{theme.name}</h1>
      <StartGameForm
        themeId={theme.id}
        activeSongCount={theme.activeSongCount}
        supportedBracketSizes={theme.supportedBracketSizes}
        modeGroups={theme.modeGroups}
      />
    </main>
  );
}
