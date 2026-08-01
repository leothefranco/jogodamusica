import { getSupportedBracketSizes } from "@/domain/music/content-validation";

export function SupportedGameModes({
  activeSongCount,
}: {
  activeSongCount: number;
}) {
  const sizes = getSupportedBracketSizes(activeSongCount);

  return (
    <div aria-label="Modalidades suportadas" className="flex flex-wrap gap-2">
      {sizes.length === 0 ? (
        <span className="text-xs text-white/38">
          Nenhuma modalidade disponível
        </span>
      ) : (
        sizes.map((size) => (
          <span
            key={size}
            className="rounded-full border border-violet-300/16 bg-violet-400/7 px-2.5 py-1 text-xs font-semibold text-violet-100"
          >
            {size} músicas · equivalente a {Math.log2(size)} rodadas
          </span>
        ))
      )}
    </div>
  );
}
