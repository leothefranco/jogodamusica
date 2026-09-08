import { HomeExperience } from "@/components/home-experience";
import { getPublicThemes } from "@/server/services/public-theme-service";

export default async function HomePage() {
  return <HomeExperience themes={await getPublicThemes()} />;
}
