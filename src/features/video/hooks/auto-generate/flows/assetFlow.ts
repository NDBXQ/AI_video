import React from "react"
import { fetchStoryboards, generateStoryboardPrompts } from "../../../api/generation"
import { extractReferenceImagePrompts } from "../../../utils/referenceImagePrompts"
import { startReferenceImageJob, waitReferenceImageJob } from "../../../utils/referenceImageAsync"
import { normalizeCategory, toEntityKey, chunkArray } from "../../../utils/autoGenerateUtils"
import type { StoryboardItem } from "../../../types"
import type { EpisodeProgressState, AutoGenerateStage, EpisodeProgressSummary, ScriptEntityCatalog } from "../useAutoGenerateState"

interface AssetFlowParams {
  storyId: string
  outlineIds: string[]
  outlineIdByStoryboardId: Map<string, string>
  preferredEpisodeId: string
  runTasksWithConcurrency: (tasks: Array<() => Promise<void>>, concurrency: number) => Promise<void>
  setGenerationStage: (stage: AutoGenerateStage) => void
  setScriptEntityCatalog: (catalog: ScriptEntityCatalog) => void
  setPromptSummary: (updater: (prev: EpisodeProgressSummary | null) => EpisodeProgressSummary | null) => void
  setAssetSummary: (updater: (prev: EpisodeProgressSummary | null) => EpisodeProgressSummary | null) => void
  setEpisodeProgressById: (updater: (prev: Record<string, EpisodeProgressState>) => Record<string, EpisodeProgressState>) => void
}

