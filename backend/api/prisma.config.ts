// Prisma configuration file
// npm install --save-dev prisma dotenv
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Must match docker-compose.yml PostgreSQL settings
    url: process.env["DATABASE_URL"] || "postgresql://nexusmind:nexusmind_secret@localhost:5432/nexusmind_db",
  },
});
