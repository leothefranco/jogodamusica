import { redirect } from "next/navigation";

import { GameExperience } from "@/components/game/game-experience";
import { getPublicGamePageState } from "../../game-page-state";

export default async function GamePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const state = await getPublicGamePageState(sessionId);

  if (state.session.status === "completed") {
    redirect(`/resultado/${sessionId}`);
  }
  if (state.session.status === "abandoned") {
    redirect(`/tema/${state.theme.slug}`);
  }

  return <GameExperience initialState={state} />;
}
