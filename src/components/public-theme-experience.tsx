import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { StartGameForm } from "@/components/game/start-game-form";
import { ThemeThumbnailStack } from "@/components/theme-thumbnail-stack";
import type { PublicTheme } from "@/server/services/public-theme-service";
import styles from "./public-theme-experience.module.css";

export function PublicThemeExperience({ theme }: { theme: PublicTheme }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          <ArrowLeft size={18} aria-hidden="true" /> Voltar aos temas
        </Link>
        <BrandMark size={40} />
      </header>
      <section className={styles.layout} aria-labelledby="theme-title">
        <div className={styles.details}>
          <p className={styles.eyebrow}>
            {theme.activeSongCount} músicas disponíveis
          </p>
          <h1 id="theme-title">{theme.name}</h1>
          <p className={styles.description}>
            {theme.description ??
              "Escolha o tamanho da chave e descubra a campeã deste tema."}
          </p>
          <ThemeThumbnailStack
            thumbnailUrls={theme.thumbnailUrls}
            fallbackCoverUrl={theme.coverUrl}
            className={styles.cover}
          />
          <p className={styles.rule}>
            Duas músicas por confronto. Uma campeã no final.
          </p>
        </div>
        <StartGameForm
          themeId={theme.id}
          activeSongCount={theme.activeSongCount}
          supportedBracketSizes={theme.supportedBracketSizes}
          modeGroups={theme.modeGroups}
        />
      </section>
    </main>
  );
}
