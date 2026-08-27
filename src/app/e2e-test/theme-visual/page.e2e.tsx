import Link from "next/link";

import { ThemeThumbnailStack } from "@/components/theme-thumbnail-stack";

function visualUrls(surface: "home" | "detail") {
  return {
    fallbackCoverUrl: `/e2e-images/cover.png?surface=${surface}`,
    thumbnailUrls: [
      `/e2e-images/thumb-1.png?surface=${surface}`,
      `/e2e-images/thumb-2.png?surface=${surface}`,
      `/e2e-images/thumb-2.png?surface=${surface}`,
      `/e2e-images/thumb-3.png?surface=${surface}`,
      `/e2e-images/thumb-4.png?surface=${surface}`,
      `/e2e-images/thumb-5.png?surface=${surface}`,
    ],
  };
}

export default function ThemeVisualFixturePage() {
  const homeVisual = visualUrls("home");
  const detailVisual = visualUrls("detail");

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08080f] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
        <section aria-labelledby="home-composition-title">
          <h1 id="home-composition-title" className="mb-4 text-2xl font-bold">
            Composição da home
          </h1>
          <Link
            href="/tema/tema-e2e"
            aria-labelledby="home-theme-title"
            className="block overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e19]"
          >
            <div data-testid="home-visual">
              <ThemeThumbnailStack {...homeVisual} className="aspect-[16/9]" />
            </div>
            <div className="p-5">
              <h2 id="home-theme-title" className="text-xl font-bold">
                Tema E2E da home
              </h2>
              <p className="mt-2 text-sm text-white/50">
                Uma chave musical pronta para jogar.
              </p>
            </div>
          </Link>
        </section>

        <section aria-labelledby="detail-theme-title">
          <h1 id="detail-theme-title" className="mb-4 text-2xl font-bold">
            Tema E2E do detalhe
          </h1>
          <div data-testid="detail-visual">
            <ThemeThumbnailStack
              {...detailVisual}
              className="aspect-[16/9] rounded-3xl border border-white/10"
            />
          </div>
          <button
            type="button"
            data-testid="detail-cta"
            className="mt-5 min-h-11 rounded-xl bg-violet-300 px-5 font-bold text-[#130d22]"
          >
            Começar jogo
          </button>
        </section>
      </div>
    </main>
  );
}
