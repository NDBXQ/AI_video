import "server-only"

import { getDb } from "coze-coding-dev-sdk"
import { asc, eq } from "drizzle-orm"
import { readEnv, readEnvInt } from "@/shared/env"
import { parseRewriteOutput } from "@/features/coze/rewrite/parseRewriteOutput"
import { makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { stories, storyOutlines } from "@/shared/schema/story"
import { ServiceError } from "@/server/shared/errors"

export type StreamData =
  | { type: "start"; outlineSequence: number }
  | { type: "delta"; outlineSequence: number; text: string }
  | { type: "result"; outlineSequence: number; result: unknown }
  | { type: "error"; outlineSequence: number; code: string; message: string }

function buildRewriteInput(input: {
  wholeStoryOutline: string
  previousPartOutline: string
  originalTitle: string
  originalContent: string
  nextPartOutline: string
  modificationRequirements: string
}): Record<string, string> {
  return {
    whole_story_outline: input.wholeStoryOutline,
    previous_part_outline: input.previousPartOutline,
    original_title: input.originalTitle,
    original_content: input.originalContent,
    next_part_outline: input.nextPartOutline,
    modification_requirements: input.modificationRequirements
  }
}

export class CozeRewriteService {
  /**
   * 创建改写流
   */
  static async createStream(params: {
    traceId: string
    userId: string
    storyId: string
    outlineSequence: number
    modificationRequirements: string
  }): Promise<ReadableStream<Uint8Array>> {
    const { traceId, userId, storyId, outlineSequence, modificationRequirements } = params

    const url = readEnv("REWRITE_API_URL")
    const token = readEnv("REWRITE_API_TOKEN")
    if (!url || !token) {
      throw new ServiceError(
        "COZE_NOT_CONFIGURED",
        "Coze 未配置，请设置 REWRITE_API_URL 与 REWRITE_API_TOKEN"
      )
    }

    const db = await getDb({ stories, storyOutlines })

    const [story] = await db
      .select({ id: stories.id, userId: stories.userId, storyText: stories.storyText })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1)

    if (!story) throw new ServiceError("STORY_NOT_FOUND", "Story 不存在")
    if (story.userId !== userId) throw new ServiceError("FORBIDDEN", "无权操作该 Story")

    const outlines = await db
      .select({
        id: storyOutlines.id,
        sequence: storyOutlines.sequence,
        outlineText: storyOutlines.outlineText,
        originalText: storyOutlines.originalText
      })
      .from(storyOutlines)
      .where(eq(storyOutlines.storyId, storyId))
      .orderBy(asc(storyOutlines.sequence))

    const current = outlines.find((o) => o.sequence === outlineSequence)
    if (!current) {
      throw new ServiceError("OUTLINE_NOT_FOUND", "大纲章节不存在")
    }

    const prev = outlines.find((o) => o.sequence === outlineSequence - 1)
    const next = outlines.find((o) => o.sequence === outlineSequence + 1)

    const rewriteInput = buildRewriteInput({
      wholeStoryOutline: story.storyText,
      previousPartOutline: prev?.outlineText ?? "",
      originalTitle: `剧本大纲 ${outlineSequence}`,
      originalContent: current.originalText,
      nextPartOutline: next?.outlineText ?? "",
      modificationRequirements: modificationRequirements
    })

    const encoder = new TextEncoder()
    const start = Date.now()
    let closed = false

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: StreamData) => {
          if (closed) return
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(makeApiOk(traceId, data))}\n\n`))
        }

        const sendErr = (code: string, message: string) => {
          if (closed) return
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify(
                makeApiOk(traceId, { type: "error", outlineSequence, code, message } satisfies StreamData)
              )}\n\n`
            )
          )
        }

        send({ type: "start", outlineSequence })

        logger.info({
          event: "coze_rewrite_stream_start",
          module: "coze",
          traceId,
          message: "开始流式改写",
          storyId,
          outlineSequence
        })

        const timeoutMs =
          readEnvInt("COZE_REWRITE_REQUEST_TIMEOUT_MS") ?? readEnvInt("REQUEST_TIMEOUT_MS") ?? 90_000
        const controllerAbort = new AbortController()
        const timer = setTimeout(() => controllerAbort.abort(), timeoutMs)

        const cozeSessionId = readEnv("COZE_REWRITE_SESSION_ID") ?? "nTT4u7yXzwLvb4vqPlloK"
        const cozeProjectId = readEnvInt("COZE_REWRITE_PROJECT_ID") ?? 7597286982829686819

        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              content: {
                query: {
                  prompt: [
                    {
                      type: "text",
                      content: { text: JSON.stringify(rewriteInput) }
                    }
                  ]
                }
              },
              type: "query",
              session_id: cozeSessionId,
              project_id: cozeProjectId
            }),
            signal: controllerAbort.signal
          })

          const contentType = resp.headers.get("content-type") ?? ""
          if (!resp.ok) {
            const txt = await resp.text().catch(() => "")
            sendErr("COZE_REQUEST_FAILED", `Coze 请求失败：HTTP ${resp.status}`)
            logger.error({
              event: "coze_rewrite_stream_upstream_failed",
              module: "coze",
              traceId,
              message: "Coze 流式请求失败",
              storyId,
              outlineSequence,
              status: resp.status,
              contentType,
              bodySnippet: txt.slice(0, 500)
            })
            closed = true
            controller.close()
            return
          }

          const body = resp.body
          if (!body) {
            sendErr("COZE_RESPONSE_INVALID", "Coze 回包为空")
            closed = true
            controller.close()
            return
          }

          const reader = body.getReader()
          const decoder = new TextDecoder()
          let buffer = ""
          let fullAnswer = ""

          while (!closed) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            while (true) {
              const idx = buffer.indexOf("\n\n")
              if (idx < 0) break
              const block = buffer.slice(0, idx)
              buffer = buffer.slice(idx + 2)

              const lines = block.split("\n")
              for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed.startsWith("data:")) continue
                const dataPart = trimmed.slice("data:".length).trim()
                if (!dataPart || dataPart === "[DONE]") continue

                let payload: unknown
                try {
                  payload = JSON.parse(dataPart)
                } catch {
                  continue
                }

                if (!payload || typeof payload !== "object") continue
                const anyPayload = payload as Record<string, unknown>

                if (anyPayload["type"] === "error") {
                  const content = anyPayload["content"]
                  const err =
                    content && typeof content === "object" ? (content as Record<string, unknown>)["error"] : undefined
                  const msg =
                    err && typeof err === "object"
                      ? String((err as Record<string, unknown>)["error_msg"] ?? "Coze 返回错误")
                      : "Coze 返回错误"
                  sendErr("COZE_REQUEST_FAILED", msg)
                  closed = true
                  controller.close()
                  return
                }

                const content = anyPayload["content"]
                if (content && typeof content === "object" && (content as Record<string, unknown>)["error"]) {
                  const err = (content as Record<string, unknown>)["error"]
                  const msg =
                    err && typeof err === "object"
                      ? String((err as Record<string, unknown>)["error_msg"] ?? "Coze 返回错误")
                      : "Coze 返回错误"
                  sendErr("COZE_REQUEST_FAILED", msg)
                  closed = true
                  controller.close()
                  return
                }

                if (anyPayload["type"] === "answer") {
                  const ans =
                    content && typeof content === "object" ? (content as Record<string, unknown>)["answer"] : ""
                  if (typeof ans === "string" && ans) {
                    fullAnswer += ans
                    send({ type: "delta", outlineSequence, text: ans })
                  }
                }
              }
            }
          }

          const output = parseRewriteOutput(fullAnswer)
          const durationMs = Date.now() - start

          if (!output) {
            logger.warn({
              event: "coze_rewrite_stream_result_unparsed",
              module: "coze",
              traceId,
              message: "流式输出无法解析为标准 4 字段",
              storyId,
              outlineSequence,
              durationMs
            })
            sendErr("COZE_RESPONSE_INVALID", "Coze 回包格式不符合预期")
            closed = true
            controller.close()
            return
          }

          try {
            await db
              .update(storyOutlines)
              .set({
                outlineText: output.new_title,
                originalText: output.new_content
              })
              .where(eq(storyOutlines.id, current.id))
          } catch (err) {
            const anyErr = err as { name?: string; message?: string; stack?: string }
            logger.error({
              event: "coze_rewrite_stream_persist_failed",
              module: "coze",
              traceId,
              message: "改写结果写入 story_outlines 失败",
              storyId,
              outlineSequence,
              errorName: anyErr?.name,
              errorMessage: anyErr?.message,
              stack: anyErr?.stack
            })
            sendErr("DB_WRITE_FAILED", "改写结果写入失败，请稍后重试")
            closed = true
            controller.close()
            return
          }

          send({ type: "result", outlineSequence, result: output })

          logger.info({
            event: "coze_rewrite_stream_success",
            module: "coze",
            traceId,
            message: "流式改写完成",
            storyId,
            outlineSequence,
            durationMs
          })

          closed = true
          controller.close()
        } catch (err) {
          const durationMs = Date.now() - start
          const anyErr = err as { name?: string; message?: string; stack?: string }
          const code = anyErr?.name === "AbortError" ? "COZE_TIMEOUT" : "COZE_UNKNOWN"
          sendErr(code, anyErr?.name === "AbortError" ? "请求超时" : "请求异常")
          logger.error({
            event: "coze_rewrite_stream_error",
            module: "coze",
            traceId,
            message: "流式改写异常",
            storyId,
            outlineSequence,
            durationMs,
            errorName: anyErr?.name,
            errorMessage: anyErr?.message,
            stack: anyErr?.stack
          })
          closed = true
          controller.close()
        } finally {
          clearTimeout(timer)
        }
      }
    })

    return stream
  }
}
