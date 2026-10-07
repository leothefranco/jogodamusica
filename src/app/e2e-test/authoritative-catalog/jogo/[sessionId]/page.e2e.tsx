import { catalogFixture } from "../../fixture.e2e";

export default async function CreatedGameFixture({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const fixture = await catalogFixture();
  const state = await fixture.games.getState((await params).sessionId);
  return (
    <main>
      <h1>Partida criada</h1>
      <p data-testid="bracket-size">{state.session.bracketSize}</p>
      <p data-testid="snapshot-count">{state.songs.length}</p>
      <p data-testid="match-count">{state.matches.length}</p>
      <p data-testid="snapshot-distinct">
        {new Set(state.songs.map((song) => song.songId)).size}
      </p>
    </main>
  );
}
