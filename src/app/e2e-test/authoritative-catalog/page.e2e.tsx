import { HomeExperience } from "@/components/home-experience";
import { parsePublicCatalogPage } from "@/server/services/public-theme-service";
import { catalogFixture } from "./fixture.e2e";

export default async function CatalogFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const service = await catalogFixture();
  const page = parsePublicCatalogPage((await searchParams).page);
  const result = await service.listPage(page);
  return (
    <HomeExperience
      themes={result.themes}
      nextPage={result.nextPage}
      catalogPage={page}
    />
  );
}
