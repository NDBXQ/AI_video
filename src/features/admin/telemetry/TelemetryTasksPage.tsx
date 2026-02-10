"use client"

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react"
import styles from "./TelemetryTasksPage.module.css"

type ApiOk<T> = { ok: true; data: T; traceId: string }
type ApiErr = { ok: false; error: { code: string; message: string }; traceId: string }

type Funnel = {
  windowHours: number
  counts: { tvc_open: number; tvc_generate_shotlist_clicked: number; tvc_chat_submitted: number }
  rates: { generateRate: number; chatRate: number }
  updatedAt: string
}

type TaskItem = {
  id: string
  module: string
  title: string
  status: string
  spec: Record<string, unknown>
  createdAt: string
}

type ListResult = ApiOk<{ items: TaskItem[] }> | ApiErr
type GenerateResult = ApiOk<{ items: TaskItem[]; funnel: Funnel }> | ApiErr
type FunnelResult = ApiOk<Funnel> | ApiErr

export function TelemetryTasksPage(): ReactElement {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<TaskItem[]>([])
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [hours, setHours] = useState(24)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tasksRes, funnelRes] = await Promise.all([
        fetch("/api/internal/telemetry/tvc-tasks?limit=20", { method: "GET" }),
        fetch(`/api/internal/telemetry/tvc-funnel?hours=${encodeURIComponent(String(hours))}`, { method: "GET" })
      ])
      const tasksJson = (await tasksRes.json()) as ListResult
      const funnelJson = (await funnelRes.json()) as FunnelResult

      if (!tasksJson.ok) throw new Error(tasksJson.error.message)
      setItems(tasksJson.data.items ?? [])

      if (funnelJson.ok) setFunnel(funnelJson.data)
      else setFunnel(null)
    } catch (e) {
      const anyErr = e as { message?: string }
      setError(anyErr?.message ?? "加载失败")
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    void load()
  }, [load])

  const onGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/internal/telemetry/tvc-tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours, maxTasks: 3 })
      })
      const json = (await res.json()) as GenerateResult
      if (!json.ok) throw new Error(json.error.message)
      setItems((prev) => [...(json.data.items ?? []), ...prev].slice(0, 50))
      setFunnel(json.data.funnel ?? null)
    } catch (e) {
      const anyErr = e as { message?: string }
      setError(anyErr?.message ?? "生成失败")
    } finally {
      setGenerating(false)
    }
  }, [hours])

  const funnelStats = useMemo(() => {
    if (!funnel) return null
    return [
      { label: "Open UV", value: funnel.counts.tvc_open },
      { label: "Generate UV", value: funnel.counts.tvc_generate_shotlist_clicked },
      { label: "Chat UV", value: funnel.counts.tvc_chat_submitted },
      { label: "Generate Rate", value: `${funnel.rates.generateRate}%` },
      { label: "Chat Rate", value: `${funnel.rates.chatRate}%` }
    ]
  }, [funnel])

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <div className={styles.topTitle}>自迭代 · TVC 任务单</div>
          <div className={styles.topMeta}>从 /tvc 漏斗数据自动生成可验证的迭代任务单</div>
        </div>
        <div className={styles.topActions}>
          <button type="button" className={styles.topBtn} onClick={() => void load()} disabled={loading || generating}>
            刷新
          </button>
          <button type="button" className={styles.topBtn} onClick={onGenerate} disabled={loading || generating}>
            {generating ? "生成中…" : "生成 3 条任务单"}
          </button>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.grid}>
        <section className={styles.panel} aria-label="漏斗概览">
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>漏斗概览</div>
            <div className={styles.topActions}>
              <button
                type="button"
                className={styles.topBtn}
                onClick={() => {
                  setHours(24)
                }}
                disabled={loading || generating}
              >
                24h
              </button>
              <button
                type="button"
                className={styles.topBtn}
                onClick={() => {
                  setHours(72)
                }}
                disabled={loading || generating}
              >
                72h
              </button>
            </div>
          </div>
          <div className={styles.panelBody}>
            {funnelStats ? (
              <>
                <div className={styles.statGrid}>
                  {funnelStats.map((s) => (
                    <div key={s.label} className={styles.stat}>
                      <div className={styles.statLabel}>{s.label}</div>
                      <div className={typeof s.value === "number" ? styles.statVal : styles.statSmall}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.empty}>暂无漏斗数据（先打开 /tvc 操作几次再看）</div>
            )}
          </div>
        </section>

        <section className={styles.panel} aria-label="任务列表">
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>任务列表（最新在前）</div>
            <div className={styles.panelTitle}>{items.length} 条</div>
          </div>
          <div className={styles.panelBody}>
            {items.length === 0 ? <div className={styles.empty}>还没有任务单，点“生成 3 条任务单”</div> : null}
            {items.map((it) => (
              <details key={it.id} className={styles.details}>
                <summary className={styles.summary}>
                  <span>{it.title}</span>
                  <span className={styles.summaryMeta}>{it.status}</span>
                </summary>
                <pre className={styles.pre}>{JSON.stringify(it.spec ?? {}, null, 2)}</pre>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
