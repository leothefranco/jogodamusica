"use client";

import { Download, Share2, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

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
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
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

  if (dismissed || isStandalone() || (!installPrompt && !showIOSInstructions)) {
    return null;
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <aside
      aria-label="Instalar aplicativo"
      className="fixed right-3 bottom-3 left-3 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-violet-300/25 bg-[#11101d]/95 p-4 text-sm text-white shadow-2xl backdrop-blur sm:right-5 sm:bottom-5 sm:left-auto"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-300/10 text-violet-200">
        {showIOSInstructions ? (
          <Share2 aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">Instale o Jogo da Música</p>
        {showIOSInstructions ? (
          <p className="mt-1 leading-5 text-white/60">
            No Safari, toque em Compartilhar e depois em “Adicionar à Tela de
            Início”.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-2 min-h-11 rounded-lg bg-violet-300 px-4 font-bold text-[#160d25] outline-none hover:bg-violet-200 focus-visible:ring-2 focus-visible:ring-white"
          >
            Instalar aplicativo
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fechar instrução de instalação"
        className="grid size-11 shrink-0 place-items-center rounded-lg text-white/55 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        <X aria-hidden="true" />
      </button>
    </aside>
  );
}