export async function runAssetFlow({
  storyId,
  outlineIds,
  outlineIdByStoryboardId,
  preferredEpisodeId,
  runTasksWithConcurrency,
  setGenerationStage,
  setScriptEntityCatalog,
  setPromptSummary,
  setAssetSummary,
  setEpisodeProgressById
}: AssetFlowParams) {
  setGenerationStage("assets")

  const assetsItemsByOutlineId = new Map<string, StoryboardItem[]>()
  for (const outlineId of outlineIds) {
    assetsItemsByOutlineId.set(outlineId, await fetchStoryboards(storyId, outlineId))
  }
  const assetsItems = outlineIds.flatMap((id) => assetsItemsByOutlineId.get(id) ?? [])

  const globalPromptByKey = new Map<
    string,
    { name: string; category: "background" | "role" | "item"; prompt: string; description: string }
  >()
  const catalogByCategory = {
    background: new Map<string, string>(),
    role: new Map<string, string>(),
    item: new Map<string, string>()
  }
  const episodeKeysByOutlineId = new Map<string, Set<string>>()
  const outlineIdsByKey = new Map<string, Set<string>>()

  for (const outlineId of outlineIds) {
    episodeKeysByOutlineId.set(outlineId, new Set())
  }

  for (const item of assetsItems) {
    const outlineId = outlineIdByStoryboardId.get(item.id) ?? preferredEpisodeId
    const extracted = extractReferenceImagePrompts(item.scriptContent)
    if (!Array.isArray(extracted) || extracted.length === 0) continue
    for (const p of extracted) {
      const category = normalizeCategory(p.category)
      const name = (p.name ?? "").trim()
      const prompt = (p.prompt ?? "").trim()
      if (!name || !prompt) continue
      const description = (p.description ?? "").trim() || prompt
      const key = toEntityKey(category, name)
      if (!globalPromptByKey.has(key)) globalPromptByKey.set(key, { name, category, prompt, description })

      const episodeSet = episodeKeysByOutlineId.get(outlineId)
      if (episodeSet) episodeSet.add(key)
      const keyEpisodes = outlineIdsByKey.get(key) ?? new Set<string>()
      keyEpisodes.add(outlineId)
      outlineIdsByKey.set(key, keyEpisodes)

      if (!catalogByCategory[category].has(name)) catalogByCategory[category].set(name, description)
    }
  }

  setScriptEntityCatalog({
    background: Array.from(catalogByCategory.background.entries())
      .map(([name, description]) => ({ name, description }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    role: Array.from(catalogByCategory.role.entries())
      .map(([name, description]) => ({ name, description }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    item: Array.from(catalogByCategory.item.entries())
      .map(([name, description]) => ({ name, description }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  const globalPrompts = Array.from(globalPromptByKey.values())
  setPromptSummary(() => ({ total: assetsItems.length, done: 0, failed: 0 }))
  setAssetSummary(() => ({ total: globalPrompts.length, done: 0, failed: 0 }))

  setEpisodeProgressById((prev) => {
    const next = { ...prev }
    for (const outlineId of outlineIds) {
      const promptTotal = assetsItemsByOutlineId.get(outlineId)?.length ?? 0
      const assetTotal = episodeKeysByOutlineId.get(outlineId)?.size ?? 0
      next[outlineId] = {
        ...next[outlineId],
        prompts: { total: promptTotal, done: 0, failed: 0 },
        assets: { total: assetTotal, done: 0, failed: 0 }
      }
    }
    return next
  })

  const keyToOutlineIds = new Map<string, string[]>()
  for (const [key, set] of outlineIdsByKey.entries()) {
    keyToOutlineIds.set(key, Array.from(set))
  }
  const doneKeysByOutline = new Map<string, Set<string>>()
  const failedKeysByOutline = new Map<string, Set<string>>()
  for (const outlineId of outlineIds) {
    doneKeysByOutline.set(outlineId, new Set())
    failedKeysByOutline.set(outlineId, new Set())
  }

  const incEpisodeKey = (outlineId: string, kind: "assets" | "prompts", ok: boolean, key: string) => {
    const doneSet = doneKeysByOutline.get(outlineId) ?? new Set<string>()
    const failedSet = failedKeysByOutline.get(outlineId) ?? new Set<string>()
    if (doneSet.has(key) || failedSet.has(key)) return
    if (ok) doneSet.add(key)
    else failedSet.add(key)
    doneKeysByOutline.set(outlineId, doneSet)
    failedKeysByOutline.set(outlineId, failedSet)

    setEpisodeProgressById((prev) => {
      const next = { ...prev }
      const cur = next[outlineId]?.[kind] ?? { total: 0, done: 0, failed: 0 }
      next[outlineId] = {
        ...next[outlineId],
        [kind]: ok ? { ...cur, done: cur.done + 1 } : { ...cur, failed: cur.failed + 1 }
      }
      return next
    })
  }

  const runPromptsTask = async () => {
    const promptTasks = assetsItems.map((item) => async () => {
      const outlineId = outlineIdByStoryboardId.get(item.id) ?? preferredEpisodeId
      try {
        await generateStoryboardPrompts(item.id)
        setPromptSummary((prev) => {
          const total = prev?.total ?? assetsItems.length
          const done = (prev?.done ?? 0) + 1
          return { total, done, failed: prev?.failed ?? 0 }
        })
        setEpisodeProgressById((prev) => {
          const next = { ...prev }
          const cur = next[outlineId]?.prompts ?? { total: 0, done: 0, failed: 0 }
          next[outlineId] = { ...next[outlineId], prompts: { ...cur, done: cur.done + 1 } }
          return next
        })
      } catch {
        setPromptSummary((prev) => {
          const total = prev?.total ?? assetsItems.length
          const failed = (prev?.failed ?? 0) + 1
          return { total, done: prev?.done ?? 0, failed }
        })
        setEpisodeProgressById((prev) => {
          const next = { ...prev }
          const cur = next[outlineId]?.prompts ?? { total: 0, done: 0, failed: 0 }
          next[outlineId] = { ...next[outlineId], prompts: { ...cur, failed: cur.failed + 1 } }
          return next
        })
      }
    })
    await runTasksWithConcurrency(promptTasks, 5)
  }

  const runAssetsTask = async () => {
    if (globalPrompts.length === 0) return
    const batches = chunkArray(globalPrompts, 50)
    for (const batch of batches) {
      try {
        const jobId = await startReferenceImageJob({
          storyId,
          prompts: batch.map((p) => ({ name: p.name, prompt: p.prompt, description: p.description, category: p.category }))
        })
        const snap = await waitReferenceImageJob(jobId)
        for (const r of snap.results ?? []) {
          const name = typeof r.name === "string" ? r.name.trim() : ""
          const category = normalizeCategory((r as any).category)
          if (!name) continue
          const key = toEntityKey(category, name)
          const ok = Boolean((r as any).ok)

          setAssetSummary((prev) => {
            const total = prev?.total ?? globalPrompts.length
            if (ok) return { total, done: (prev?.done ?? 0) + 1, failed: prev?.failed ?? 0 }
            return { total, done: prev?.done ?? 0, failed: (prev?.failed ?? 0) + 1 }
          })

          const affected = keyToOutlineIds.get(key) ?? []
          for (const outlineId of affected) {
            incEpisodeKey(outlineId, "assets", ok, key)
          }
        }
      } catch {
        for (const p of batch) {
          const key = toEntityKey(p.category, p.name)
          setAssetSummary((prev) => {
            const total = prev?.total ?? globalPrompts.length
            return { total, done: prev?.done ?? 0, failed: (prev?.failed ?? 0) + 1 }
          })
          const affected = keyToOutlineIds.get(key) ?? []
          for (const outlineId of affected) {
            incEpisodeKey(outlineId, "assets", false, key)
          }
        }
      }
    }
  }

  await Promise.allSettled([runPromptsTask(), runAssetsTask()])
}
