import type { Metadata, Viewport } from "next";

import { PwaManager } from "@/components/pwa-manager";
import { siteConfig } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteConfig.shortName,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#08080f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={siteConfig.locale} className="dark h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#conteudo-principal"
          className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-lg bg-white px-4 py-3 font-bold text-black transition-transform outline-none focus:translate-y-0 focus:ring-2 focus:ring-violet-400 motion-reduce:transition-none"
        >
          Pular para o conteúdo
        </a>
        <div
          id="conteudo-principal"
          tabIndex={-1}
          className="flex flex-1 flex-col outline-none"
        >
          {children}
        </div>
        <PwaManager />
      </body>
    </html>
  );
}
