"use client";

import { useState } from "react";
import { YouTubeSongManager } from "@/components/admin/youtube-song-manager";
import { PlaylistImportManager } from "@/components/admin/playlist-import-manager";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { initialContentActionState } from "@/components/admin/content-action-state";
import { Button } from "@/components/ui/button";
import { SourceAvailabilityStatus } from "@/components/admin/source-availability-status";
import { SupportedGameModes } from "@/components/admin/supported-game-modes";
import { ThemeStateStatus } from "@/components/admin/theme-state-status";
import { classifyThemeState } from "@/domain/music/theme-state";

export function ControlsFixture() {
  const [submitted, setSubmitted] = useState(false);
  const themeState = classifyThemeState({
    editorialState: "published",
    counts: {
      availableFresh: 32,
      availableGrace: 0,
      unavailable: 1,
      unknown: 0,
    },
  });
  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-4">
      <h1>Controles administrativos reais</h1>
      <SourceAvailabilityStatus
        availability={{ state: "unknown", playable: false, degraded: false }}
        observation={null}
      />
      <ThemeStateStatus state={themeState} />
      <SupportedGameModes modes={themeState.modes} />
      <YouTubeSongManager
        action={async () => ({
          ...initialContentActionState,
          message: "Falha controlada ao salvar",
        })}
      />
      <PlaylistImportManager
        themeId="00000000-0000-4000-8000-000000000002"
        maxItems={50}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <ConfirmSubmitButton
          type="submit"
          confirmation="Confirmar remoção da fixture?"
          variant="destructive"
        >
          Remover fixture
        </ConfirmSubmitButton>
      </form>
      <p role="status">{submitted ? "Enviado" : "Não enviado"}</p>
      <Button disabled>Controle indisponível</Button>
    </main>
  );
}
