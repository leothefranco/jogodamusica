import type { ThemeState } from "@/domain/music/theme-state";

export function SupportedGameModes({ modes }: { modes: ThemeState["modes"] }) {
  return (
    <div aria-label="Modalidades suportadas" className="space-y-3">
      <section aria-label="Modalidades principais">
        <h3 className="text-sm font-bold text-[var(--duel-a)]">
          Principais · 32 e 64
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {modes.primary.length === 0 ? (
            <span className="text-xs text-[var(--app-muted)]">
              Nenhuma principal disponível
            </span>
          ) : (
            modes.primary.map((size) => (
              <span
                key={size}
                className="rounded-md border border-[var(--duel-a)]/30 bg-[var(--duel-a)]/15 px-4 py-2 font-bold text-[var(--duel-a)]"
              >
                {size} músicas
              </span>
            ))
          )}
        </div>
      </section>
      <section aria-label="Modalidades rápidas">
        <h3 className="text-xs font-semibold text-[var(--app-muted)]">
          Rápidas
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {modes.quick.length === 0 ? (
            <span className="text-xs text-[var(--app-muted)]">
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
          className="text-xs text-[var(--app-muted)]"
        >
          Estendida: {modes.extended.join(", ")} músicas
        </section>
      ) : null}
    </div>
  );
}
