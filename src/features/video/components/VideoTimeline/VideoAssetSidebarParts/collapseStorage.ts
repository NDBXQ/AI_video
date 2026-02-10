export function buildCollapsedStorageKey(params: { tab: "video" | "audio" | "image"; block: "script" | "library" }): string {
  return `video-asset-sidebar:collapsed:${params.tab}:${params.block}`
}

export function readCollapsedState(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return defaultValue
    if (raw === "1") return true
    if (raw === "0") return false
    return defaultValue
  } catch {
    return defaultValue
  }
}

export function writeCollapsedState(key: string, value: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, value ? "1" : "0")
    window.dispatchEvent(new Event("video-asset-sidebar:collapsed"))
  } catch {}
}
