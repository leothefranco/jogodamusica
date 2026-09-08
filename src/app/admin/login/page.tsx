import Link from "next/link";
import { AudioLines, Database, ShieldCheck } from "lucide-react";

import { getOptionalPublicSupabaseEnv } from "@/lib/public-env";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  const configured = Boolean(getOptionalPublicSupabaseEnv());

  return (
    <main className="grid min-h-screen bg-[var(--app-bg)] text-white lg:grid-cols-[1fr_1.05fr]">
      <section className="relative hidden overflow-hidden border-r border-white/8 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="grid-fade pointer-events-none absolute inset-0 opacity-45" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 bottom-28 grid h-1 grid-cols-2 gap-2"
        >
          <span className="bg-[var(--duel-a)]" />
          <span className="bg-[var(--duel-b)]" />
        </div>

        <Link
          href="/"
          className="relative flex w-fit items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--duel-a)]"
        >
          <span className="grid size-10 place-items-center rounded-md border border-[var(--duel-a)]/25 bg-[var(--duel-a)]/10 text-[var(--duel-a)]">
            <AudioLines className="size-5" aria-hidden="true" />
          </span>
          <span className="font-bold">Jogo da Música</span>
        </Link>

        <div className="relative max-w-lg">
          <p className="text-xs font-bold tracking-[0.2em] text-[var(--duel-a)] uppercase">
            Área protegida
          </p>
          <h1 className="mt-4 text-5xl leading-[1.02] font-black tracking-[-0.045em]">
            Temas prontos para o próximo duelo.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[var(--app-muted)]">
            Organize os temas e prepare as músicas que vão disputar cada
            partida.
          </p>
        </div>

        <p className="relative text-xs text-white/30">
          Acesso exclusivo para administradores autorizados
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md border-t-4 border-[var(--duel-b)] pt-6">
          <Link
            href="/"
            className="mb-12 flex w-fit items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--duel-a)] lg:hidden"
          >
            <span className="grid size-10 place-items-center rounded-md border border-[var(--duel-a)]/25 bg-[var(--duel-a)]/10 text-[var(--duel-a)]">
              <AudioLines className="size-5" aria-hidden="true" />
            </span>
            <span className="font-bold">Jogo da Música</span>
          </Link>

          <div className="flex size-12 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[var(--duel-a)]">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-6 text-3xl font-black tracking-tight">
            Acesse o painel
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
            Entre com uma conta autorizada para administrar temas e músicas.
          </p>

          {!configured ? (
            <div className="mt-6 flex gap-3 rounded-md border border-amber-300/15 bg-amber-300/[0.06] p-4 text-amber-100">
              <Database className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">Configuração pendente</p>
                <p className="mt-1 text-sm leading-6 text-amber-100/65">
                  Crie o projeto Supabase e preencha o arquivo{" "}
                  <code>.env.local</code> para liberar o login.
                </p>
              </div>
            </div>
          ) : null}

          <LoginForm configured={configured} />

          <p className="mt-6 text-center text-xs text-white/30">
            O acesso é concedido pela equipe responsável pelo catálogo.
          </p>
        </div>
      </section>
    </main>
  );
}
