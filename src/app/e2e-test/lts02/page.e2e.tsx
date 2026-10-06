import { HomeExperience } from "@/components/home-experience";
import { getFixture } from "./fixture.e2e";
export default async function Page() {
  const { catalog } = await getFixture();
  return <HomeExperience themes={await catalog.listThemes()} />;
}
