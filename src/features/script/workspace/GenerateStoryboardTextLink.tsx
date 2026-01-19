"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { MouseEvent, ReactElement } from "react"
import { useCallback, useMemo, useState } from "react"
import type { ApiErr, ApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import styles from "./ScriptWorkspacePage.module.css"

type OutlineItem = Readonly<{
  outlineId: string
  outlineText: string
  originalText: string
}>

type GenerateStoryboardTextLinkProps = Readonly<{
  href: string
  outlines: ReadonlyArray<OutlineItem>
  children: string
  className: string
}>

export function GenerateStoryboardTextLink({
  href,
  outlines,
  children,
  className
}: GenerateStoryboardTextLinkProps): ReactElement {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  const payloads = useMemo(() => {
    return outlines
      .map((o) => {
        return {
          outlineId: o.outlineId?.trim(),
          outline: o.outlineText?.trim(),
          original: o.originalText?.trim()
        }
      })
      .filter((p) => p.outlineId && p.outline && p.original)
  }, [outlines])

  const onClick = useCallback(
    async (e: MouseEvent<HTMLAnchorElement>): Promise<void> => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      e.preventDefault()
      if (isSubmitting) return

      setIsSubmitting(true)
      setErrorText(null)

      const start = performance.now()
      logger.info({
        event: "storyboard_text_batch_start",
        module: "script",
        traceId: "client",
        message: "开始并发生成分镜文本",
        total: payloads.length
      })

      try {
        const results = await Promise.allSettled(
          payloads.map(async (p) => {
            const res = await fetch("/api/coze/storyboard/coze-generate-text", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                outlineId: p.outlineId,
                outline: p.outline,
                original: p.original
              })
            })

            const json = (await res.json()) as ApiOk<unknown> | ApiErr
            if (!res.ok || !json || (json as ApiErr).ok === false) {
              const errJson = json as ApiErr
              throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
            }
          })
        )

        const durationMs = Math.round(performance.now() - start)
        const failed = results.filter((r) => r.status === "rejected").length
        logger.info({
          event: "storyboard_text_batch_done",
          module: "script",
          traceId: "client",
          message: "并发生成分镜文本完成",
          durationMs,
          total: payloads.length,
          failed
        })

        if (failed > 0) {
          setErrorText(`部分分镜生成失败（${failed}/${payloads.length}），可在分镜页重试`)
        }

        router.push(href)
      } catch (err) {
        const durationMs = Math.round(performance.now() - start)
        const anyErr = err as { name?: string; message?: string }
        logger.error({
          event: "storyboard_text_batch_error",
          module: "script",
          traceId: "client",
          message: "并发生成分镜文本异常",
          durationMs,
          errorName: anyErr?.name,
          errorMessage: anyErr?.message
        })
        setErrorText("生成失败，请稍后重试")
      } finally {
        setIsSubmitting(false)
      }
    },
    [href, isSubmitting, payloads, router]
  )

  return (
    <div className={styles.nextStepAction}>
      <Link
        className={className}
        href={href}
        onClick={onClick}
        aria-disabled={isSubmitting}
        tabIndex={isSubmitting ? -1 : 0}
      >
        {isSubmitting ? "生成中…" : children}
      </Link>
      {errorText ? <div className={styles.nextStepError}>{errorText}</div> : null}
    </div>
  )
}
