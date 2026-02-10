import "server-only"

function normalizePgSslmodeInEnv(): void {
  const keys = ["PGDATABASE_URL", "DATABASE_URL", "POSTGRES_URL"] as const
  for (const key of keys) {
    const raw = process.env[key]
    if (!raw) continue

    const trimmed = raw.trim()
    if (!trimmed) continue

    try {
      const url = new URL(trimmed)

      const compat = (url.searchParams.get("uselibpqcompat") ?? "").toLowerCase()
      if (compat === "true") continue

      const sslmode = (url.searchParams.get("sslmode") ?? "").toLowerCase()
      if (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca") {
        url.searchParams.set("sslmode", "verify-full")
        process.env[key] = url.toString()
      }
    } catch {
    }
  }
}

export async function getDb(...args: Parameters<(typeof import("coze-coding-dev-sdk"))["getDb"]>): ReturnType<(typeof import("coze-coding-dev-sdk"))["getDb"]> {
  normalizePgSslmodeInEnv()
  const sdk = await import("coze-coding-dev-sdk")
  return sdk.getDb(...args)
}
