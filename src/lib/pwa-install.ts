export const PWA_INSTALL_DISMISS_KEY = "pwa-install-dismissed-until";
export const PWA_INSTALL_DISMISS_MS = 7 * 24 * 60 * 60_000;

export function getInstallPromptDismissedUntil(value: string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function shouldOfferPwaInstall(input: {
  pathname: string;
  dismissedUntil: number | null;
  now: number;
}) {
  if (input.pathname.startsWith("/jogo/")) return false;
  return input.dismissedUntil === null || input.dismissedUntil <= input.now;
}
