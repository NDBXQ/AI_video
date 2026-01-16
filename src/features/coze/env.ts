export function readEnv(key: string): string | undefined {
  const value = process.env[key]
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

