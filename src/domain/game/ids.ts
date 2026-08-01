declare const gameIdKind: unique symbol;

type GameId<Kind extends string> = string & {
  readonly [gameIdKind]: Kind;
};

export type GameMatchId = GameId<"match">;
export type GameSongId = GameId<"song">;

export function gameMatchId(value: string): GameMatchId {
  return value as GameMatchId;
}

export function gameSongId(value: string): GameSongId {
  return value as GameSongId;
}
