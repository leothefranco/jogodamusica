import type { ThemeState } from "@/domain/music/theme-state";

export function SupportedGameModes({ modes }: { modes: ThemeState["modes"] }) {
  return (
    <div aria-label="Modalidades suportadas" className="space-y-3">
      <section aria-label="Modalidades principais">
        <h3 className="text-sm font-bold text-violet-200">
          Principais · 32 e 64
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {modes.primary.length === 0 ? (
            <span className="text-xs text-white/50">
              Nenhuma principal disponível
            </span>
          ) : (
            modes.primary.map((size) => (
              <span
                key={size}
                className="rounded-xl border border-violet-300/30 bg-violet-400/15 px-4 py-2 font-bold text-violet-100"
              >
                {size} músicas
              </span>
            ))
          )}
        </div>
      </section>
      <section aria-label="Modalidades rápidas">
        <h3 className="text-xs font-semibold text-white/65">Rápidas</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {modes.quick.length === 0 ? (
            <span className="text-xs text-white/50">
              Nenhuma modalidade disponível
            </span>
          ) : (
            modes.quick.map((size) => (
              <span
                key={size}
                className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/75"
              >
                {size} músicas
              </span>
            ))
          )}
        </div>
      </section>
      {modes.extended.length > 0 ? (
        <section
          aria-label="Modalidade estendida"
          className="text-xs text-white/50"
        >
          Estendida: {modes.extended.join(", ")} músicas
        </section>
      ) : null}
    </div>
  );
}
