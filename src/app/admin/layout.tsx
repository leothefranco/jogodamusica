import type { Metadata, Viewport } from "next";

const adminName = "Jogo da Música Admin";

export const metadata: Metadata = {
  title: {
    absolute: adminName,
  },
  description: "Administre temas e músicas do Jogo da Música.",
  applicationName: adminName,
  manifest: "/admin/manifest.webmanifest",
  icons: {
    icon: [
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
        url: "/icons/admin-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: adminName,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#059669",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
