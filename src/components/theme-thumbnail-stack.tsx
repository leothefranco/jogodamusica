"use client";

import {
  type CSSProperties,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type ThemeThumbnailStackProps = {
  thumbnailUrls: string[];
  fallbackCoverUrl?: string | null;
  className?: string;
};

type ThemeVisualCandidateProps = Pick<
  ThemeThumbnailStackProps,
  "thumbnailUrls" | "fallbackCoverUrl"
>;

export type ThemeVisualFailures = ReadonlySet<string>;

export type ThemeVisualCandidates =
  | { kind: "cover"; url: string }
  | { kind: "thumbnails"; urls: string[] }
  | { kind: "placeholder" };

export function createThemeVisualFailures(): ThemeVisualFailures {
  return new Set();
}

export function recordThemeVisualFailure(
  failures: ThemeVisualFailures,
  failedUrl: string,
): ThemeVisualFailures {
  if (failures.has(failedUrl)) return failures;
  return new Set([...failures, failedUrl]);
}

export function selectThemeVisualCandidates(
  { thumbnailUrls, fallbackCoverUrl }: ThemeVisualCandidateProps,
  failures: ThemeVisualFailures,
): ThemeVisualCandidates {
  if (fallbackCoverUrl && !failures.has(fallbackCoverUrl)) {
    return { kind: "cover", url: fallbackCoverUrl };
  }

  const visibleThumbnails = [...new Set(thumbnailUrls)]
    .slice(0, 4)
    .filter((thumbnailUrl) => !failures.has(thumbnailUrl));

  return visibleThumbnails.length
    ? { kind: "thumbnails", urls: visibleThumbnails }
    : { kind: "placeholder" };
}

export function ThemeThumbnailStack({
  thumbnailUrls,
  fallbackCoverUrl,
  className,
}: ThemeThumbnailStackProps) {
  const [failures, setFailures] = useState(createThemeVisualFailures);
  const imageElements = useRef(new Map<string, HTMLImageElement>());
  const candidates = selectThemeVisualCandidates(
    { thumbnailUrls, fallbackCoverUrl },
    failures,
  );
  const candidateSignature =
    candidates.kind === "cover"
      ? `cover:${candidates.url}`
      : candidates.kind === "thumbnails"
        ? `thumbnails:${candidates.urls.join("\n")}`
        : "placeholder";

  const recordFailure = useCallback((failedUrl: string) => {
    setFailures((currentFailures) =>
      recordThemeVisualFailure(currentFailures, failedUrl),
    );
  }, []);

  const rememberImage = useCallback(
    (imageUrl: string, image: HTMLImageElement | null) => {
      if (image) imageElements.current.set(imageUrl, image);
      else imageElements.current.delete(imageUrl);
    },
    [],
  );

  useEffect(() => {
    for (const [imageUrl, image] of imageElements.current) {
      if (image.complete && image.naturalWidth === 0) recordFailure(imageUrl);
    }
  }, [candidateSignature, recordFailure]);

  const imageProps = (imageUrl: string) => ({
    ref: (image: HTMLImageElement | null) => rememberImage(imageUrl, image),
    onError: () => recordFailure(imageUrl),
    onLoad: (event: SyntheticEvent<HTMLImageElement>) => {
      if (event.currentTarget.naturalWidth === 0) recordFailure(imageUrl);
    },
  });

  return (
    <div
      className={cn("theme-thumbnail-stack", className)}
      data-theme-visual={candidates.kind}
      aria-hidden="true"
    >
      {candidates.kind === "cover" ? (
        // A capa administrativa é validada como URL HTTP(S).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...imageProps(candidates.url)}
          src={candidates.url}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : candidates.kind === "thumbnails" ? (
        candidates.urls.map((thumbnailUrl, index) => (
          <span
            key={thumbnailUrl}
            className="theme-thumbnail-card"
            style={{ "--thumbnail-index": index } as CSSProperties}
          >
            {/* As miniaturas do YouTube são validadas antes de entrar no catálogo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              {...imageProps(thumbnailUrl)}
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
        ))
      ) : (
        <span className="theme-visual-placeholder">
          <span className="theme-visual-placeholder-mark">♫</span>
          <span>Jogo da Música</span>
        </span>
      )}
    </div>
  );
}
