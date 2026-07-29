import "server-only";

import { and, asc, eq, ne, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  gameMatches,
  gameSessions,
  sessionSongs,
  songs,
  themes,
  themeSongs,
} from "@/db/schema";
import type { MatchCoordinate, MatchSongSlot } from "@/domain/bracket";
import { bracketSizeSchema } from "@/domain/music/content-validation";
import { AppError } from "@/lib/errors";
import type {
  GameCreationRepository,
  GameState,
  GameVoteRepository,
  NewGameMatch,
  NewGameSession,
  PersistedGameMatch,
  PersistedGameSession,
  SessionSongSnapshot,
} from "@/server/services/game-service";

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ReadDatabase = Pick<Database, "select">;

const sessionSelection = {
  id: gameSessions.id,
  themeId: gameSessions.themeId,
  bracketSize: gameSessions.bracketSize,
  status: gameSessions.status,
  currentRound: gameSessions.currentRound,
  championSongId: gameSessions.championSongId,
  startedAt: gameSessions.startedAt,
  completedAt: gameSessions.completedAt,
};

const matchSelection = {
  id: gameMatches.id,
  sessionId: gameMatches.sessionId,
  roundNumber: gameMatches.roundNumber,
  position: gameMatches.position,
  songAId: gameMatches.songAId,
  songBId: gameMatches.songBId,
  winnerSongId: gameMatches.winnerSongId,
  status: gameMatches.status,
  completedAt: gameMatches.completedAt,
};

const sessionSongSelection = {
  sessionId: sessionSongs.sessionId,
  songId: sessionSongs.songId,
  seed: sessionSongs.seed,
  title: sessionSongs.title,
  artist: sessionSongs.artist,
  thumbnailUrl: sessionSongs.thumbnailUrl,
  provider: sessionSongs.provider,
  providerContentId: sessionSongs.providerContentId,
  startTimeSeconds: sessionSongs.startTimeSeconds,
  previewDurationSeconds: sessionSongs.previewDurationSeconds,
};

async function insertSessionUsing(
  transaction: Transaction,
  session: NewGameSession,
) {
  const [created] = await transaction
    .insert(gameSessions)
    .values(session)
    .returning({ id: gameSessions.id });
  return created.id;
}

async function insertSessionSongsUsing(
  transaction: Transaction,
  snapshots: SessionSongSnapshot[],
) {
  await transaction.insert(sessionSongs).values(snapshots);
}

async function insertMatchesUsing(
  transaction: Transaction,
  matches: NewGameMatch[],
) {
  await transaction.insert(gameMatches).values(matches);
}

async function getSessionUsing(
  transaction: ReadDatabase,
  sessionId: string,
): Promise<PersistedGameSession | null> {
  const [session] = await transaction
    .select(sessionSelection)
    .from(gameSessions)
    .where(eq(gameSessions.id, sessionId))
    .limit(1);

  return session
    ? {
        ...session,
        bracketSize: bracketSizeSchema.parse(session.bracketSize),
      }
    : null;
}

async function getMatchUsing(
  transaction: Transaction,
  sessionId: string,
  matchId: string,
): Promise<PersistedGameMatch | null> {
  const [match] = await transaction
    .select(matchSelection)
    .from(gameMatches)
    .where(
      and(eq(gameMatches.sessionId, sessionId), eq(gameMatches.id, matchId)),
    )
    .limit(1);

  return match ?? null;
}

async function getMatchAtUsing(
  transaction: Transaction,
  sessionId: string,
  roundNumber: number,
  position: number,
): Promise<PersistedGameMatch | null> {
  const [match] = await transaction
    .select(matchSelection)
    .from(gameMatches)
    .where(
      and(
        eq(gameMatches.sessionId, sessionId),
        eq(gameMatches.roundNumber, roundNumber),
        eq(gameMatches.position, position),
      ),
    )
    .limit(1);

  return match ?? null;
}

export async function getGameStateRecord(
  sessionId: string,
): Promise<GameState | null> {
  const database = getDatabase();
  const [session, snapshots, matches] = await Promise.all([
    getSessionUsing(database, sessionId),
    database
      .select(sessionSongSelection)
      .from(sessionSongs)
      .where(eq(sessionSongs.sessionId, sessionId))
      .orderBy(asc(sessionSongs.seed)),
    database
      .select(matchSelection)
      .from(gameMatches)
      .where(eq(gameMatches.sessionId, sessionId))
      .orderBy(asc(gameMatches.roundNumber), asc(gameMatches.position)),
  ]);

  if (!session) return null;

  return {
    session,
    songs: snapshots,
    matches,
    currentMatch: matches.find(({ status }) => status === "ready") ?? null,
    progress: {
      completedMatches: matches.filter(({ status }) => status === "completed")
        .length,
      totalMatches: matches.length,
      currentRound: session.currentRound,
      roundCount: Math.log2(session.bracketSize),
    },
  };
}

