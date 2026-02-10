export type VibeSessionState = {
  currentStep: number
  productImages: string[]
  activeSkill?: string
  assets?: {
    referenceImages?: Record<string, { url: string; category: string; name: string; description: string }>
    firstFrames?: Record<string, { url: string; description: string; referenceImages: string }>
    videoClips?: Record<string, { url: string; description: string; durationSeconds: number; firstFrameIndex: number; lastFrameUrl?: string }>
    nextReferenceImageIndex?: number
    nextFirstFrameIndex?: number
    nextVideoIndex?: number
  }
  createdAt: number
  updatedAt: number
}

type VibeMetadata = {
  vibeCreating?: {
    state?: VibeSessionState
    sessions?: Record<string, VibeSessionState>
  }
}

function normalizeAssets(anyS: any): NonNullable<VibeSessionState["assets"]> {
  const assets = anyS?.assets && typeof anyS.assets === "object" ? anyS.assets : {}
  const referenceImages = assets.referenceImages && typeof assets.referenceImages === "object" ? assets.referenceImages : {}
  const firstFrames = assets.firstFrames && typeof assets.firstFrames === "object" ? assets.firstFrames : {}
  const videoClips = assets.videoClips && typeof assets.videoClips === "object" ? assets.videoClips : {}
  const nextReferenceImageIndex = Number(assets.nextReferenceImageIndex ?? 1)
  const nextFirstFrameIndex = Number(assets.nextFirstFrameIndex ?? 1)
  const nextVideoIndex = Number(assets.nextVideoIndex ?? 1)
  return {
    referenceImages: referenceImages as any,
    firstFrames: firstFrames as any,
    videoClips: videoClips as any,
    nextReferenceImageIndex: Number.isFinite(nextReferenceImageIndex) && nextReferenceImageIndex > 0 ? Math.trunc(nextReferenceImageIndex) : 1,
    nextFirstFrameIndex: Number.isFinite(nextFirstFrameIndex) && nextFirstFrameIndex > 0 ? Math.trunc(nextFirstFrameIndex) : 1,
    nextVideoIndex: Number.isFinite(nextVideoIndex) && nextVideoIndex > 0 ? Math.trunc(nextVideoIndex) : 1
  }
}

export function getVibeSessionState(metadata: Record<string, unknown>, storyId: string): VibeSessionState | null {
  const root = metadata as unknown as VibeMetadata
  const direct = root?.vibeCreating?.state
  const sessions = root?.vibeCreating?.sessions
  const s =
    direct && typeof direct === "object"
      ? direct
      : sessions && typeof sessions === "object"
        ? (sessions as any)[storyId] ?? Object.values(sessions as any)[0]
        : null
  if (!s || typeof s !== "object") return null
  const anyS = s as any
  const currentStepRaw = Number(anyS.currentStep)
  const currentStep = Number.isFinite(currentStepRaw) ? Math.trunc(currentStepRaw) : 0
  const productImages = Array.isArray(anyS.productImages) ? anyS.productImages.map((u: any) => String(u ?? "").trim()).filter(Boolean) : []
  const activeSkill = typeof anyS.activeSkill === "string" && anyS.activeSkill.trim() ? String(anyS.activeSkill).trim() : undefined
  const createdAt = Number(anyS.createdAt ?? Date.now())
  const updatedAt = Number(anyS.updatedAt ?? Date.now())
  const assets = normalizeAssets(anyS)
  return { currentStep: Math.trunc(currentStep), productImages, activeSkill, assets, createdAt, updatedAt }
}

export function setVibeSessionState(metadata: Record<string, unknown>, storyId: string, state: VibeSessionState): Record<string, unknown> {
  const root = (metadata ?? {}) as any
  if (!root.vibeCreating || typeof root.vibeCreating !== "object") root.vibeCreating = {}
  root.vibeCreating.state = state
  if (root.vibeCreating.sessions && typeof root.vibeCreating.sessions === "object") {
    if (root.vibeCreating.sessions[storyId] !== undefined) delete root.vibeCreating.sessions[storyId]
  }
  return root as Record<string, unknown>
}
