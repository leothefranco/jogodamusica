import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicThemeExperience } from "@/components/public-theme-experience";
import { getPublicTheme } from "@/server/services/public-theme-service";
type ThemePageProps = { params: Promise<{ slug: string }> };
export async function generateMetadata({
  params,
}: ThemePageProps): Promise<Metadata> {
  const theme = await getPublicTheme((await params).slug);
  return theme
    ? { title: theme.name, description: theme.description }
    : { title: "Tema não encontrado" };
}
export default async function ThemePage({ params }: ThemePageProps) {
  const theme = await getPublicTheme((await params).slug);
  if (!theme) notFound();
  return <PublicThemeExperience theme={theme} />;
}
