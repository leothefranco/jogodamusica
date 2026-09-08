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
        fill="#F5F3ED"
        stroke="#101216"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M17 58h34"
        stroke="#F5F3ED"
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
        stroke="#38BDF8"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="15" cy="42" rx="9" ry="7" fill="#38BDF8" />
      <ellipse cx="39" cy="38" rx="9" ry="7" fill="#38BDF8" />
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
        background: "#101216",
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
          background: "#38BDF8",
          border: "0px solid transparent",
          borderRadius: 0,
          display: "flex",
          height: 12,
          position: "absolute",
          right: 0,
          top: 0,
          width: "50%",
        }}
      />
      <div
        style={{
          background: "#FF923D",
          borderRadius: 0,
          top: 0,
          display: "flex",
          height: 12,
          left: 0,
          position: "absolute",
          width: "50%",
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
              background: "#181C22",
              border: "2px solid #38BDF8",
              borderRadius: 0,
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
                color: "#38BDF8",
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
            background: "#181C22",
            border: "2px solid #FF923D",
            borderRadius: 0,
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
            color: "#FF923D",
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
            color: "#F5F3ED",
            fontSize: 43,
            fontWeight: 900,
            letterSpacing: 6,
            marginTop: 24,
          }}
        >
          MÚSICA CAMPEÃ
        </span>
      </div>

      <div
        style={{
          background: "rgba(255, 255, 255, 0.035)",
          border: "3px solid #F5F3ED",
          borderRadius: 0,
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
              borderRadius: 0,
              height: "100%",
              objectFit: "cover",
              width: "100%",
            }}
          />
        ) : (
          <div
            style={{
              alignItems: "center",
              background:
                "linear-gradient(135deg, #38BDF8 0%, #38BDF8 50%, #FF923D 50%, #FF923D 100%)",
              borderRadius: 0,
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
            background: "#181C22",
            borderRadius: 0,
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
          Elejam a melhor música.
        </span>
        <span
          style={{
            color: "#FF923D",
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
