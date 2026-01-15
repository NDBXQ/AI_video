import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.PGDATABASE_URL ?? ""
  },
  verbose: false,
  strict: true
})

