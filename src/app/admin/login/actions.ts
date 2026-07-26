"use server";

import { redirect } from "next/navigation";

import { getOptionalPublicSupabaseEnv } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/server/auth/validation";
import { findAdminProfile } from "@/server/repositories/admin-profile-repository";

import type { LoginState } from "./login-state";

const genericLoginError =
  "Não foi possível entrar. Verifique as credenciais e o acesso administrativo.";

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!getOptionalPublicSupabaseEnv()) {
    return {
      status: "error",
      message: "A conexão com o Supabase ainda não foi configurada.",
      fieldErrors: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return {
      status: "error",
      message: genericLoginError,
      fieldErrors: null,
    };
  }

  try {
    const profile = await findAdminProfile(data.user.id);

    if (!profile?.isActive) {
      await supabase.auth.signOut();

      return {
        status: "error",
        message: genericLoginError,
        fieldErrors: null,
      };
    }
  } catch (error: unknown) {
    console.error("Falha ao validar perfil administrativo.", error);
    await supabase.auth.signOut();

    return {
      status: "error",
      message: genericLoginError,
      fieldErrors: null,
    };
  }

  redirect("/admin");
}

export async function logoutAction() {
  if (getOptionalPublicSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/admin/login");
}
