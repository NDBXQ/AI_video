import "server-only"

import { readEnvInt } from "@/shared/env"
import { makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { ServiceError } from "@/server/shared/errors"
import { auditDebug } from "@/shared/logAudit"
import { AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages"
import { getOrCreateStoryContext } from "../../context/vibeCreatingContext"
import { getVibeImageConfig, getVibeVideoConfig } from "../../vibeCreatingConfig"
import { VIBE_CREATING_DIRECT_SYSTEM_PROMPT } from "../vibeCreatingSystemPrompt"
import { buildDirectMessages } from "../../llm/buildDirectMessages"
import { createVibeCreatingToolExecutor } from "../../tools/vibeCreatingLlmTools"
import { appendStoryLlmMessages } from "../../persistence/vibeCreatingLlmMessageStore"
import { persistClarificationAsset } from "../../clarification/persistClarificationAsset"
import { persistScriptAsset } from "../../script/persistScriptAsset"
import { createVibeTaggedStreamDemux } from "../../script/vibeTaggedStreamDemux"
import { persistStoryboardsAsset } from "../../storyboards/persistStoryboardsAsset"
import type { TvcLlmMessage, TvcToolCall } from "../../llm/llmTypes"
import type { VibeSessionState } from "../../vibeCreatingState"
import type { TvcAgentStreamData } from "../vibeCreatingTypes"
import { createVibeCreatingLangChainModel } from "./vibeCreatingLangChainModel"
import { createVibeCreatingLangChainTools } from "./vibeCreatingLangChainTools"
import { convertTvcMessagesToLangChain, extractToolCalls, normalizeToolArgs, toInternalToolCalls } from "./vibeCreatingLangChainMessages"

function summarizeUserImagePartsForLog(messages: TvcLlmMessage[]): Array<Record<string, unknown>> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m || m.role !== "user") continue
    if (!Array.isArray(m.content)) return []
    const out: Array<Record<string, unknown>> = []
    for (const part of m.content as any[]) {
      if (String(part?.type ?? "") !== "image_url") continue
      const url = String(part?.image_url?.url ?? "").trim()
      if (!url) continue
      if (url.startsWith("data:")) {
        const head = url.slice(0, 64)
        out.push({ kind: "data_url", head, size: url.length })
        continue
      }
      try {
        const u = new URL(url)
        out.push({ kind: "url", host: u.host, path: u.pathname })
      } catch {
        out.push({ kind: "url", value: url.split("?")[0] })
      }
    }
    return out
  }
  return []
}

function phaseLabel(phase: number): string {
  if (phase === 0) return "0 需求澄清"
  if (phase === 1) return "1 剧本"
  if (phase === 2) return "2 参考图"
  if (phase === 3) return "3 分镜"
  if (phase === 4) return "4 首帧"
  return "5 视频与音乐"
}

function normalizeDialogMarkdown(text: string, phase: number): string {
  const trimmed = String(text ?? "").trim()
  const withoutTags = trimmed.replace(/<\/?[a-zA-Z][^>]*>/g, (m) => m.replaceAll("<", "＜").replaceAll(">", "＞"))
  const lines = withoutTags.split(/\r?\n/)
  const hasPhase = lines.some((l) => l.trim().startsWith("当前阶段："))
  const hasNext = lines.some((l) => l.trim().startsWith("下一步："))
  const hasQuestions = lines.some((l) => l.trim().startsWith("关键问题："))
  const prefix: string[] = []
  if (!hasPhase) prefix.push(`当前阶段：${phaseLabel(phase)}`)
  if (!hasNext) prefix.push("下一步：…")
  if (!hasQuestions) prefix.push("关键问题：无")
  return [...prefix, ...lines].join("\n").trim()
}

function ensureToolCallsOnAiMessages(messages: BaseMessage[]): void {
  for (const m of messages) {
    const anyMsg = m as any
    const content = anyMsg?.content
    if (typeof content !== "string" && !Array.isArray(content)) {
      anyMsg.content = ""
    }
    const toolCalls = anyMsg?.tool_calls
    const fallback = anyMsg?.additional_kwargs?.tool_calls
    const additional = (() => {
      if (anyMsg.additional_kwargs && typeof anyMsg.additional_kwargs === "object") return anyMsg.additional_kwargs
      anyMsg.additional_kwargs = {}
      return anyMsg.additional_kwargs
    })()
    if (Array.isArray(toolCalls)) continue
    if (Array.isArray(fallback)) {
      anyMsg.tool_calls = toInternalToolCalls(fallback)
      if (!Array.isArray(additional.tool_calls)) additional.tool_calls = fallback
      continue
    }
    anyMsg.tool_calls = []
    if (!Array.isArray(additional.tool_calls)) additional.tool_calls = []
  }
}

