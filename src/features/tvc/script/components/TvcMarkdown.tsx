"use client"

import type { ReactElement, ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import styles from "./TvcMarkdown.module.css"

function safeUrlTransform(url: string): string {
  const raw = String(url ?? "").trim()
  if (!raw) return ""
  if (raw.startsWith("#") || raw.startsWith("/")) return raw
  const lower = raw.toLowerCase()
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:") || lower.startsWith("tel:")) return raw
  return ""
}

export function TvcMarkdown(props: { markdown: string; className?: string }): ReactElement {
  const markdown = String(props.markdown ?? "")

  return (
    <div className={`${styles.root} ${props.className ?? ""}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeUrlTransform}
        components={{
          a: ({ children, href }) => {
            const safeHref = safeUrlTransform(String(href ?? ""))
            if (!safeHref) return <span className={styles.text}>{children as ReactNode}</span>
            return (
              <a className={styles.link} href={safeHref} target="_blank" rel="noreferrer noopener">
                {children as ReactNode}
              </a>
            )
          },
          code: ({ children }) => <code className={styles.inlineCode}>{children as ReactNode}</code>,
          pre: ({ children }) => <pre className={styles.pre}>{children as ReactNode}</pre>
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

