import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { HomeExperience } from "@/components/home-experience";

export default async function HomeVisualFixture() {
  if (
    process.env.E2E_TEST_MODE !== "1" ||
    (await headers()).get("x-e2e-test") !== "home-visual"
  )
    notFound();
  return (
    <HomeExperience
      themes={[
        {
          id: "visual-rock",
          name: "Clássicos do rock",
          slug: "classicos-do-rock",
          description: "Guitarras marcantes e refrões para cantar junto.",
          coverUrl: null,
          thumbnailUrls: [],
          activeSongCount: 64,
          supportedBracketSizes: [4, 8, 16, 32, 64],
        },
        {
          id: "visual-pop",
          name: "Pop para cantar junto",
          slug: "pop",
          description:
            "Os hits que não saem da cabeça. Qual deles leva a coroa?",
          coverUrl: null,
          thumbnailUrls: [],
          activeSongCount: 32,
          supportedBracketSizes: [4, 8, 16, 32],
        },
        {
          id: "visual-brasil",
          name: "Feito no Brasil",
          slug: "brasil",
          description: "Uma disputa com a trilha sonora da nossa vida.",
          coverUrl: null,
          thumbnailUrls: [],
          activeSongCount: 32,
          supportedBracketSizes: [4, 8, 16, 32],
        },
      ]}
    />
  );
}
