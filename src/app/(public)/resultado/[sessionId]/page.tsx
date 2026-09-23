import { notFound, redirect } from "next/navigation";
import { GameResult } from "@/components/game/game-result";
import { projectCompletedGame } from "@/domain/game/projections";
import { getPublicGamePageState } from "../../game-page-state";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const state = await getPublicGamePageState(sessionId);

  if (state.session.status === "active") redirect(`/jogo/${sessionId}`);
  if (state.session.status === "abandoned")
    redirect(`/tema/${state.theme.slug}`);

  const result = projectCompletedGame(state);
  if (!result) notFound();
  return <GameResult state={state} result={result} sessionId={sessionId} />;
}
