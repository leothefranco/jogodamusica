import { describe, expect, it } from "vitest";

import {
  getInstallPromptDismissedUntil,
  shouldOfferPwaInstall,
} from "@/lib/pwa-install";

describe("convite de instalação PWA", () => {
  it("respeita o cooldown persistido", () => {
    expect(
      shouldOfferPwaInstall({
        pathname: "/",
        dismissedUntil: 2_000,
        now: 1_000,
      }),
    ).toBe(false);
    expect(
      shouldOfferPwaInstall({
        pathname: "/",
        dismissedUntil: 2_000,
        now: 2_001,
      }),
    ).toBe(true);
  });

  it("não cobre uma partida em andamento", () => {
    expect(
      shouldOfferPwaInstall({
        pathname: "/jogo/uma-sessao",
        dismissedUntil: null,
        now: 1_000,
      }),
    ).toBe(false);
  });

  it("ignora valores persistidos inválidos", () => {
    expect(getInstallPromptDismissedUntil("inválido")).toBeNull();
    expect(getInstallPromptDismissedUntil("1234")).toBe(1234);
  });
});