export async function createVibeCreatingLangChainStream(params: {
  traceId: string
  userId: string
  prompt: string
  projectId: string | null
}): Promise<ReadableStream<Uint8Array>> {
  const { traceId, userId, prompt, projectId } = params
  const timeoutMs = readEnvInt("VIBE_TVC_AGENT_TIMEOUT_MS") ?? readEnvInt("REQUEST_TIMEOUT_MS") ?? 120_000
  const maxSteps = readEnvInt("VIBE_TVC_AGENT_MAX_STEPS") ?? 10

  const encoder = new TextEncoder()
  const controllerAbort = new AbortController()
  const timer = setTimeout(() => controllerAbort.abort(), timeoutMs)
  let closed = false
  const startAt = Date.now()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: TvcAgentStreamData) => {
        if (closed) return
        const payload = JSON.stringify(makeApiOk(traceId, data))
        controller.enqueue(encoder.encode(`event: ${data.type}\ndata: ${payload}\n\n`))
      }

      const sendErr = (code: string, message: string) => {
        send({ type: "error", code, message })
      }

      const sendStatus = (text: string, extra?: Omit<Extract<TvcAgentStreamData, { type: "status" }>, "type" | "text">) => {
        const t = String(text ?? "").trim()
        if (!t) return
        send({ type: "status", text: t, ...(extra ?? {}) })
      }

      send({ type: "start" })
      logger.info({
        event: "tvc_langchain_stream_start",
        module: "tvc_agent",
        traceId,
        message: "开始请求 TVC LangChain 智能体流",
        userId,
        projectId
      })

      try {
        const story = projectId ? await getOrCreateStoryContext({ storyId: projectId, userId, traceId }) : null
        const system = VIBE_CREATING_DIRECT_SYSTEM_PROMPT
        const tvcMessages = buildDirectMessages({
          system,
          story,
          userPrompt: prompt,
          maxHistoryMessages: 20
        })
        auditDebug(
          "tvc_agent",
          "tvc_langchain_input_images",
          "本轮传入模型的图片摘要",
          { traceId, ...(story?.storyId ? { storyId: story.storyId } : {}), runId: traceId },
          { images: summarizeUserImagePartsForLog(tvcMessages) }
        )

        const image = getVibeImageConfig()
        const video = getVibeVideoConfig()
        let toolState: VibeSessionState = { currentStep: 0, productImages: [], createdAt: Date.now(), updatedAt: Date.now() }
        const toolExecutor = createVibeCreatingToolExecutor({
          traceId,
          storyId: story?.storyId ?? projectId ?? "unknown-story",
          getState: () => toolState,
          setState: (s) => {
            toolState = s
          },
          sendEvent: send,
          sendStatus,
          image,
          video
        })

        const tools = createVibeCreatingLangChainTools()
        const toolByName = new Map(tools.map((t) => [t.name, t]))
        for (const t of tools) {
          ;(t as any).func = async (input: unknown) => {
            const args = normalizeToolArgs(input)
            const id = crypto.randomUUID()
            const call: TvcToolCall = { id, type: "function", function: { name: t.name, arguments: JSON.stringify(args) } }
            return toolExecutor(call)
          }
        }

        const model = createVibeCreatingLangChainModel(traceId)
        const modelWithTools = (model as any).bindTools ? (model as any).bindTools(tools) : model
        const messages: BaseMessage[] = convertTvcMessagesToLangChain(tvcMessages)

        let accumulated = ""
        let lastUiPingAt = Date.now()
        let gotAnyDelta = false
        const appendedLlmMessages: TvcLlmMessage[] = []

        const demux = createVibeTaggedStreamDemux({
          onOutside: (t) => {
            gotAnyDelta = true
            lastUiPingAt = Date.now()
            accumulated += t
            send({ type: "delta", text: t })
          },
          onClarificationDelta: (t) => {
            gotAnyDelta = true
            lastUiPingAt = Date.now()
            send({ type: "clarification", phase: "delta", markdown: t })
          },
          onClarificationDone: (full) => {
            send({ type: "clarification", phase: "done", markdown: full })
            const storyId = story?.storyId ?? projectId ?? ""
            if (storyId) void persistClarificationAsset({ traceId, storyId, userId, markdown: full }).catch(() => {})
          },
          onScriptDelta: (t) => {
            gotAnyDelta = true
            lastUiPingAt = Date.now()
            send({ type: "script", phase: "delta", markdown: t })
          },
          onScriptDone: (full) => {
            send({ type: "script", phase: "done", markdown: full })
            const storyId = story?.storyId ?? projectId ?? ""
            if (storyId) void persistScriptAsset({ traceId, storyId, userId, markdown: full }).catch(() => {})
          },
          onStoryboardsDelta: () => {},
          onStoryboardsDone: (inner) => {
            const storyId = story?.storyId ?? projectId ?? ""
            if (!storyId) return
            const xml = `<storyboards>${String(inner ?? "")}</storyboards>`
            void persistStoryboardsAsset({ traceId, storyId, userId, storyboardsXml: xml }).catch(() => {})
          }
        })

        sendStatus("正在思考...")
        const heartbeat = setInterval(() => {
          if (closed || controllerAbort.signal.aborted) return
          const now = Date.now()
          if (now - lastUiPingAt < 1200) return
          lastUiPingAt = now
          if (!gotAnyDelta) controller.enqueue(encoder.encode(`: ping ${now}\n\n`))
        }, 500)

        try {
          for (let step = 0; step < maxSteps; step++) {
            ensureToolCallsOnAiMessages(messages)
            console.log("====messages=====\n", messages)
            const ai = (await modelWithTools.invoke(messages, { signal: controllerAbort.signal } as any)) as AIMessage
            const toolCalls = extractToolCalls(ai)

            const assistantContent = Array.isArray(ai.content)
              ? ai.content.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
              : String(ai.content ?? "")

            if (!toolCalls.length) {
              const chunkSize = 64
              for (let i = 0; i < assistantContent.length; i += chunkSize) {
                demux.push(assistantContent.slice(i, i + chunkSize))
              }
              appendedLlmMessages.push({ role: "assistant", content: assistantContent })
              messages.push(ai)
              break
            }

            const toolCallsForDb: TvcToolCall[] = toolCalls.map((c) => ({
              id: c.id || crypto.randomUUID(),
              type: "function",
              function: { name: c.name || "", arguments: JSON.stringify(normalizeToolArgs(c.args)) }
            }))
            const toolCallsInternal = toolCalls.map((c) => ({
              id: c.id || crypto.randomUUID(),
              name: c.name || "",
              args: normalizeToolArgs(c.args)
            }))
            appendedLlmMessages.push({ role: "assistant", content: assistantContent, tool_calls: toolCallsForDb })
            messages.push(
              new AIMessage({
                content: assistantContent,
                tool_calls: toolCallsInternal,
                additional_kwargs: { tool_calls: toolCallsForDb }
              } as any)
            )

            for (const call of toolCallsForDb) {
              const tool = toolByName.get(call.function.name)
              if (!tool) {
                const err = JSON.stringify({ error: "TOOL_NOT_FOUND", message: `工具不存在：${call.function.name}` })
                appendedLlmMessages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: err })
                messages.push(new ToolMessage({ content: err, tool_call_id: call.id } as any))
                continue
              }
              sendStatus(`正在调用工具：${call.function.name}`, { op: call.function.name })
              const output = await toolExecutor(call)
              appendedLlmMessages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: output })
              messages.push(new ToolMessage({ content: output, tool_call_id: call.id } as any))
            }
          }
        } finally {
          clearInterval(heartbeat)
        }

        const remainder = demux.flush().outsideRemainder
        if (remainder) accumulated += remainder

        const raw = normalizeDialogMarkdown(accumulated, Math.trunc((toolState as any)?.currentStep ?? 0))
        send({ type: "result", raw, responseText: raw })

        if (story) {
          await appendStoryLlmMessages({
            storyId: story.storyId,
            userId,
            runId: traceId,
            messages: [{ role: "user", content: String(prompt ?? "") }, ...(appendedLlmMessages as any)]
          }).catch((err) => {
            logger.error({
              event: "tvc_llm_messages_persist_failed",
              module: "tvc_agent",
              traceId,
              message: "写入 llm_messages 失败",
              storyId: story.storyId,
              errorName: (err as any)?.name,
              errorMessage: (err as any)?.message
            })
          })
        }

        logger.info({
          event: "tvc_langchain_stream_success",
          module: "tvc_agent",
          traceId,
          message: "TVC LangChain 模式完成",
          userId,
          durationMs: Date.now() - startAt
        })
        closed = true
        controller.close()
      } catch (err) {
        const anyErr = err as { name?: string; message?: string }
        if (anyErr?.name === "AbortError") {
          sendErr("VIBE_TIMEOUT", "TVC LangChain 请求超时")
        } else if (err instanceof ServiceError) {
          sendErr(err.code, err.message)
        } else {
          sendErr("VIBE_STREAM_FAILED", anyErr?.message ?? "TVC LangChain 请求失败")
        }
        logger.error({
          event: "tvc_langchain_stream_failed",
          module: "tvc_agent",
          traceId,
          message: "TVC LangChain 智能体流式处理失败",
          errorName: (err as any)?.name,
          errorMessage: (err as any)?.message,
          errorStack: (err as any)?.stack
        })
        closed = true
        controller.close()
      } finally {
        clearTimeout(timer)
      }
    },
    cancel() {
      closed = true
      clearTimeout(timer)
      controllerAbort.abort()
    }
  })

  return stream
}
