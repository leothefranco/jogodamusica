import type { AdminProfile } from "@/db/schema";

export type VerifiedClaims = {
  sub?: string;
  email?: unknown;
};

export type AdminUser = {
  userId: string;
  email: string;
  displayName: string;
  role: AdminProfile["role"];
};

export function resolveAdminUser(
  claims: VerifiedClaims | null,
  profile: AdminProfile | null,
): AdminUser | null {
  if (!claims?.sub || !profile?.isActive || profile.userId !== claims.sub) {
    return null;
  }

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    displayName: profile.displayName,
    role: profile.role,
  };
}
