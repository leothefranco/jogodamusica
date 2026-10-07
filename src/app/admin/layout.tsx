import type { Metadata, Viewport } from "next";

import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: siteConfig.adminName,
  },
  description: `Administre temas e músicas do ${siteConfig.name}.`,
  applicationName: siteConfig.adminName,
  manifest: "/admin/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/admin-icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/admin-icon-32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/icons/admin-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/admin-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/admin-apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteConfig.adminShortName,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#181C22",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
