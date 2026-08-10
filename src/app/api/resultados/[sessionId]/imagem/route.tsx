import { createResultStoryImage } from "@/components/game/result-story-image";
import { createResultShareCard } from "@/domain/game/result-share-card";
import { getPublicGamePageState } from "@/app/(public)/game-page-state";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const state = await getPublicGamePageState(sessionId);
  const requestUrl = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin;
  const card = createResultShareCard(state, appUrl);

  if (!card) {
    return new Response("O resultado ainda não está disponível.", {
      status: 404,
    });
  }

  const shouldDownload = requestUrl.searchParams.get("download") === "1";

  return createResultStoryImage(card, {
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    ...(shouldDownload
      ? {
          "Content-Disposition": `attachment; filename="jogo-da-musica-${sessionId}.png"`,
        }
      : {}),
  });
}
