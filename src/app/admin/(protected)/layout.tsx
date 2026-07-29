import Link from "next/link";
import { AudioLines, LayoutDashboard, Library, LogOut } from "lucide-react";

import { logoutAction } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      <header className="border-b border-white/8 bg-[#0b0b14]/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href="/admin"
            className="flex min-h-11 items-center gap-3 rounded-xl pr-3 outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            <span className="grid size-9 place-items-center rounded-xl border border-violet-300/25 bg-violet-400/10 text-violet-200">
              <AudioLines className="size-4.5" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold">
              Jogo da Música{" "}
              <span className="hidden text-white/35 sm:inline">/ Admin</span>
            </span>
          </Link>

          <nav aria-label="Administração" className="flex items-center gap-1">
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold text-white/50 outline-none hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <LayoutDashboard className="size-4" aria-hidden="true" />
              <span className="hidden md:inline">Visão geral</span>
            </Link>
            <Link
              href="/admin/temas"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold text-white/50 outline-none hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <Library className="size-4" aria-hidden="true" />
              <span className="hidden md:inline">Temas</span>
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold">{admin.displayName}</p>
              <p className="mt-0.5 text-[0.65rem] text-white/35">
                {admin.email || admin.role}
              </p>
            </div>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="min-h-11 rounded-xl border-white/10 bg-white/[0.035]"
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
