import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ThemeFormFixture } from "@/app/e2e-test/theme-form/theme-form-fixture";

export default async function ThemeFormFixturePage() {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-e2e-test") !== "theme-form") notFound();

  return <ThemeFormFixture />;
}
