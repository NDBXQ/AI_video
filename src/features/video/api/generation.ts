import type { StoryboardItem } from "../types"
import { normalizeShotsToItems } from "../utils/storyboardUtils"
import type { ApiErr, ApiOk } from "@/shared/api"

/**
 * Generate storyboard text for a given outline.
 */
export async function generateStoryboardText(outlineId: string, outline: string, original: string): Promise<void> {
  const res = await fetch("/api/coze/storyboard/generate-storyboard-text", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      outlineId,
      outline,
      original
    })
  })

  const json = (await res.json()) as ApiOk<unknown> | ApiErr
  if (!res.ok || !json || (json as ApiErr).ok === false) {
    const errJson = json as ApiErr
    throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
  }
}

/**
 * Fetch storyboards for a given story and outline.
 */
export async function fetchStoryboards(storyId: string, outlineId: string): Promise<StoryboardItem[]> {
  const qs = new URLSearchParams({ storyId, outlineId })
  const res = await fetch(`/api/video/storyboards?${qs.toString()}`, { cache: "no-store" })
  const json = (await res.json()) as { ok: boolean; data?: any }
  if (!res.ok || !json?.ok || !json.data?.shots || !Array.isArray(json.data.shots)) return []
  return normalizeShotsToItems(json.data.shots)
}

/**
 * Generate image for a storyboard item.
 */
export async function generateStoryboardImage(storyId: string, storyboardId: string, prompt: string): Promise<boolean> {
  try {
    const res = await fetch("/api/coze/storyboard/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        storyboardId,
        prompt
      })
    })
    let json: ApiOk<unknown> | ApiErr | null = null
    try {
      json = (await res.json()) as ApiOk<unknown> | ApiErr
    } catch {
      json = null
    }
    return Boolean(res.ok && json && (json as ApiErr).ok !== false)
  } catch {
    return false
  }
}

/**
 * Generate prompts for a storyboard item.
 */
export async function generateStoryboardPrompts(storyboardId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/coze/storyboard/generate-prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyboardId })
    })
    let json: ApiOk<unknown> | ApiErr | null = null
    try {
      json = (await res.json()) as ApiOk<unknown> | ApiErr
    } catch {
      json = null
    }
    return Boolean(res.ok && json && (json as ApiErr).ok !== false)
  } catch {
    return false
  }
}
