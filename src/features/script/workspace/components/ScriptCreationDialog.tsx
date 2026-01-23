"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { MouseEvent, ReactElement } from "react"
import { X } from "lucide-react"
import { useRouter } from "next/navigation"
import styles from "./ScriptCreationDialog.module.css"
import { UiSelect } from "@/components/ui-select/UiSelect"
import { logger } from "@/shared/logger"
import type { ApiErr, ApiOk } from "@/shared/api"

export type ScriptStartMode = "source" | "brief"

type ScriptCreationDialogProps = {
  open: boolean
  onClose: () => void
  initialMode?: ScriptStartMode
}

export function ScriptCreationDialog({
  open,
  onClose,
  initialMode = "brief"
}: ScriptCreationDialogProps): ReactElement | null {
  const router = useRouter()
  const [mode, setMode] = useState<ScriptStartMode>(initialMode)
  const [title, setTitle] = useState("")
  const [ratio, setRatio] = useState("16:9")
  const [resolution, setResolution] = useState("1080p")
  const [shotStyle, setShotStyle] = useState("cinema")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  const titleCount = title.length
  const contentCount = content.length

  const contentLabel = useMemo(() => {
    return mode === "source" ? "故事原文" : "剧情简介"
  }, [mode])

  const contentPlaceholder = useMemo(() => {
    return mode === "source"
      ? "粘贴或输入原文，支持长文本与多段落"
      : "请输入剧情简介，支持多段落"
  }, [mode])
  
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  const onBackdropClick = useCallback(
    (e: MouseEvent<HTMLDivElement>): void => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  const canConfirm = content.trim().length > 0

  const onConfirmClick = useCallback(async () => {
    if (!canConfirm) return
    if (isSubmitting) return

    const storyText = content.trim()
    const inputType = mode === "source" ? "original" : "brief"

    setIsSubmitting(true)
    setErrorText(null)

    const start = performance.now()
    logger.info({
      event: "outline_generate_start",
      module: "script",
      traceId: "client",
      message: "开始调用大纲生成接口",
      inputType
    })

    try {
      const res = await fetch("/api/coze/storyboard/generate-outline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input_type: inputType,
          story_text: storyText,
          title: title.trim(),
          ratio,
          resolution,
          style: shotStyle
        })
      })

      const durationMs = Math.round(performance.now() - start)
      const json = (await res.json()) as ApiOk<unknown> | ApiErr

      if (!res.ok || !json || (json as ApiErr).ok === false) {
        const errJson = json as ApiErr
        logger.warn({
          event: "outline_generate_failed",
          module: "script",
          traceId: "client",
          message: "大纲生成接口返回失败",
          status: res.status,
          durationMs,
          code: errJson?.error?.code
        })
        setErrorText(errJson?.error?.message ?? "生成失败，请稍后重试")
        return
      }

      const okJson = json as ApiOk<unknown>
      const data = okJson.data as unknown
      const storyId =
        typeof data === "object" && data !== null && "storyId" in data && typeof (data as { storyId?: unknown }).storyId === "string"
          ? String((data as { storyId: string }).storyId)
          : ""

      if (!storyId) {
        logger.warn({
          event: "outline_generate_missing_story_id",
          module: "script",
          traceId: "client",
          message: "大纲生成接口返回缺少 storyId",
          status: res.status,
          durationMs
        })
        setErrorText("生成成功但未返回 storyId，请稍后重试")
        return
      }

      logger.info({
        event: "outline_generate_success",
        module: "script",
        traceId: "client",
        message: "大纲生成接口调用成功",
        status: res.status,
        durationMs
      })

      // 跳转到工作台并带上 storyId
      const m = mode === "source" ? "source" : "brief"
      router.push(`/script/workspace/${encodeURIComponent(storyId)}?mode=${m}`)
      onClose()
      
    } catch (err) {
      const durationMs = Math.round(performance.now() - start)
      const anyErr = err as { name?: string; message?: string }
      logger.error({
        event: "outline_generate_error",
        module: "script",
        traceId: "client",
        message: "大纲生成接口调用异常",
        durationMs,
        errorName: anyErr?.name,
        errorMessage: anyErr?.message
      })
      setErrorText("网络异常，请检查网络或稍后重试")
    } finally {
      setIsSubmitting(false)
    }
  }, [canConfirm, content, isSubmitting, mode, onClose, ratio, resolution, router, shotStyle, title])

  if (!open) return null

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onBackdropClick}>
      <div className={styles.dialog} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.headerTitle}>新建创作</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className={styles.tabs}>
          <button 
            type="button" 
            className={`${styles.tab} ${mode === "brief" ? styles.tabActive : ""}`}
            onClick={() => setMode("brief")}
          >
            从剧情简介开始
          </button>
          <button 
            type="button" 
            className={`${styles.tab} ${mode === "source" ? styles.tabActive : ""}`}
            onClick={() => setMode("source")}
          >
            从故事原文开始
          </button>
        </div>

        <div className={styles.grid}>
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <div className={styles.label}>故事标题</div>
              <div className={styles.counter}>{titleCount}/100</div>
            </div>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="例如：城市奇遇记（选填）"
            />
            <div className={styles.hint}>建议 8–20 字，方便后续管理</div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <div className={styles.label}>视频比例</div>
              </div>
              <UiSelect
                ariaLabel="视频比例"
                value={ratio}
                onChange={setRatio}
                options={[
                  { value: "16:9", label: "16:9（横屏·通用）" },
                  { value: "4:3", label: "4:3（横屏·旧版）" },
                  { value: "1:1", label: "1:1（方形）" },
                  { value: "3:4", label: "3:4（竖屏·旧版）" },
                  { value: "9:16", label: "9:16（竖屏·短视频）" }              
                ]}
              />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <div className={styles.label}>分辨率</div>
              </div>
              <UiSelect
                ariaLabel="分辨率"
                value={resolution}
                onChange={setResolution}
                options={[
                  { value: "1080p", label: "1080p（高清）" },
                  { value: "720p", label: "720p（标清）" },
                  { value: "480p", label: "480p（低清）" }
                ]}
              />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <div className={styles.label}>镜头风格</div>
              </div>
              <UiSelect
                ariaLabel="镜头风格"
                value={shotStyle}
                onChange={setShotStyle}
                options={[
                  { value: "cinema", label: "电影感（推荐）" },
                  { value: "tv", label: "电视剧（纪实）" },
                  { value: "short", label: "短视频（快节奏）" }
                ]}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <div className={styles.label}>{contentLabel}</div>
            </div>
            <textarea
              className={styles.textarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={contentPlaceholder}
            />
            <div className={styles.footerRow}>
              <span>支持换行输入</span>
              <span>{contentCount} 字</span>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onConfirmClick}
            disabled={!canConfirm || isSubmitting}
          >
            {isSubmitting ? "生成中…" : "开始创作 →"}
          </button>
        </div>
        {errorText ? <div className={styles.errorText}>{errorText}</div> : null}
      </div>
    </div>
  )
}
