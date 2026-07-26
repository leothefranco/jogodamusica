import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getOptionalPublicSupabaseEnv } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/server";
import {
  resolveAdminUser,
  type AdminUser,
  type VerifiedClaims,
} from "@/server/auth/authorization";
import { findAdminProfile } from "@/server/repositories/admin-profile-repository";

export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  if (!getOptionalPublicSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return null;
  }

  const profile = await findAdminProfile(claims.sub);

  return resolveAdminUser(claims as VerifiedClaims, profile);
});

export const requireAdmin = cache(async (): Promise<AdminUser> => {
  const admin = await getAdminUser();

  if (!admin) {
    redirect("/admin/login");
  }

  return admin;
});
