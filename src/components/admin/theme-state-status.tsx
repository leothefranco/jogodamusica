import type {
  ThemeOperationalState,
  ThemeState,
} from "@/domain/music/theme-state";
import { countLabel } from "@/lib/language";

const operationalLabels: Record<ThemeOperationalState, string> = {
  editorial_draft: "Rascunho editorial",
  healthy: "Saudável",
  degraded: "Degradado",
  suspended_pending_verification: "Suspenso: verificação pendente",
  suspended_insufficient_healthy_entries:
    "Suspenso: Entradas saudáveis insuficientes",
};

export function ThemeStateStatus({ state }: { state: ThemeState }) {
  return (
    <section aria-label="Estado do Tema" className="space-y-3 text-sm">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-white/50">Publicação</dt>
          <dd className="font-semibold">
            {state.editorialState === "published" ? "Publicado" : "Rascunho"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Visibilidade derivada</dt>
          <dd className="font-semibold">
            {state.visibility === "visible" ? "Visível" : "Oculto"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Estado operacional</dt>
          <dd className="font-semibold">
            {operationalLabels[state.operationalState]}
          </dd>
        </div>
      </dl>
      <p>
        {countLabel(state.counts.playableCount, "jogável", "jogáveis")} ·{" "}
        {countLabel(state.counts.potentialCount, "potencial", "potenciais")} ·{" "}
        {countLabel(
          state.counts.activeEntryCount,
          "Entrada ativa",
          "Entradas ativas",
        )}
      </p>
      <p className="text-xs text-white/60">
        {countLabel(state.counts.availableFresh, "fresca", "frescas")} ·{" "}
        {state.counts.availableGrace} em tolerância ·{" "}
        {countLabel(state.counts.unavailable, "indisponível", "indisponíveis")}{" "}
        · {countLabel(state.counts.unknown, "desconhecida", "desconhecidas")}
      </p>
      {state.warnings.healthLostPrimaryModes.length > 0 ? (
        <p className="text-amber-200">
          Modalidades principais indisponíveis por saúde:{" "}
          {state.warnings.healthLostPrimaryModes.join(", ")}.
        </p>
      ) : null}
      {state.editorialState === "published" && state.visibility === "hidden" ? (
        <p className="text-amber-200">
          A intenção de publicação é preservada. A recuperação da saúde restaura
          a visibilidade sem republicação.
        </p>
      ) : null}
      <p className="text-xs text-white/45">
        Estado derivado no admin. O catálogo público ainda usa a leitura legada.
      </p>
    </section>
  );
}
