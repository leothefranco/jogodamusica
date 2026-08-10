import { ImageResponse } from "next/og";

import type { ResultShareCard } from "@/domain/game/result-share-card";

const size = {
  height: 1920,
  width: 1080,
};

function CrownIcon() {
  return (
    <svg
      width="68"
      height="68"
      viewBox="0 0 68 68"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 22 23 36 34 14l11 22 13-14-5 31H15l-5-31Z"
        fill="#FDE68A"
        stroke="#F59E0B"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M17 58h34"
        stroke="#FDE68A"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MusicMark() {
  return (
    <svg
      width="58"
      height="58"
      viewBox="0 0 58 58"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M23 39.5V14l24-5v26.5M23 20l24-5"
        stroke="#DDD6FE"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="15" cy="42" rx="9" ry="7" fill="#A78BFA" />
      <ellipse cx="39" cy="38" rx="9" ry="7" fill="#A78BFA" />
    </svg>
  );
}

export function createResultStoryImage(
  card: ResultShareCard,
  headers?: Record<string, string>,
) {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at 50% 28%, #31205e 0%, #151026 36%, #08080f 72%)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        padding: "78px 70px 64px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "rgba(167, 139, 250, 0.16)",
          border: "2px solid rgba(196, 181, 253, 0.22)",
          borderRadius: 999,
          display: "flex",
          height: 470,
          position: "absolute",
          right: -260,
          top: 300,
          width: 470,
        }}
      />
      <div
        style={{
          background: "rgba(251, 191, 36, 0.09)",
          borderRadius: 999,
          bottom: 180,
          display: "flex",
          height: 380,
          left: -250,
          position: "absolute",
          width: 380,
        }}
      />

      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex" }}>
          <div
            style={{
              alignItems: "center",
              background: "rgba(139, 92, 246, 0.2)",
              border: "2px solid rgba(196, 181, 253, 0.25)",
              borderRadius: 22,
              display: "flex",
              height: 82,
              justifyContent: "center",
              width: 82,
            }}
          >
            <MusicMark />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: 22,
            }}
          >
            <span
              style={{
                fontSize: 29,
                fontWeight: 800,
                letterSpacing: 3,
              }}
            >
              JOGO DA MÚSICA
            </span>
            <span
              style={{
                color: "#A78BFA",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 2,
                marginTop: 5,
              }}
            >
              RESULTADO FINAL
            </span>
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            background: "rgba(251, 191, 36, 0.12)",
            border: "2px solid rgba(253, 230, 138, 0.25)",
            borderRadius: 22,
            display: "flex",
            height: 82,
            justifyContent: "center",
            width: 82,
          }}
        >
          <CrownIcon />
        </div>
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          marginTop: 105,
          width: "100%",
        }}
      >
        <span
          style={{
            color: "#C4B5FD",
            fontSize: 25,
            fontWeight: 800,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          CAMPEÃ DE {card.themeName}
        </span>
        <span
          style={{
            color: "#FDE68A",
            fontSize: 43,
            fontWeight: 900,
            letterSpacing: 6,
            marginTop: 24,
          }}
        >
          A ESCOLHIDA
        </span>
      </div>

      <div
        style={{
          background: "rgba(255, 255, 255, 0.035)",
          border: "3px solid rgba(253, 230, 138, 0.3)",
          borderRadius: 54,
          boxShadow: "0 30px 90px rgba(0, 0, 0, 0.5)",
          display: "flex",
          height: 770,
          marginTop: 50,
          overflow: "hidden",
          padding: 14,
          position: "relative",
          width: 770,
        }}
      >
        {card.thumbnailUrl ? (
          // The URL is restricted to the same image hosts allowed by the app.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            src={card.thumbnailUrl}
            style={{
              borderRadius: 40,
              height: "100%",
              objectFit: "cover",
              width: "100%",
            }}
          />
        ) : (
          <div
            style={{
              alignItems: "center",
              background: "linear-gradient(145deg, #4C1D95, #111827)",
              borderRadius: 40,
              display: "flex",
              height: "100%",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <MusicMark />
          </div>
        )}
        <div
          style={{
            alignItems: "center",
            background: "#FDE68A",
            borderRadius: 999,
            bottom: 35,
            display: "flex",
            height: 100,
            justifyContent: "center",
            position: "absolute",
            right: 35,
            width: 100,
          }}
        >
          <CrownIcon />
        </div>
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          marginTop: 54,
          width: "100%",
        }}
      >
        <span
          style={{
            fontSize: card.titleFontSize,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.02,
            maxWidth: 930,
            textAlign: "center",
          }}
        >
          {card.title}
        </span>
        <span
          style={{
            color: "rgba(255, 255, 255, 0.62)",
            fontSize: 37,
            fontWeight: 600,
            marginTop: 20,
            textAlign: "center",
          }}
        >
          {card.artist}
        </span>
      </div>

      <div
        style={{
          alignItems: "center",
          borderTop: "2px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          justifyContent: "space-between",
          marginTop: "auto",
          paddingTop: 35,
          width: "100%",
        }}
      >
        <span
          style={{
            color: "rgba(255, 255, 255, 0.55)",
            fontSize: 23,
            fontWeight: 600,
          }}
        >
          Uma disputa. Um aparelho. Uma campeã.
        </span>
        <span
          style={{
            color: "#C4B5FD",
            fontSize: 25,
            fontWeight: 800,
          }}
        >
          {card.siteLabel}
        </span>
      </div>
    </div>,
    {
      ...size,
      headers,
    },
  );
}
