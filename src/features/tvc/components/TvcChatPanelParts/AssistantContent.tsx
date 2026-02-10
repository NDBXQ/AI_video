"use client"

import type { ReactElement } from "react"
import styles from "../TvcChatPanel.module.css"
import type { ChatMessage } from "@/features/tvc/types"
import { parseResponseXml } from "@/features/tvc/agent/parseAgentBlocks"
import { stripTvcAssistantEnvelope, stripXmlTags } from "./xmlUtils"

type AssistantStatus = {
  phase?: string
  nextStep?: string
  keyQuestion?: string
}

function extractAssistantStatus(text: string): { status: AssistantStatus | null; body: string } {
  const raw = String(text ?? "").replace(/\r\n/g, "\n")
  const lines = raw.split("\n")

  let phase: string | undefined
  let nextStep: string | undefined
  let keyQuestion: string | undefined

  const keep: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ""
    const t = line.trim()
    if (!t) {
      keep.push(line)
      continue
    }

    const mPhase = t.match(/^当前阶段[:：]\s*(.+)$/)
    if (mPhase && !phase) {
      phase = String(mPhase[1] ?? "").trim()
      continue
    }

    const mNext = t.match(/^下一步[:：]\s*(.+)$/)
    if (mNext && !nextStep) {
      nextStep = String(mNext[1] ?? "").trim()
      const n = (lines[i + 1] ?? "").trim()
      if (n === "阶段") {
        nextStep = `${nextStep}阶段`.trim()
        i++
      }
      continue
    }

    const mKey = t.match(/^关键问题[:：]\s*(.+)$/)
    if (mKey && !keyQuestion) {
      keyQuestion = String(mKey[1] ?? "").trim()
      continue
    }

    keep.push(line)
  }

  let body = keep.join("\n")
  body = body.replace(/^\s*\n+/, "").trimEnd()
  const status: AssistantStatus = { phase, nextStep, keyQuestion }
  const hasAny = Boolean(status.phase || status.nextStep || status.keyQuestion)
  return { status: hasAny ? status : null, body }
}

export function AssistantContent({ text, blocks, onAction }: { text: string; blocks?: ChatMessage["blocks"]; onAction: (command: string) => void }): ReactElement {
  const blockList = blocks ?? []
  const responses = blockList.filter((b) => b.kind === "response")
  if (responses.length === 0) {
    const raw = text ?? ""
    const outside = stripTvcAssistantEnvelope(raw)
    if (outside) {
      const { status, body } = extractAssistantStatus(outside)
      return (
        <div className={styles.inlineWrap}>
          {status ? (
            <div className={styles.assistantStatusCard}>
              <div className={styles.assistantStatusRow}>
                <div className={styles.assistantStatusLabel}>当前阶段</div>
                <div className={styles.assistantStatusValue}>{status.phase ?? "-"}</div>
              </div>
              <div className={styles.assistantStatusRow}>
                <div className={styles.assistantStatusLabel}>下一步</div>
                <div className={styles.assistantStatusValue}>{status.nextStep ?? "-"}</div>
              </div>
              <div className={styles.assistantStatusRow}>
                <div className={styles.assistantStatusLabel}>关键问题</div>
                <div className={`${styles.assistantStatusValue} ${!status.keyQuestion || status.keyQuestion === "无" ? styles.assistantStatusValueMuted : ""}`.trim()}>
                  {status.keyQuestion ?? "无"}
                </div>
              </div>
            </div>
          ) : null}
          {body.trim() ? <div className={styles.inlineText}>{body.trim()}</div> : null}
        </div>
      )
    }
    const openIdx = raw.lastIndexOf("<response")
    if (openIdx >= 0) {
      const openEnd = raw.indexOf(">", openIdx)
      const sliceStart = openEnd >= 0 ? openEnd + 1 : openIdx
      const closeIdx = raw.indexOf("</response>", Math.max(openIdx, openEnd + 1))
      const inner = closeIdx >= 0 ? raw.slice(sliceStart, closeIdx) : raw.slice(sliceStart)
      const show = stripXmlTags(inner)
      if (show) return <div className={styles.inlineText}>{show}</div>
    }
    const looksLikeXml = raw.includes("<step") || raw.includes("</step>") || raw.includes("<response") || raw.includes("</response>")
    if (looksLikeXml) return <></>
    return (
      <div className={styles.inlineWrap}>
        <div className={styles.inlineText}>{raw}</div>
      </div>
    )
  }

  const raw = text ?? ""
  const openIdx = raw.lastIndexOf("<response")
  if (openIdx >= 0) {
    const openEnd = raw.indexOf(">", openIdx)
    const sliceStart = openEnd >= 0 ? openEnd + 1 : openIdx
    const closeIdx = raw.indexOf("</response>", Math.max(openIdx, openEnd + 1))
    if (closeIdx < 0) {
      const inner = raw.slice(sliceStart)
      const show = stripXmlTags(inner)
      if (show) return <div className={styles.inlineText}>{show}</div>
    }
  }

  const parsedResponses = responses.map((r) => r.response ?? parseResponseXml(r.raw))
  const lastParsed = parsedResponses[parsedResponses.length - 1] ?? null
  const lastText = String(lastParsed?.text ?? "").trim()
  const concatText = parsedResponses
    .map((p) => String(p?.text ?? ""))
    .join("")
    .trim()
  const showText = (() => {
    if (!lastParsed) return ""
    if (!concatText) return lastParsed.text ?? ""
    const lastHasActions = (lastParsed.actions?.length ?? 0) > 0
    const looksLikeFinal = lastHasActions || (lastText.length > 0 && lastText.length >= Math.trunc(concatText.length * 0.8))
    return looksLikeFinal ? (lastParsed.text ?? "") : concatText
  })()
  const actions = (lastParsed?.actions ?? []).filter((a) => a.command !== "修改")
  const { status, body } = extractAssistantStatus(showText)

  return (
    <div className={styles.inlineWrap}>
      <div>
        {status ? (
          <div className={styles.assistantStatusCard}>
            <div className={styles.assistantStatusRow}>
              <div className={styles.assistantStatusLabel}>当前阶段</div>
              <div className={styles.assistantStatusValue}>{status.phase ?? "-"}</div>
            </div>
            <div className={styles.assistantStatusRow}>
              <div className={styles.assistantStatusLabel}>下一步</div>
              <div className={styles.assistantStatusValue}>{status.nextStep ?? "-"}</div>
            </div>
            <div className={styles.assistantStatusRow}>
              <div className={styles.assistantStatusLabel}>关键问题</div>
              <div className={`${styles.assistantStatusValue} ${!status.keyQuestion || status.keyQuestion === "无" ? styles.assistantStatusValueMuted : ""}`.trim()}>
                {status.keyQuestion ?? "无"}
              </div>
            </div>
          </div>
        ) : null}
        <div className={styles.inlineText}>{body.trim() ? body.trim() : showText}</div>
        {actions.length ? (
          <div className={styles.inlineActions}>
            {actions.map((a, i) => (
              <button
                key={`${a.command}_${i}`}
                type="button"
                className={`${styles.inlineActionBtn} ${i === 0 ? styles.inlineActionBtnPrimary : ""}`}
                onClick={() => onAction(a.command)}
              >
                {a.command}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
