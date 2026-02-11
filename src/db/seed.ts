import "dotenv/config";
import { db } from "./index";
import { users } from "./schema";
import { hash } from "bcryptjs";

const ADMIN_EMAIL = "admin@vulpeinc.com";
const ADMIN_PASSWORD = "admin123"; // trocar em produção
const USER_EMAIL = "user@vulpeinc.com";
const USER_PASSWORD = "user123"; // trocar em produção

async function seed() {
  const existingAdmin = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, ADMIN_EMAIL),
  });

  if (existingAdmin) {
    console.log("Seed já executado. Usuários existem.");
    process.exit(0);
    return;
  }

  const [adminHash, userHash] = await Promise.all([
    hash(ADMIN_PASSWORD, 10),
    hash(USER_PASSWORD, 10),
  ]);

  await db.insert(users).values([
    {
      email: ADMIN_EMAIL,
      passwordHash: adminHash,
      name: "Admin Vulpeinc",
      role: "admin",
    },
    {
      email: USER_EMAIL,
      passwordHash: userHash,
      name: "Usuário Vulpeinc",
      role: "user",
    },
  ]);

  console.log("Seed concluído:");
  console.log(`  Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  User:  ${USER_EMAIL} / ${USER_PASSWORD}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
