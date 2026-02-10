"use client"

import Link from "next/link"
import type { ReactElement } from "react"
import { useMemo, useState } from "react"
import styles from "./OnboardingChecklistCard.module.css"
import { useTelemetry } from "@/shared/useTelemetry"

type ChecklistStep = Readonly<{
  id: string
  title: string
  description: string
  done: boolean
  href: string
  helpTopic?: string
}>

type OnboardingChecklistCardProps = Readonly<{
  steps: ReadonlyArray<ChecklistStep>
}>

const DISMISS_KEY = "ai-video:onboarding:dismissed"

export function OnboardingChecklistCard({ steps }: OnboardingChecklistCardProps): ReactElement | null {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1"
    } catch {
      return false
    }
  })
  const [creatingSample, setCreatingSample] = useState(false)
  const [sampleError, setSampleError] = useState<string>("")

  const remaining = useMemo(() => steps.filter((s) => !s.done).length, [steps])
  const total = steps.length
  const completed = Math.max(0, total - remaining)
  const ratio = total > 0 ? Math.round((completed / total) * 100) : 0
  const shouldOfferSample = useMemo(() => steps.some((s) => s.id === "create_story" && !s.done), [steps])
  const sendTelemetry = useTelemetry({ page: "/" })

  const handleDismiss = (): void => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // ignore
    }
    sendTelemetry("onboarding_checklist_dismissed", { ratio, completed, total })
  }

  const handleCreateSample = async (): Promise<void> => {
    if (creatingSample) return
    setSampleError("")
    setCreatingSample(true)
    sendTelemetry("onboarding_sample_create_clicked")
    try {
      const res = await fetch("/api/onboarding/create-sample-story", { method: "POST" })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      const storyId = String(json?.data?.storyId ?? "").trim()
      if (!storyId) throw new Error("创建失败：未返回 storyId")
      sendTelemetry("onboarding_sample_create_success", { storyId })
      window.location.assign(`/script/workspace/${encodeURIComponent(storyId)}?mode=brief`)
    } catch (e) {
      const anyErr = e as { message?: string }
      const msg = anyErr?.message ?? "创建示例项目失败"
      setSampleError(msg)
      sendTelemetry("onboarding_sample_create_failed", { message: msg })
    } finally {
      setCreatingSample(false)
    }
  }

  if (dismissed) return null

  return (
    <section className={styles.card} aria-label="新手清单">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.icon} aria-hidden="true" />
          <div className={styles.titles}>
            <div className={styles.title}>新手清单</div>
            <div className={styles.sub}>跟着做一遍，就能走通主链路</div>
          </div>
        </div>
        <button type="button" className={styles.dismissBtn} onClick={handleDismiss} aria-label="隐藏新手清单">
          ×
        </button>
      </div>

      <div className={styles.progress} aria-label="完成度">
        <div className={styles.progressText}>
          {completed}/{total} 已完成
        </div>
        <div className={styles.progressBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio}>
          <div className={styles.progressFill} style={{ width: `${ratio}%` }} />
        </div>
      </div>

      <ol className={styles.list}>
        {steps.map((s, idx) => {
          const helpHref = s.helpTopic ? `/help?${new URLSearchParams({ topic: s.helpTopic }).toString()}` : "/help"
          return (
            <li key={s.id} className={styles.item}>
              <div className={styles.bullet} aria-hidden="true" data-done={s.done ? "1" : "0"}>
                {s.done ? "✓" : idx + 1}
              </div>
              <div className={styles.itemMain}>
                <div className={styles.itemTitleRow}>
                  <div className={styles.itemTitle}>{s.title}</div>
                  <div className={styles.itemActions}>
                    <Link className={styles.helpLink} href={helpHref}>
                      怎么做
                    </Link>
                    <Link className={styles.goLink} href={s.href} aria-disabled={s.done}>
                      {s.done ? "已完成" : "去完成 →"}
                    </Link>
                  </div>
                </div>
                <div className={styles.itemDesc}>{s.description}</div>
              </div>
            </li>
          )
        })}
      </ol>

      {shouldOfferSample ? (
        <div className={styles.sample}>
          <button type="button" className={styles.sampleBtn} onClick={() => void handleCreateSample()} disabled={creatingSample}>
            {creatingSample ? "创建示例项目中…" : "一键创建示例项目"}
          </button>
          {sampleError ? <div className={styles.sampleError}>{sampleError}</div> : null}
        </div>
      ) : null}
    </section>
  )
}
