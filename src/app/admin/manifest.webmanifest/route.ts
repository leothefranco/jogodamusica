import { createAdminManifest } from "@/lib/pwa-manifest";

export function GET() {
  return Response.json(createAdminManifest(), {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
}
