import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react"
import styles from "./StoryboardPromptCard.module.css"

type StoryboardPromptCardProps = {
  title: string
  text: string
  emptyText?: string
}

export function StoryboardPromptCard({ title, text, emptyText = "未生成" }: StoryboardPromptCardProps): ReactElement {
  const content = (text ?? "").trim()
  const value = content || emptyText

  const canExpand = useMemo(() => value !== emptyText && value.length > 140, [emptyText, value])
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setExpanded(false), 0)
    return () => window.clearTimeout(t)
  }, [value])

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1200)
    return () => window.clearTimeout(t)
  }, [copied])

  const handleCopy = useCallback(async () => {
    if (!value || value === emptyText) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      try {
        const ta = document.createElement("textarea")
        ta.value = value
        ta.style.position = "fixed"
        ta.style.left = "-9999px"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
        setCopied(true)
      } catch {
      }
    }
  }, [emptyText, value])

  return (
    <div className={styles.card} aria-label={title}>
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.actionBtn} onClick={() => void handleCopy()} disabled={value === emptyText}>
            {copied ? "已复制" : "复制"}
          </button>
          {canExpand ? (
            <button type="button" className={styles.actionBtn} onClick={() => setExpanded((v) => !v)}>
              {expanded ? "收起" : "展开"}
            </button>
          ) : null}
        </div>
      </div>
      <pre className={`${styles.body} ${expanded ? styles.bodyExpanded : ""}`}>{value}</pre>
    </div>
  )
}
