"use client";

import { Trophy } from "lucide-react";
import { useEffect, useRef } from "react";
import { BrandMark } from "@/components/brand-mark";
import { getRoundName } from "@/domain/game/experience";
import type { BracketSize } from "@/domain/music/content-validation";
import styles from "./round-transition.module.css";

export function RoundTransition({
  bracketSize,
  roundNumber,
  onComplete,
}: {
  bracketSize: BracketSize;
  roundNumber: number;
  onComplete(): void;
}) {
  const isFinal = bracketSize / 2 ** roundNumber === 1;
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(
      onComplete,
      reducedMotion ? 1400 : isFinal ? 3600 : 2400,
    );
    return () => window.clearTimeout(timer);
  }, [isFinal, onComplete]);

  return (
    <main
      className={styles.stage}
      data-final={isFinal}
      aria-labelledby="stage-title"
    >
      <div className={styles.curtainA} aria-hidden="true" />
      <div className={styles.curtainB} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.emblem} aria-hidden="true">
          {isFinal ? (
            <Trophy size={72} strokeWidth={1.5} />
          ) : (
            <BrandMark size={80} />
          )}
        </div>
        <p className={styles.eyebrow}>
          {isFinal ? "O momento da decisão" : "A disputa continua"}
        </p>
        <h1
          id="stage-title"
          ref={titleRef}
          tabIndex={-1}
          className={styles.title}
        >
          {isFinal ? "Grande final" : getRoundName(bracketSize, roundNumber)}
        </h1>
        <p className={styles.description}>
          {isFinal
            ? "Duas músicas. Uma campeã."
            : `${bracketSize / 2 ** (roundNumber - 1)} músicas seguem na disputa.`}
        </p>
        <div className={styles.rule} aria-hidden="true">
          <span />
          VS
          <span />
        </div>
        <button type="button" className={styles.skip} onClick={onComplete}>
          {isFinal ? "Ir para a final" : "Continuar"}
        </button>
      </div>
    </main>
  );
}
