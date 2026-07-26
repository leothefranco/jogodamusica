"use client";

import { useActionState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

import { loginAction } from "./actions";
import { initialLoginState } from "./login-state";

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialLoginState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-semibold text-white/80"
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          disabled={!configured || pending}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={
            state.fieldErrors?.email ? "email-error" : undefined
          }
          className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-base text-white transition outline-none placeholder:text-white/25 focus:border-violet-300/50 focus:ring-3 focus:ring-violet-300/15 disabled:cursor-not-allowed disabled:opacity-55"
          placeholder="admin@exemplo.com"
        />
        {state.fieldErrors?.email?.[0] ? (
          <p id="email-error" className="mt-2 text-sm text-rose-300">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-semibold text-white/80"
        >
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          disabled={!configured || pending}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-base text-white transition outline-none placeholder:text-white/25 focus:border-violet-300/50 focus:ring-3 focus:ring-violet-300/15 disabled:cursor-not-allowed disabled:opacity-55"
          placeholder="Sua senha"
        />
        {state.fieldErrors?.password?.[0] ? (
          <p id="password-error" className="mt-2 text-sm text-rose-300">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-300/15 bg-rose-300/[0.07] px-4 py-3 text-sm leading-6 text-rose-200"
        >
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={!configured || pending}
        className="min-h-12 w-full rounded-xl bg-violet-400 text-sm font-bold text-[#130d22] hover:bg-violet-300"
      >
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <LogIn aria-hidden="true" />
        )}
        {pending ? "Entrando..." : "Entrar no painel"}
      </Button>
    </form>
  );
}
