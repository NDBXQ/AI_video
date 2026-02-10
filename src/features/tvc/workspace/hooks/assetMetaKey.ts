function normalizePart(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
}

export function buildAssetMetaKey(kind: string, parts: unknown[]): string {
  const encoded = parts.map((p) => encodeURIComponent(normalizePart(p))).join("|")
  return `${kind}:meta:${encoded}`
}
