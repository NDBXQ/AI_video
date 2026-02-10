"use client"

import { useMemo, useState } from "react"
import styles from "./AgentChatPage.module.css"
import { createSseDecoder } from "@/shared/sse"

type StreamEvent =
  | { event: "meta"; data: { traceId?: string } }
  | { event: "token"; data: string }
  | { event: "tool_calls"; data: unknown }
  | { event: "tool_result"; data: unknown }
  | { event: "done"; data: unknown }
  | { event: "error"; data: { code?: string; message?: string } }
  | { event: string; data: unknown }

function tryParseJson(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return input
  }
}

export function AgentChatPage() {
  const [input, setInput] = useState("现在几点了？")
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState("")
  const [traceId, setTraceId] = useState<string | null>(null)

  const decoder = useMemo(() => new TextDecoder(), [])
  const sse = useMemo(() => createSseDecoder(), [])

  const append = (text: string) => setOutput((prev) => prev + text)

  const run = async () => {
    if (!input.trim() || running) return
    setRunning(true)
    setTraceId(null)
    setOutput("")

    try {
      const res = await fetch("/api/agent/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        const msg = err?.error?.message ?? "请求失败"
        append(msg)
        setRunning(false)
        return
      }

      if (!res.body) {
        append("响应无 body")
        setRunning(false)
        return
      }

      const reader = res.body.getReader()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        const events = sse.push(text)
        for (const e of events) {
          const name = (e.event ?? "message") as StreamEvent["event"]
          const parsed = tryParseJson(e.data)
          if (name === "meta" && typeof parsed === "object" && parsed && "traceId" in parsed) {
            const t = (parsed as any).traceId
            if (typeof t === "string" && t) setTraceId(t)
            continue
          }
          if (name === "token") {
            append(String(parsed))
            continue
          }
          if (name === "tool_calls" || name === "tool_result" || name === "error") {
            append(`\n\n[${name}]\n${typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2)}\n`)
            continue
          }
          if (name === "done") {
            continue
          }
        }
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Agent Chat（LangChain.js）</div>
          <div className={styles.subTitle}>
            {traceId ? `traceId: ${traceId}` : "使用 /api/agent/chat/stream（SSE）"}
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.output}>{output || "输出会在这里显示（含 tool 事件）"}</div>

        <div className={styles.composer}>
          <textarea
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder="输入你的问题…"
          />
          <button className={styles.button} onClick={run} disabled={running}>
            {running ? "运行中…" : "发送"}
          </button>
        </div>
      </div>
    </div>
  )
}
