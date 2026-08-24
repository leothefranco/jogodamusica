import { closeDatabaseConnection, getDatabase } from "@/db/runtime";
import { adminProfiles } from "@/db/schema";
import { seedDatabase, type AdminSeed } from "@/db/seed-service";
import { getSeedEnv } from "@/lib/env-runtime";

process.loadEnvFile(".env.local");

async function main() {
  const database = getDatabase();
  const seedEnv = getSeedEnv();
  const admin: AdminSeed | null = seedEnv.SEED_ADMIN_USER_ID
    ? {
        userId: seedEnv.SEED_ADMIN_USER_ID,
        displayName: seedEnv.SEED_ADMIN_DISPLAY_NAME,
        role: "admin",
        isActive: true,
      }
    : null;

  await database.transaction(async (transaction) => {
    await seedDatabase(
      {
        async upsertAdmin(adminSeed) {
          await transaction
            .insert(adminProfiles)
            .values(adminSeed)
            .onConflictDoUpdate({
              target: adminProfiles.userId,
              set: {
                displayName: adminSeed.displayName,
                role: adminSeed.role,
                isActive: adminSeed.isActive,
                updatedAt: new Date(),
              },
            });
        },
      },
      admin,
    );
  });

  console.log("Seed concluído.");
  console.log(
    admin
      ? `Administrador garantido: ${admin.displayName}`
      : "Administrador não informado; defina SEED_ADMIN_USER_ID para criá-lo.",
  );
}

main()
  .catch((error: unknown) => {
    console.error("Falha ao executar o seed.", error);
    process.exitCode = 1;
  })
  .finally(closeDatabaseConnection);
