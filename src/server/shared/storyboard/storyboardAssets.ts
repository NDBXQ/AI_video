import "server-only"

export type StoryboardFrameAsset = {
  url?: string | null
  thumbnailUrl?: string | null
  prompt?: string | null
}

export type StoryboardFrames = {
  first?: StoryboardFrameAsset
  last?: StoryboardFrameAsset
}

export type StoryboardVideoSettings = {
  mode?: string | null
  generateAudio?: boolean | null
  watermark?: boolean | null
}

export type StoryboardVideoInfo = {
  url?: string | null
  prompt?: string | null
  storageKey?: string | null
  durationSeconds?: number | null
  settings?: StoryboardVideoSettings
}

export function mergeStoryboardFrames(base: StoryboardFrames | null | undefined, patch: Partial<StoryboardFrames> | null | undefined): StoryboardFrames {
  const safeBase = base && typeof base === "object" ? base : {}
  const safePatch = patch && typeof patch === "object" ? patch : {}
  return {
    ...safeBase,
    ...safePatch,
    first: { ...(safeBase.first ?? {}), ...(safePatch.first ?? {}) },
    last: { ...(safeBase.last ?? {}), ...(safePatch.last ?? {}) }
  }
}

export function mergeStoryboardVideoInfo(base: StoryboardVideoInfo | null | undefined, patch: Partial<StoryboardVideoInfo> | null | undefined): StoryboardVideoInfo {
  const safeBase = base && typeof base === "object" ? base : {}
  const safePatch = patch && typeof patch === "object" ? patch : {}
  return {
    ...safeBase,
    ...safePatch,
    settings: { ...(safeBase.settings ?? {}), ...(safePatch.settings ?? {}) }
  }
}
