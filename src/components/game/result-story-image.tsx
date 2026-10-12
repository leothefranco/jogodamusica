import { ImageResponse } from "next/og";

import { BrandMark } from "@/components/brand-mark";
import type { ResultShareCard } from "@/domain/game/result-share-card";
import { brandColors } from "@/lib/brand";
import { siteConfig } from "@/lib/site";

function RecordGrooves() {
  return (
    <svg
      width="600"
      height="600"
      viewBox="0 0 600 600"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="300"
        cy="300"
        r="292"
        fill="#171B21"
        stroke={brandColors.brand}
        strokeWidth="4"
      />
      {[268, 245, 222, 199, 176, 153].map((radius) => (
        <circle
          key={radius}
          cx="300"
          cy="300"
          r={radius}
          stroke="#343A43"
          strokeWidth="2"
        />
      ))}
      <circle
        cx="300"
        cy="300"
        r="126"
        fill={brandColors.background}
        stroke={brandColors.brand}
        strokeWidth="3"
      />
    </svg>
  );
}

export function createResultStoryImage(
  card: ResultShareCard,
  headers?: Record<string, string>,
) {
  const titleSize =
    card.title.length > 120
      ? 44
      : card.title.length > 80
        ? 54
        : card.titleFontSize;
  const artistSize = card.artist.length > 100 ? 27 : 36;
  const themeSize = card.themeName.length > 90 ? 28 : 36;

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: brandColors.background,
        color: brandColors.text,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        padding: "64px 72px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: 12,
          background: brandColors.brand,
          display: "flex",
        }}
      />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          width: "100%",
          gap: 22,
        }}
      >
        <BrandMark size={100} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1 }}>
            {siteConfig.name.toUpperCase()}
          </span>
          <span
            style={{
              color: brandColors.brand,
              fontSize: 21,
              letterSpacing: 4,
              marginTop: 8,
            }}
          >
            A ÚLTIMA FAIXA É A CAMPEÃ
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          marginTop: 42,
        }}
      >
        <span
          style={{
            color: brandColors.brand,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 5,
          }}
        >
          MÚSICA CAMPEÃ
        </span>
        <span
          style={{
            fontSize: themeSize,
            color: brandColors.muted,
            lineHeight: 1.15,
            marginTop: 14,
            width: "100%",
            textAlign: "center",
            wordBreak: "break-word",
          }}
        >
          {card.themeName}
        </span>
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 600,
          height: 600,
          marginTop: 30,
          flexShrink: 0,
        }}
      >
        <RecordGrooves />
        <div
          style={{
            display: "flex",
            position: "absolute",
            width: 240,
            height: 240,
            borderRadius: 120,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: brandColors.background,
          }}
        >
          {card.thumbnailUrl ? (
            // The share projection restricts the image URL to approved public hosts.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              src={card.thumbnailUrl}
              width={240}
              height={240}
              style={{ width: 240, height: 240, objectFit: "cover" }}
            />
          ) : (
            <BrandMark size={170} />
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          marginTop: 14,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 90,
            height: 26,
            background: "#242A32",
          }}
        />
        <div
          style={{
            display: "flex",
            width: 150,
            height: 48,
            background: brandColors.brand,
          }}
        />
        <div
          style={{
            display: "flex",
            width: 90,
            height: 18,
            background: "#242A32",
          }}
        />
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          marginTop: 30,
          width: "100%",
        }}
      >
        <span
          style={{
            fontSize: titleSize,
            fontWeight: 900,
            letterSpacing: -1,
            lineHeight: 1.05,
            width: "100%",
            textAlign: "center",
            wordBreak: "break-word",
          }}
        >
          {card.title}
        </span>
        <span
          style={{
            color: brandColors.muted,
            fontSize: artistSize,
            lineHeight: 1.15,
            marginTop: 18,
            width: "100%",
            textAlign: "center",
            wordBreak: "break-word",
          }}
        >
          {card.artist}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          borderTop: "2px solid #343A43",
          marginTop: "auto",
          paddingTop: 26,
          width: "100%",
        }}
      >
        <span
          style={{ fontSize: 24, color: brandColors.brand, fontWeight: 800 }}
        >
          Elejam a melhor música. Guardem este resultado.
        </span>
        <span
          style={{
            color: brandColors.muted,
            fontSize: 20,
            lineHeight: 1.2,
            marginTop: 14,
            textAlign: "center",
            width: "100%",
            wordBreak: "break-all",
          }}
        >
          {card.resultUrl}
        </span>
      </div>
    </div>,
    { width: 1080, height: 1920, headers },
  );
}
