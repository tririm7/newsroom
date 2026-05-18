// Drizzle Kit config — used for generating future migrations.
// The initial schema (drizzle/0000_initial.sql) is applied by Postgres on
// first boot via /docker-entrypoint-initdb.d/.
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
