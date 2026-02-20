import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "dotenv";
import * as schema from "./schema";
import { debugDbInfo } from "@/lib/db/debugDbInfo";

config({ path: ".env.local" });
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definida. Configure em .env ou .env.local");
}

debugDbInfo();

export const db = drizzle(connectionString, { schema });
