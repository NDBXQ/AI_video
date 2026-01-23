import { logger } from "@/shared/logger"
import { generateStoryboardText, fetchStoryboards } from "../../../api/generation"
import type { StoryboardItem } from "../../../types"
import type { EpisodeProgressState, AutoGenerateStage } from "../useAutoGenerateState"

interface TextFlowParams {
  filteredPayloads: Array<{ outlineId: string; outline: string; original: string }>
  storyId: string
  activeEpisodeId: string
  setTextBatchMeta: (meta: { total: number; failed: number }) => void
  setEpisodeProgressById: (updater: (prev: Record<string, EpisodeProgressState>) => Record<string, EpisodeProgressState>) => void
  setGenerationStage: (stage: AutoGenerateStage) => void
  setGenerationEpisodeId: (id: string) => void
  setItems: (items: StoryboardItem[]) => void
  reloadShots: (outlineId: string) => Promise<void>
}

export async function runStoryboardTextFlow({
  filteredPayloads,
  storyId,
  activeEpisodeId,
  setTextBatchMeta,
  setEpisodeProgressById,
  setGenerationStage,
  setGenerationEpisodeId,
  setItems,
  reloadShots
}: TextFlowParams) {
  const start = performance.now()
  logger.info({
    event: "storyboard_text_batch_start",
    module: "video",
    traceId: "client",
    message: "开始并发生成分镜文本",
    total: filteredPayloads.length
  })

  setGenerationStage("storyboard_text")
  const results = await Promise.allSettled(
    filteredPayloads.map(async (p) => {
      await generateStoryboardText(p.outlineId, p.outline, p.original)
    })
  )

  const durationMs = Math.round(performance.now() - start)
  const failed = results.filter((r) => r.status === "rejected").length
  setTextBatchMeta({ total: filteredPayloads.length, failed })

  setEpisodeProgressById(() => {
    const next: Record<string, EpisodeProgressState> = {}
    for (let i = 0; i < filteredPayloads.length; i += 1) {
      const outlineId = filteredPayloads[i]?.outlineId
      if (!outlineId) continue
      const status = results[i]?.status === "fulfilled" ? "success" : "error"
      next[outlineId] = { textStatus: status }
    }
    return next
  })

  logger.info({
    event: "storyboard_text_batch_done",
    module: "video",
    traceId: "client",
    message: "并发生成分镜文本完成",
    durationMs,
    total: filteredPayloads.length,
    failed
  })

  if (failed === filteredPayloads.length) {
    throw new Error("所有分镜文本生成失败")
  }

  setGenerationStage("reloading")
  const outlineIds = filteredPayloads.map((p) => p.outlineId)
  const preferredEpisodeId = outlineIds.includes(activeEpisodeId)
    ? activeEpisodeId
    : outlineIds[0] ?? activeEpisodeId

  setGenerationEpisodeId(preferredEpisodeId)
  await reloadShots(preferredEpisodeId)

  const itemsByOutlineId = new Map<string, StoryboardItem[]>()
  const outlineIdByStoryboardId = new Map<string, string>()

  for (const outlineId of outlineIds) {
    const list = await fetchStoryboards(storyId, outlineId)
    itemsByOutlineId.set(outlineId, list)
    for (const it of list) outlineIdByStoryboardId.set(it.id, outlineId)
  }

  const displayItems = itemsByOutlineId.get(preferredEpisodeId) ?? []
  if (displayItems.length > 0) setItems(displayItems)

  return {
    outlineIds,
    preferredEpisodeId,
    itemsByOutlineId,
    outlineIdByStoryboardId
  }
}
