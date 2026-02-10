export function getOrCreateTvcSessionId(projectId?: string | null): string {
  return (projectId ?? "").trim() || "global"
}
