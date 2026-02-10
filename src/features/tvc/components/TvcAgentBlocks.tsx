"use client"

import type { ReactElement } from "react"
import styles from "./TvcAgentBlocks.module.css"
import type { TvcAgentBlock, TvcAgentResponse } from "@/features/tvc/agent/types"

function renderKvRows(entries: Array<{ key: string; value: string }>): ReactElement {
  return (
    <div className={styles.kvGrid}>
      {entries.map((kv, idx) => (
        <div key={`${kv.key}_${idx}`} className={styles.kvRow}>
          <div className={styles.kvKey} title={kv.key}>
            {kv.key}
          </div>
          <div className={styles.kvVal}>{kv.value}</div>
        </div>
      ))}
    </div>
  )
}

function ResponseCard({
  response,
  onAction
}: {
  response: TvcAgentResponse
  onAction?: (command: string) => void
}): ReactElement {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>交互</div>
        <div className={styles.badge}>Response</div>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.textBlock}>{response.text}</div>
        {response.actions.length ? (
          <div className={styles.actions}>
            {response.actions.map((a, idx) => (
              <button
                key={`${a.command}_${idx}`}
                type="button"
                className={`${styles.actionBtn} ${idx === 0 ? styles.actionBtnPrimary : ""}`}
                onClick={() => onAction?.(a.command)}
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

export function TvcAgentBlocks({
  blocks,
  onAction
}: {
  blocks: TvcAgentBlock[]
  onAction?: (command: string) => void
}): ReactElement {
  return (
    <div className={styles.wrap}>
      {blocks.map((b, idx) => {
        if (b.kind === "text") {
          return (
            <div key={`t_${idx}`} className={styles.textBlock}>
              {b.text}
            </div>
          )
        }
        if (b.kind === "response") {
          if (b.response) return <ResponseCard key={`r_${idx}`} response={b.response} onAction={onAction} />
          return (
            <div key={`r_${idx}`} className={styles.textBlock}>
              {b.raw}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
