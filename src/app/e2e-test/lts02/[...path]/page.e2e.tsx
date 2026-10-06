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
  const { service, catalog } = await getFixture();
  const [kind, id] = (await params).path;
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
