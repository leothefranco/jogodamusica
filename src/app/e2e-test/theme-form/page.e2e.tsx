import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ThemeFormFixture } from "@/app/e2e-test/theme-form/theme-form-fixture";

export default async function ThemeFormFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ uploadFailure?: string }>;
}) {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-e2e-test") !== "theme-form") notFound();
  const { uploadFailure } = await searchParams;

  return <ThemeFormFixture uploadFails={uploadFailure === "1"} />;
}
