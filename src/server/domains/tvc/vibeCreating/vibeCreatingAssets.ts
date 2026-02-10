import type { VibeSessionState } from "./vibeCreatingState"

function ensureAssets(state: VibeSessionState): NonNullable<VibeSessionState["assets"]> {
  const assets = state.assets ?? {}
  if (!assets.referenceImages) assets.referenceImages = {}
  if (!assets.firstFrames) assets.firstFrames = {}
  if (!assets.videoClips) assets.videoClips = {}
  if (!assets.nextReferenceImageIndex || assets.nextReferenceImageIndex < 1) assets.nextReferenceImageIndex = 1
  if (!assets.nextFirstFrameIndex || assets.nextFirstFrameIndex < 1) assets.nextFirstFrameIndex = 1
  if (!assets.nextVideoIndex || assets.nextVideoIndex < 1) assets.nextVideoIndex = 1
  return assets
}

function findReferenceIndexByUrl(referenceImages: Record<string, { url: string }>, url: string): number | null {
  const target = url.trim()
  if (!target) return null
  for (const [k, v] of Object.entries(referenceImages)) {
    const idx = Number(k)
    if (!Number.isFinite(idx)) continue
    if ((v?.url ?? "").trim() === target) return Math.trunc(idx)
  }
  return null
}

export function upsertUserProductImages(state: VibeSessionState, urls: string[]): { nextState: VibeSessionState; indices: number[] } {
  const assets = ensureAssets(state)
  const referenceImages = assets.referenceImages!
  const indices: number[] = []

  for (const raw of urls) {
    const url = String(raw ?? "").trim()
    if (!url) continue
    const existing = findReferenceIndexByUrl(referenceImages, url)
    if (existing != null) {
      indices.push(existing)
      continue
    }
    const idx = assets.nextReferenceImageIndex!
    assets.nextReferenceImageIndex = idx + 1
    referenceImages[String(idx)] = { url, category: "product", name: "产品图", description: "产品图" }
    indices.push(idx)
  }

  return { nextState: { ...state, assets }, indices }
}

export function addGeneratedReferenceImage(
  state: VibeSessionState,
  input: { url: string; category: string; name: string; description: string }
): { nextState: VibeSessionState; index: number } {
  const assets = ensureAssets(state)
  const idx = assets.nextReferenceImageIndex!
  assets.nextReferenceImageIndex = idx + 1
  assets.referenceImages![String(idx)] = {
    url: input.url,
    category: input.category,
    name: input.name,
    description: input.description
  }
  return { nextState: { ...state, assets }, index: idx }
}

export function upsertGeneratedReferenceImageAtIndex(
  state: VibeSessionState,
  input: { index: number; url: string; category: string; name: string; description: string }
): { nextState: VibeSessionState; index: number } {
  const assets = ensureAssets(state)
  const idx = Math.max(1, Math.trunc(input.index))
  assets.referenceImages![String(idx)] = {
    url: input.url,
    category: input.category,
    name: input.name,
    description: input.description
  }
  const next = Number(assets.nextReferenceImageIndex ?? 1)
  assets.nextReferenceImageIndex = Math.max(next, idx + 1)
  return { nextState: { ...state, assets }, index: idx }
}

export function addFirstFrame(
  state: VibeSessionState,
  input: { url: string; description: string; referenceImages: string }
): { nextState: VibeSessionState; index: number } {
  const assets = ensureAssets(state)
  const idx = assets.nextFirstFrameIndex!
  assets.nextFirstFrameIndex = idx + 1
  assets.firstFrames![String(idx)] = { url: input.url, description: input.description, referenceImages: input.referenceImages }
  return { nextState: { ...state, assets }, index: idx }
}

export function addVideoClip(
  state: VibeSessionState,
  input: { url: string; description: string; durationSeconds: number; firstFrameIndex: number; lastFrameUrl?: string }
): { nextState: VibeSessionState; index: number } {
  const assets = ensureAssets(state)
  const idx = assets.nextVideoIndex!
  assets.nextVideoIndex = idx + 1
  assets.videoClips![String(idx)] = {
    url: input.url,
    description: input.description,
    durationSeconds: input.durationSeconds,
    firstFrameIndex: input.firstFrameIndex,
    ...(input.lastFrameUrl ? { lastFrameUrl: input.lastFrameUrl } : {})
  }
  return { nextState: { ...state, assets }, index: idx }
}

export function resolveAssetUrl(state: VibeSessionState, kind: "reference_image" | "first_frame" | "video_clip", index: number): string {
  const assets = ensureAssets(state)
  const key = String(Math.trunc(index))
  if (kind === "reference_image") return String(assets.referenceImages?.[key]?.url ?? "")
  if (kind === "first_frame") return String(assets.firstFrames?.[key]?.url ?? "")
  return String(assets.videoClips?.[key]?.url ?? "")
}
