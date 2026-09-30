import { HomeExperience } from "@/components/home-experience";
import {
  getPublicCatalogPage,
  parsePublicCatalogPage,
} from "@/server/services/public-theme-service";

export default async function HomePage({
  searchParams,
}: { searchParams?: Promise<{ page?: string }> } = {}) {
  const page = parsePublicCatalogPage((await searchParams)?.page);
  const result = await getPublicCatalogPage(page);
  return (
    <HomeExperience
      themes={result.themes}
      nextPage={result.nextPage}
      catalogPage={page}
    />
  );
}
