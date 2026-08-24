import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type ThemeThumbnailStackProps = {
  thumbnailUrls: string[];
  fallbackCoverUrl?: string | null;
  className?: string;
};

export function ThemeThumbnailStack({
  thumbnailUrls,
  fallbackCoverUrl,
  className,
}: ThemeThumbnailStackProps) {
  const visibleThumbnails = thumbnailUrls.slice(0, 4);

  return (
    <div className={cn("theme-thumbnail-stack", className)} aria-hidden="true">
      {visibleThumbnails.length ? (
        visibleThumbnails.map((thumbnailUrl, index) => (
          <span
            key={`${thumbnailUrl}-${index}`}
            className="theme-thumbnail-card"
            style={{ "--thumbnail-index": index } as CSSProperties}
          >
            {/* As miniaturas do YouTube são validadas antes de entrar no catálogo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
        ))
      ) : fallbackCoverUrl ? (
        // A capa administrativa é validada como URL HTTP(S).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallbackCoverUrl}
          alt=""
          className="h-full w-full object-cover opacity-80"
        />
      ) : null}
    </div>
  );
}
