"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BrandMark } from "@/components/brand-mark";
import { siteConfig } from "@/lib/site";

import {
  getInstallPromptDismissedUntil,
  PWA_INSTALL_DISMISS_KEY,
  PWA_INSTALL_DISMISS_MS,
  shouldOfferPwaInstall,
} from "@/lib/pwa-install";

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function subscribeToDisplayMode(onStoreChange: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onStoreChange);
  window.addEventListener("appinstalled", onStoreChange);
  return () => {
    media.removeEventListener("change", onStoreChange);
    window.removeEventListener("appinstalled", onStoreChange);
  };
}

function getIOSInstallInstructionsSnapshot() {
  return !isStandalone() && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PwaManager() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const [now] = useState(Date.now);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return getInstallPromptDismissedUntil(
        window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY),
      );
    } catch {
      return null;
    }
  });
  const showIOSInstructions = useSyncExternalStore(
    subscribeToDisplayMode,
    getIOSInstallInstructionsSnapshot,
    () => false,
  );

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .catch(() => {
          // The site remains fully usable in the browser when registration fails.
        });
    }

    function handleInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (
    !shouldOfferPwaInstall({
      pathname,
      dismissedUntil,
      now,
    }) ||
    isStandalone() ||
    (!installPrompt && !showIOSInstructions)
  ) {
    return null;
  }

  function dismiss() {
    const nextDismissedUntil = Date.now() + PWA_INSTALL_DISMISS_MS;
    try {
      window.localStorage.setItem(
        PWA_INSTALL_DISMISS_KEY,
        String(nextDismissedUntil),
      );
    } catch {
      // The in-memory state still hides the prompt for the current visit.
    }
    setDismissedUntil(nextDismissedUntil);
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <aside
      aria-label={
        isAdmin ? "Instalar aplicativo administrativo" : "Instalar aplicativo"
      }
      className="fixed right-3 bottom-3 left-3 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-[var(--brand)]/25 bg-[var(--app-surface)]/95 p-4 text-sm text-[var(--app-text)] shadow-2xl backdrop-blur sm:right-5 sm:bottom-5 sm:left-auto"
    >
      <span className="size-10 shrink-0">
        <BrandMark size={40} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          Instale o {isAdmin ? siteConfig.adminName : siteConfig.name}
        </p>
        {showIOSInstructions ? (
          <p className="mt-1 leading-5 text-[var(--app-muted)]">
            No Safari, toque em Compartilhar e depois em “Adicionar à Tela de
            Início”.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-2 min-h-11 rounded-lg bg-[var(--brand)] px-4 font-bold text-[var(--app-bg)] outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
          >
            Instalar aplicativo
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar instrução de instalação"
        className="grid size-11 shrink-0 place-items-center rounded-lg text-[var(--app-muted)] outline-none hover:bg-white/10 hover:text-[var(--app-text)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
      >
        <X aria-hidden="true" />
      </button>
    </aside>
  );
}
