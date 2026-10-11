import Loading from "@/app/loading";
import OfflinePage from "@/app/offline/page";
import { HomeExperience } from "@/components/home-experience";
import { notFound } from "next/navigation";
import { GameExperience } from "@/components/game/game-experience";
import { GameResult } from "@/components/game/game-result";
import { PublicThemeExperience } from "@/components/public-theme-experience";
import { projectCompletedGame } from "@/domain/game/projections";
import { getFixture } from "../fixture.e2e";
export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const fixture = await getFixture();
  const { service, catalog } = fixture;
  const [kind, id] = (await params).path;
  if (kind === "estado") {
    if (id === "loading") return <Loading />;
    if (id === "offline") return <OfflinePage />;
    if (id === "404") notFound();
    if (id === "vazio") return <HomeExperience themes={[]} />;
    if (id === "continuacao")
      return <HomeExperience themes={[]} nextPage={2} />;
    notFound();
  }
  if (kind === "erro") {
    if (fixture.hasRenderFailure())
      throw new Error("LTS02 controlled rendering fault");
    return (
      <main>
        <h1>Página recuperada</h1>
      </main>
    );
  }
  if (kind === "tema") {
    const theme = await catalog.getTheme(id);
    if (!theme) notFound();
    return <PublicThemeExperience theme={theme} />;
  }
  const state = await service.getState(id);
  if (kind === "jogo") return <GameExperience initialState={state} />;
  const result = projectCompletedGame(state);
  if (kind !== "resultado" || !result) notFound();
  return <GameResult state={state} result={result} sessionId={id} />;
}
