import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ThemeThumbnailStack } from "@/components/theme-thumbnail-stack";
import { countLabel } from "@/lib/language";
import { siteConfig } from "@/lib/site";
import type { PublicTheme } from "@/server/services/public-theme-service";
import styles from "./home-experience.module.css";

export function HomeExperience({
  themes,
  nextPage = null,
  catalogPage = 1,
}: {
  themes: PublicTheme[];
  nextPage?: number | null;
  catalogPage?: number;
}) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a
          href="#inicio"
          className={styles.brand}
          aria-label={`${siteConfig.name} — início`}
        >
          <BrandMark size={56} />
          <div>
            {siteConfig.shortName}
            <br />
            {siteConfig.name.slice(siteConfig.shortName.length).trim()}
            <span aria-hidden="true">●</span>
          </div>
        </a>
        <p className={styles.about}>
          UM APARELHO · JOGO EM GRUPO
          <br />
          <span>Uma música passa por vez.</span>
        </p>
        <a href="#temas" className={styles.jump} aria-label="Escolher tema">
          <ArrowUpRight aria-hidden="true" />
        </a>
      </header>
      <div className={styles.layout}>
        <section
          id="inicio"
          className={styles.intro}
          aria-labelledby="titulo-inicio"
        >
          <p className={styles.eyebrow}>CATÁLOGO / ESCOLHA O TEMA</p>
          <h1 id="titulo-inicio">
            QUAL É A<br />
            <span>MELHOR</span>
            <br />
            <span className={styles.questionEnd}>MÚSICA?</span>
          </h1>
          <div className={styles.duelRule} aria-hidden="true">
            VS
          </div>
          <p className={styles.description}>
            Escolha um tema.
            <br />
            Escolham a melhor música.
          </p>
        </section>
        <section
          id="temas"
          className={styles.catalog}
          aria-labelledby="titulo-temas"
        >
          <div className={styles.sectionTitle}>
            <h2 id="titulo-temas">Escolha o tema</h2>
            <span>{countLabel(themes.length, "tema")}</span>
          </div>
          {themes.length ? (
            <ol className={styles.list}>
              {themes.map((theme, index) => (
                <li key={theme.id}>
                  <Link href={`/tema/${theme.slug}`} className={styles.theme}>
                    <span className={styles.number} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className={styles.themeText}>
                      <h3>{theme.name}</h3>
                      <p>
                        {countLabel(theme.activeSongCount, "música")} ·{" "}
                        {countLabel(
                          theme.supportedBracketSizes.length,
                          "modalidade",
                        )}
                      </p>
                      {theme.description ? (
                        <p className={styles.themeDescription}>
                          {theme.description}
                        </p>
                      ) : null}
                    </div>
                    <ThemeThumbnailStack
                      variant="catalog"
                      thumbnailUrls={theme.thumbnailUrls}
                      fallbackCoverUrl={theme.coverUrl}
                      className={styles.cover}
                    />
                    <ArrowUpRight className={styles.arrow} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>
              {nextPage || catalogPage > 1
                ? "Nenhum tema disponível nesta página."
                : "Ainda não há temas publicados. Volte em breve."}
            </p>
          )}
          {nextPage || catalogPage > 1 ? (
            <nav
              aria-label="Páginas do catálogo"
              className="mt-6 flex flex-wrap gap-4"
            >
              {catalogPage > 1 ? (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/?page=${catalogPage - 1}#temas`}
                >
                  Página anterior
                </Link>
              ) : null}
              {nextPage ? (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/?page=${nextPage}#temas`}
                >
                  Próxima página de temas
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
      <footer className={styles.footer}>
        <span>{siteConfig.name}</span>
        <p>Escolha o tema. Compare as músicas. Eleja a melhor.</p>
      </footer>
    </main>
  );
}
