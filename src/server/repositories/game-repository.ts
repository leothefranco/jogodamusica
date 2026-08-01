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
import { bracketSizeSchema } from "@/domain/music/content-validation";
import { AppError } from "@/lib/errors";
import type {
  GameCreationRepository,
  GameVoteRepository,
  NewGameMatch,
  NewGameSession,
} from "@/server/services/game-service";
import type {
  GameState,
  PersistedGameMatch,
  PersistedGameSession,
  SessionSongSnapshot,
} from "@/domain/game/state";

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

export async function getGameStateRecord(
  sessionId: string,
): Promise<GameState | null> {
  const database = getDatabase();
  const [session, theme, snapshots, matches] = await Promise.all([
    getSessionUsing(database, sessionId),
    database
      .select({ name: themes.name, slug: themes.slug })
      .from(gameSessions)
      .innerJoin(themes, eq(themes.id, gameSessions.themeId))
      .where(eq(gameSessions.id, sessionId))
      .limit(1)
      .then(([record]) => record ?? null),
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

  if (!session || !theme) return null;

  return {
    theme,
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
      async getWinnerSongIdsInRound(roundNumber) {
        const roundMatches = await transaction
          .select({ winnerSongId: gameMatches.winnerSongId })
          .from(gameMatches)
          .where(
            and(
              eq(gameMatches.sessionId, sessionId),
              eq(gameMatches.roundNumber, roundNumber),
              eq(gameMatches.status, "completed"),
            ),
          )
          .orderBy(asc(gameMatches.position));
        const winnerSongIds = roundMatches.flatMap(({ winnerSongId }) =>
          winnerSongId ? [winnerSongId] : [],
        );
        if (winnerSongIds.length !== roundMatches.length) {
          throw new AppError(
            "INVALID_BRACKET_STATE",
            "Uma rodada concluída possui confronto sem vencedora.",
            500,
          );
        }
        return winnerSongIds;
      },
      async populateRound(roundNumber, pairs, populatedAt) {
        const roundMatches = await transaction
          .select({ id: gameMatches.id })
          .from(gameMatches)
          .where(
            and(
              eq(gameMatches.sessionId, sessionId),
              eq(gameMatches.roundNumber, roundNumber),
              eq(gameMatches.status, "pending"),
            ),
          )
          .orderBy(asc(gameMatches.position));
        if (roundMatches.length !== pairs.length) {
          throw new AppError(
            "INVALID_BRACKET_STATE",
            "A quantidade de pares não corresponde à próxima rodada.",
            500,
          );
        }

        for (const [index, match] of roundMatches.entries()) {
          const pair = pairs[index];
          const updatedRows = await transaction
            .update(gameMatches)
            .set({
              songAId: pair.songAId,
              songBId: pair.songBId,
              status: "ready",
              updatedAt: populatedAt,
            })
            .where(
              and(
                eq(gameMatches.sessionId, sessionId),
                eq(gameMatches.id, match.id),
                eq(gameMatches.status, "pending"),
              ),
            )
            .returning({ id: gameMatches.id });
          if (updatedRows.length === 0) {
            throw new AppError(
              "INVALID_BRACKET_STATE",
              "A próxima rodada não pôde ser formada.",
              409,
            );
          }
        }
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

export async function abandonGameSessionRecord(
  sessionId: string,
  abandonedAt: Date,
): Promise<"abandoned" | "not-active" | "not-found"> {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(
      sql`select ${gameSessions.id} from ${gameSessions} where ${gameSessions.id} = ${sessionId} for update`,
    );
    const [session] = await transaction
      .select({ status: gameSessions.status })
      .from(gameSessions)
      .where(eq(gameSessions.id, sessionId))
      .limit(1);
    if (!session) return "not-found";
    if (session.status !== "active") return "not-active";

    await transaction
      .update(gameSessions)
      .set({
        status: "abandoned",
        updatedAt: abandonedAt,
      })
      .where(eq(gameSessions.id, sessionId));
    return "abandoned";
  });
}
