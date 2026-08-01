import type { BracketSize } from "@/domain/music/content-validation";

const roundNames = new Map<number, string>([
  [16, "Dezesseis avos de final"],
  [8, "Oitavas de final"],
  [4, "Quartas de final"],
  [2, "Semifinal"],
  [1, "Final"],
]);

export function getRoundLabel(input: {
  bracketSize: BracketSize;
  roundNumber: number;
  matchPosition: number;
}) {
  const matchCount = input.bracketSize / 2 ** input.roundNumber;
  const roundName = roundNames.get(matchCount) ?? `Rodada ${input.roundNumber}`;

  return `${roundName} · confronto ${input.matchPosition} de ${matchCount}`;
}
