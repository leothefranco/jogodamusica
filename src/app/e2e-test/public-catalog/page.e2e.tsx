import Link from "next/link";

import {
  listCatalogThemes,
  requirePublicCatalogFixture,
} from "@/app/e2e-test/public-catalog/catalog-fixture.e2e";

export default async function PublicCatalogFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  await requirePublicCatalogFixture();
  const [themes, { created }] = await Promise.all([
    listCatalogThemes(),
    searchParams,
  ]);

  return (
    <main>
      <h1>Temas disponíveis</h1>
      {created === "1" ? (
        <p role="status">Partida criada com quatro snapshots</p>
      ) : null}
      <ul>
        {themes.map((theme) => (
          <li key={theme.id}>
            <Link href={`/e2e-test/public-catalog/${theme.slug}`}>
              {theme.name} · {theme.activeSongCount} músicas
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
