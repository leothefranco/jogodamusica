import { HomeExperience } from "@/components/home-experience";
import { parsePublicCatalogPage } from "@/server/services/public-theme-service";
import { getFixture } from "./fixture.e2e";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { catalog } = await getFixture();
  const page = parsePublicCatalogPage((await searchParams).page);
  const result = await catalog.listPage(page);
  return (
    <HomeExperience
      themes={result.themes}
      nextPage={result.nextPage}
      catalogPage={page}
    />
  );
}
