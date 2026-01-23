import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.PGDATABASE_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? ""
  },
  verbose: false,
  strict: true
})
