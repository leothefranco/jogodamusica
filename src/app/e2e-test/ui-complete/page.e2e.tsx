import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { HomeExperience } from "@/components/home-experience";
import { StartGameForm } from "@/components/game/start-game-form";
import { ThemeThumbnailStack } from "@/components/theme-thumbnail-stack";
import { ResultFixture } from "./result-fixture.e2e";
import { ControlsFixture } from "./controls-fixture";

export default async function UICompleteFixture({
  searchParams,
}: {
  searchParams: Promise<{
    screen?: string;
    count?: string;
    duplicate?: string;
  }>;
}) {
  if (
    process.env.E2E_TEST_MODE !== "1" ||
    (await headers()).get("x-e2e-test") !== "ui-complete"
  )
    notFound();
  const query = await searchParams;
  if (query.screen === "result") return <ResultFixture />;
  if (query.screen === "controls") return <ControlsFixture />;
  const count =
    [0, 1, 3, 4].find((value) => String(value) === query.count) ?? 4;
  const urls = Array.from(
    { length: count },
    (_, index) => `/e2e-images/thumb-${index + 1}.png`,
  );
  if (query.duplicate === "1" && urls.length) urls.splice(1, 0, urls[0]);
  const theme = {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Tema das quatro capas",
    slug: "ui-capas",
    description: "Músicas para comparar em grupo.",
    coverUrl: "/e2e-images/cover.png",
    thumbnailUrls: urls,
    activeSongCount: 4,
    supportedBracketSizes: [4] as const,
  };
  if (query.screen === "theme")
    return (
      <main className="mx-auto max-w-3xl space-y-6 p-4">
        <h1>{theme.name}</h1>
        <ThemeThumbnailStack
          thumbnailUrls={urls}
          fallbackCoverUrl={theme.coverUrl}
          className="aspect-video rounded-2xl"
        />
        <StartGameForm
          themeId={theme.id}
          activeSongCount={4}
          supportedBracketSizes={[4]}
        />
      </main>
    );
  return <HomeExperience themes={[{ ...theme, supportedBracketSizes: [4] }]} />;
}
