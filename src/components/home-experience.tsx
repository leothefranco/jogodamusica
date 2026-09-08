import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ThemeThumbnailStack } from "@/components/theme-thumbnail-stack";
import { countLabel } from "@/lib/language";
import type { PublicTheme } from "@/server/services/public-theme-service";
import styles from "./home-experience.module.css";

export function HomeExperience({ themes }: { themes: PublicTheme[] }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a
          href="#inicio"
          className={styles.brand}
          aria-label="Jogo da Música — início"
        >
          JOGO DA
          <br />
          MÚSICA<span aria-hidden="true">●</span>
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
              Ainda não há temas publicados. Volte em breve.
            </p>
          )}
        </section>
      </div>
      <footer className={styles.footer}>
        <span>JOGO DA MÚSICA</span>
        <p>Escolha o tema. Compare as músicas. Eleja a melhor.</p>
      </footer>
    </main>
  );
}
