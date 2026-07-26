import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { adminProfiles } from "@/db/schema";

export async function findAdminProfile(userId: string) {
  const [profile] = await getDatabase()
    .select()
    .from(adminProfiles)
    .where(eq(adminProfiles.userId, userId))
    .limit(1);

  return profile ?? null;
}
