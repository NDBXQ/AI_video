"use client"

import { useMemo, useState, type ReactElement } from "react"
import { GenerationPanel, type GenerationStep } from "./GenerationPanel"
import { useActiveJobs } from "../../hooks/useActiveJobs"

function jobTypeLabel(type: string): string {
  if (type === "reference_image_generate") return "参考图生成"
  if (type === "video_generate") return "视频生成"
  if (type === "coze_generate_script") return "分镜脚本生成"
  if (type === "coze_generate_outline") return "大纲生成"
  if (type === "coze_generate_storyboard_text") return "分镜文本生成"
  return type
}

export function ActiveJobsPanel({ storyId }: { storyId?: string }): ReactElement | null {
  const [open, setOpen] = useState(false)
  const { jobs, summary, loading, error } = useActiveJobs({ storyId, enabled: Boolean(storyId), intervalMs: 1200 })

  const steps = useMemo<GenerationStep[]>(() => {
    if (error) return [{ key: "jobs_error", label: "任务状态加载失败", status: "error", meta: error }]
    if (jobs.length === 0 && loading) return [{ key: "jobs_loading", label: "加载后台任务中", status: "running" }]
    if (jobs.length === 0) return [{ key: "jobs_idle", label: "暂无后台任务", status: "success" }]
    return jobs.map((j) => ({
      key: j.jobId,
      label: jobTypeLabel(j.type),
      status: j.status === "running" ? "running" : "pending",
      meta: typeof (j.snapshot as any)?.stage === "string" ? String((j.snapshot as any).stage) : ""
    }))
  }, [error, jobs, loading])

  if (!storyId) return null

  const title = summary.total === 0 ? "后台任务空闲" : summary.running > 0 ? "后台任务进行中" : "后台任务排队中"

  return (
    <GenerationPanel
      open={open}
      title={summary.total === 0 ? title : `${title}（${summary.running} 运行中 / ${summary.queued} 排队）`}
      steps={steps}
      onToggleOpen={() => setOpen((v) => !v)}
    />
  )
}
