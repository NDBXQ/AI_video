"use client"

import type { ReactElement } from "react"
import styles from "../TvcChatPanel.module.css"
import type { ChatMessage } from "@/features/tvc/types"
import { parseResponseXml } from "@/features/tvc/agent/parseAgentBlocks"
import { stripTvcAssistantEnvelope, stripXmlTags } from "./xmlUtils"

export function AssistantContent({ text, blocks, onAction }: { text: string; blocks?: ChatMessage["blocks"]; onAction: (command: string) => void }): ReactElement {
  const blockList = blocks ?? []
  const responses = blockList.filter((b) => b.kind === "response")
  if (responses.length === 0) {
    const raw = text ?? ""
    const outside = stripTvcAssistantEnvelope(raw)
    if (outside) return <>{outside}</>
    const openIdx = raw.lastIndexOf("<response")
    if (openIdx >= 0) {
      const openEnd = raw.indexOf(">", openIdx)
      const sliceStart = openEnd >= 0 ? openEnd + 1 : openIdx
      const closeIdx = raw.indexOf("</response>", Math.max(openIdx, openEnd + 1))
      const inner = closeIdx >= 0 ? raw.slice(sliceStart, closeIdx) : raw.slice(sliceStart)
      const show = stripXmlTags(inner)
      if (show) return <>{show}</>
    }
    const looksLikeXml = raw.includes("<step") || raw.includes("</step>") || raw.includes("<response") || raw.includes("</response>")
    if (looksLikeXml) return <></>
    return <>{raw}</>
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
      if (show) return <>{show}</>
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

  return (
    <div className={styles.inlineWrap}>
      <div>
        <div className={styles.inlineText}>{showText}</div>
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
