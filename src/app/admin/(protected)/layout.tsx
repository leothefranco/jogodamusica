import Link from "next/link";
import { LayoutDashboard, Library, LogOut } from "lucide-react";

import { logoutAction } from "@/app/admin/login/actions";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { requireAdmin } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen border-t-4 border-[var(--brand)] bg-[var(--app-bg)] text-white">
      <header className="border-b border-white/8 bg-[var(--app-surface)]/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href="/admin"
            className="flex min-h-11 items-center gap-3 rounded-md pr-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
          >
            <span className="grid size-9 place-items-center">
              <BrandMark size={36} />
            </span>
            <span className="text-sm font-bold">
              {siteConfig.shortName}{" "}
              <span className="block text-xs text-[var(--brand)]">/ Admin</span>
            </span>
          </Link>

          <nav aria-label="Administração" className="flex items-center gap-1">
            <Link
              href="/admin"
              aria-label="Visão geral"
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-bold text-[var(--app-muted)] outline-none hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
            >
              <LayoutDashboard className="size-4" aria-hidden="true" />
              <span className="hidden md:inline">Visão geral</span>
            </Link>
            <Link
              href="/admin/temas"
              aria-label="Temas"
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-bold text-[var(--app-muted)] outline-none hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
            >
              <Library className="size-4" aria-hidden="true" />
              <span className="hidden md:inline">Temas</span>
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold">{admin.displayName}</p>
              <p className="mt-0.5 text-[0.65rem] text-[var(--app-muted)]">
                {admin.email || admin.role}
              </p>
            </div>
            <form action={logoutAction}>
              <Button
                type="submit"
                aria-label="Sair"
                variant="outline"
                size="lg"
                className="min-h-11 rounded-md border-white/10 bg-white/[0.035]"
              >
                <LogOut aria-hidden="true" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
