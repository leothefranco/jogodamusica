import type {
  EffectiveSourceAvailability,
  SourceAvailabilityObservation,
} from "@/domain/music/source-availability";

const labels = {
  available_fresh: "Disponível",
  available_grace: "Em tolerância",
  unavailable: "Indisponível",
  unknown: "Desconhecida",
} as const;

const tones = {
  available_fresh: "border-emerald-300/20 text-emerald-200",
  available_grace: "border-amber-300/20 text-amber-100",
  unavailable: "border-red-300/20 text-red-200",
  unknown: "border-white/10 text-white/50",
} as const;

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function Instant({ value }: { value: Date | null }) {
  if (!value) return <span>—</span>;
  return (
    <time dateTime={value.toISOString()}>{dateTimeFormat.format(value)}</time>
  );
}

export function SourceAvailabilityStatus({
  availability,
  observation,
}: {
  availability: EffectiveSourceAvailability;
  observation: SourceAvailabilityObservation | null;
}) {
  return (
    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-bold ${tones[availability.state]}`}
        >
          {labels[availability.state]}
        </span>
        <span className="text-xs text-white/38">
          Brasil · policy v{observation?.policyVersion ?? 1}
        </span>
      </div>

      {observation ? (
        <dl className="mt-3 grid gap-2 text-xs text-white/48 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="font-semibold text-white/65">Última tentativa</dt>
            <dd className="mt-1">
              <Instant value={observation.lastAttemptAt} />
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white/65">Última confirmação</dt>
            <dd className="mt-1">
              <Instant value={observation.lastConfirmedAt} />
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white/65">Validade</dt>
            <dd className="mt-1">
              <Instant value={observation.validUntil} />
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white/65">Fim da tolerância</dt>
            <dd className="mt-1">
              <Instant value={observation.graceUntil} />
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-xs text-white/42">
          Nunca verificada no Brasil. Fontes legadas permanecem desconhecidas.
        </p>
      )}
    </div>
  );
}
