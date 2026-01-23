import React from "react"
import type { MutableRefObject } from "react"
import { collectEntityNamesFromScriptData } from "../../../utils/autoGenerateUtils"
import type { StoryboardItem } from "../../../types"
import type { EpisodeProgressState, AutoGenerateStage, EpisodeProgressSummary } from "../useAutoGenerateState"

interface ScriptFlowParams {
  allItems: StoryboardItem[]
  outlineIds: string[]
  itemsByOutlineId: Map<string, StoryboardItem[]>
  outlineIdByStoryboardId: Map<string, string>
  preferredEpisodeId: string
  entitySetsRef: MutableRefObject<{ background: Set<string>; role: Set<string>; item: Set<string> }>
  runTasksWithConcurrency: (tasks: Array<() => Promise<void>>, concurrency: number) => Promise<void>
  generateScriptForItem: (item: StoryboardItem) => Promise<unknown>
  setGenerationStage: (stage: AutoGenerateStage) => void
  setScriptSummary: React.Dispatch<React.SetStateAction<EpisodeProgressSummary | null>>
  setEpisodeProgressById: (updater: (prev: Record<string, EpisodeProgressState>) => Record<string, EpisodeProgressState>) => void
}

export async function runScriptFlow({
  allItems,
  outlineIds,
  itemsByOutlineId,
  outlineIdByStoryboardId,
  preferredEpisodeId,
  entitySetsRef,
  runTasksWithConcurrency,
  generateScriptForItem,
  setGenerationStage,
  setScriptSummary,
  setEpisodeProgressById
}: ScriptFlowParams) {
  setGenerationStage("script")
  setScriptSummary({ total: allItems.length, done: 0, failed: 0 })

  setEpisodeProgressById((prev) => {
    const next = { ...prev }
    for (const outlineId of outlineIds) {
      const total = itemsByOutlineId.get(outlineId)?.length ?? 0
      next[outlineId] = { ...next[outlineId], script: { total, done: 0, failed: 0 } }
    }
    return next
  })

  await runTasksWithConcurrency(
    allItems.map((item) => async () => {
      const result = await generateScriptForItem(item)
      const outlineId = outlineIdByStoryboardId.get(item.id) ?? preferredEpisodeId

      if (result) {
        collectEntityNamesFromScriptData(result, entitySetsRef.current)
        setScriptSummary((prev) => {
          const total = prev?.total ?? allItems.length
          const done = (prev?.done ?? 0) + 1
          return { total, done, failed: prev?.failed ?? 0 }
        })
        setEpisodeProgressById((prev) => {
          const next = { ...prev }
          const cur = next[outlineId]?.script ?? { total: 0, done: 0, failed: 0 }
          next[outlineId] = { ...next[outlineId], script: { ...cur, done: cur.done + 1 } }
          return next
        })
      } else {
        setScriptSummary((prev) => {
          const total = prev?.total ?? allItems.length
          const failed = (prev?.failed ?? 0) + 1
          return { total, done: prev?.done ?? 0, failed }
        })
        setEpisodeProgressById((prev) => {
          const next = { ...prev }
          const cur = next[outlineId]?.script ?? { total: 0, done: 0, failed: 0 }
          next[outlineId] = { ...next[outlineId], script: { ...cur, failed: cur.failed + 1 } }
          return next
        })
      }
    }),
    5
  )
}