export async function withGameCreationTransaction<T>(
  themeId: string,
  operation: (repository: GameCreationRepository) => Promise<T>,
): Promise<T> {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(
      sql`select ${themes.id} from ${themes} where ${themes.id} = ${themeId} for update`,
    );

    return operation({
      getThemeWithActiveSongs: async () => {
        const [theme] = await transaction
          .select({ id: themes.id, isActive: themes.isActive })
          .from(themes)
          .where(eq(themes.id, themeId))
          .limit(1);
        if (!theme) return null;

        const activeSongs = await transaction
          .select({
            songId: songs.id,
            title: themeSongs.title,
            artist: themeSongs.artist,
            thumbnailUrl: songs.thumbnailUrl,
            provider: songs.provider,
            providerContentId: songs.providerContentId,
            startTimeSeconds: themeSongs.startTimeSeconds,
            previewDurationSeconds: themeSongs.previewDurationSeconds,
          })
          .from(themeSongs)
          .innerJoin(songs, eq(songs.id, themeSongs.songId))
          .where(
            and(
              eq(themeSongs.themeId, themeId),
              eq(themeSongs.isActive, true),
              eq(songs.isEmbeddable, true),
            ),
          )
          .orderBy(
            sql`${themeSongs.displayOrder} asc nulls last`,
            asc(themeSongs.createdAt),
            asc(themeSongs.songId),
          );

        return { ...theme, songs: activeSongs };
      },
      insertSession: (session) => insertSessionUsing(transaction, session),
      insertSessionSongs: (snapshots) =>
        insertSessionSongsUsing(transaction, snapshots),
      insertMatches: (matches) => insertMatchesUsing(transaction, matches),
    });
  });
}

export async function withGameVoteTransaction<T>(
  sessionId: string,
  operation: (repository: GameVoteRepository) => Promise<T>,
): Promise<T> {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(
      sql`select ${gameSessions.id} from ${gameSessions} where ${gameSessions.id} = ${sessionId} for update`,
    );

    return operation({
      getSession: () => getSessionUsing(transaction, sessionId),
      getMatch: (matchId) => getMatchUsing(transaction, sessionId, matchId),
      getMatchAt: ({ roundNumber, position }: MatchCoordinate) =>
        getMatchAtUsing(transaction, sessionId, roundNumber, position),
      async completeMatch(matchId, winnerSongId, completedAt) {
        const completed = await transaction
          .update(gameMatches)
          .set({
            winnerSongId,
            status: "completed",
            completedAt,
            updatedAt: completedAt,
          })
          .where(
            and(
              eq(gameMatches.sessionId, sessionId),
              eq(gameMatches.id, matchId),
              eq(gameMatches.status, "ready"),
            ),
          )
          .returning({ id: gameMatches.id });
        if (completed.length === 0) {
          throw new AppError(
            "MATCH_ALREADY_COMPLETED",
            "Este confronto já foi concluído.",
            409,
          );
        }
      },
      async placeSongInMatch(
        matchId: string,
        slot: MatchSongSlot,
        songId: string,
      ) {
        const match = await getMatchUsing(transaction, sessionId, matchId);
        if (!match) {
          throw new AppError(
            "INVALID_BRACKET_STATE",
            "O próximo confronto da chave não foi encontrado.",
            500,
          );
        }
        const values =
          slot === "songAId"
            ? {
                songAId: songId,
                status: match.songBId
                  ? ("ready" as const)
                  : ("pending" as const),
              }
            : {
                songBId: songId,
                status: match.songAId
                  ? ("ready" as const)
                  : ("pending" as const),
              };
        const advanced = await transaction
          .update(gameMatches)
          .set({ ...values, updatedAt: new Date() })
          .where(
            and(
              eq(gameMatches.sessionId, sessionId),
              eq(gameMatches.id, matchId),
              eq(gameMatches.status, "pending"),
            ),
          )
          .returning({ id: gameMatches.id });
        if (advanced.length === 0) {
          throw new AppError(
            "INVALID_BRACKET_STATE",
            "A vencedora não pôde avançar para o próximo confronto.",
            409,
          );
        }
      },
      async hasIncompleteMatchesInRound(roundNumber) {
        const [match] = await transaction
          .select({ id: gameMatches.id })
          .from(gameMatches)
          .where(
            and(
              eq(gameMatches.sessionId, sessionId),
              eq(gameMatches.roundNumber, roundNumber),
              ne(gameMatches.status, "completed"),
            ),
          )
          .limit(1);
        return Boolean(match);
      },
      async setCurrentRound(roundNumber) {
        await transaction
          .update(gameSessions)
          .set({ currentRound: roundNumber, updatedAt: new Date() })
          .where(eq(gameSessions.id, sessionId));
      },
      async completeSession(championSongId, completedAt) {
        await transaction
          .update(gameSessions)
          .set({
            status: "completed",
            championSongId,
            completedAt,
            updatedAt: completedAt,
          })
          .where(
            and(
              eq(gameSessions.id, sessionId),
              eq(gameSessions.status, "active"),
            ),
          );
      },
    });
  });
}
