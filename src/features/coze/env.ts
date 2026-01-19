export function readEnv(key: string): string | undefined {
  const value = process.env[key]
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function readEnvInt(key: string): number | undefined {
  const raw = readEnv(key)
  if (!raw) return undefined
  const num = Number(raw)
  if (!Number.isFinite(num)) return undefined
  return Math.trunc(num)
}
