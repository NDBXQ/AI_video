"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ActiveJob } from "@/features/video/types/jobs"
import { getStoryJobsSnapshot, refreshStoryJobs, subscribeStoryJobs } from "@/features/video/jobs/jobsStore"

export function useActiveJobs(params: { storyId?: string; enabled?: boolean; intervalMs?: number }) {
  const storyId = params.storyId?.trim() ?? ""
  const enabled = params.enabled ?? true
  const intervalMs = Math.max(1200, Math.floor(params.intervalMs ?? 5000))

  const disabledSnapshot = useMemo(() => {
    return { jobs: [] as ActiveJob[], summary: { queued: 0, running: 0, total: 0 }, loading: false, error: null as string | null }
  }, [])

  const [state, setState] = useState(() => (enabled && storyId ? getStoryJobsSnapshot(storyId) : disabledSnapshot))

  useEffect(() => {
    if (!enabled || !storyId) return
    const unsub = subscribeStoryJobs({ storyId, intervalMs }, setState)
    return () => unsub()
  }, [enabled, intervalMs, storyId])

  const effectiveState = enabled && storyId ? state : disabledSnapshot

  const summary = useMemo(() => {
    return effectiveState.summary
  }, [effectiveState.summary])

  const refresh = useCallback(async () => {
    if (!enabled || !storyId) return
    await refreshStoryJobs(storyId)
  }, [enabled, storyId])

  return { jobs: effectiveState.jobs, summary, loading: effectiveState.loading, error: effectiveState.error, refresh }
}
