"use client"

import type { ReactElement } from "react"
import styles from "./TvcScriptDocument.module.css"
import { Badge } from "@/shared/ui/shadcn/badge"
import { Separator } from "@/shared/ui/shadcn/separator"
import { TvcMarkdown } from "./TvcMarkdown"

type DocSection = { id: string; title: string; body: string }

function normalizeId(raw: string): string {
  const base = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u00A0\s]+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return base || "section"
}

function isCtaSection(title: string): boolean {
  const t = String(title ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u00A0\s]+/g, "")
  if (!t) return false
  if (t === "cta") return true
  if (t.includes("行动号召")) return true
  if (t.includes("转化引导")) return true
  if (t.includes("引导")) return true
  return false
}

function splitMarkdown(markdown: string): { title: string; sections: DocSection[] } {
  const lines = String(markdown ?? "").split(/\r?\n/g)
  let title = ""
  const sections: Array<{ title: string; lines: string[] }> = []
  let current: { title: string; lines: string[] } | null = null

  for (const rawLine of lines) {
    const line = rawLine ?? ""
    const h1 = line.match(/^#\s+(.+?)\s*$/)
    if (!title && h1?.[1]) {
      title = h1[1].trim()
      continue
    }
    const h2 = line.match(/^##\s+(.+?)\s*$/)
    if (h2?.[1]) {
      if (current) sections.push(current)
      current = { title: h2[1].trim(), lines: [] }
      continue
    }
    if (!current) current = { title: "内容", lines: [] }
    current.lines.push(line)
  }

  if (current) sections.push(current)
  const docSections = sections
    .map((s, idx) => {
      const body = s.lines.join("\n").trim()
      if (!s.title || !body) return null
      if (isCtaSection(s.title)) return null
      return { id: `${normalizeId(s.title)}-${idx + 1}`, title: s.title, body }
    })
    .filter(Boolean) as DocSection[]

  return { title, sections: docSections }
}

function isStoryline(title: string): boolean {
  const t = title.replace(/\s+/g, "")
  return t.includes("故事线") || t.includes("故事")
}

function isVoiceover(title: string): boolean {
  const t = title.replace(/\s+/g, "")
  return t.includes("口播") || t.includes("旁白") || t.includes("台词")
}

function parseStoryline(body: string): Array<{ time: string; text: string }> {
  return body
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\d+)\s*[-–—~～]\s*(\d+)\s*(s|sec|秒)?\s*[：:]\s*(.+)$/i)
      if (!m) return null
      return { time: `${m[1]}-${m[2]}s`, text: m[4].trim() }
    })
    .filter(Boolean) as Array<{ time: string; text: string }>
}

function parseVoiceover(body: string): Array<{ meta: string; speaker: string; text: string }> {
  return body
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^（?\s*(\d+)\s*[-–—~～]\s*(\d+)\s*(s|sec|秒)?\s*）?\s*([^：:]{1,10})[：:]\s*(.+)$/i)
      if (!m) return null
      return { meta: `${m[1]}-${m[2]}s`, speaker: m[4].trim(), text: m[5].trim() }
    })
    .filter(Boolean) as Array<{ meta: string; speaker: string; text: string }>
}

export function TvcScriptDocument({ markdown }: { markdown: string }): ReactElement | null {
  const raw = String(markdown ?? "").trim()
  if (!raw) return null

  const { title, sections } = splitMarkdown(raw)
  const toc = sections.map((s) => ({ id: s.id, title: s.title }))

  return (
    <div className={styles.doc} aria-label="剧本文档">
      <div className={styles.docHeader}>
        <div className={styles.docTitle}>{title || "剧本"}</div>
        <Badge variant="outline" className={styles.docBadge}>
          已生成
        </Badge>
      </div>
      {toc.length ? (
        <div className={styles.toc} aria-label="目录">
          {toc.map((i) => (
            <a key={i.id} className={styles.tocItem} href={`#${i.id}`}>
              {i.title}
            </a>
          ))}
        </div>
      ) : null}
      <Separator className={styles.sep} />
      <div className={styles.sections}>
        {sections.map((s) => {
          const storyline = isStoryline(s.title) ? parseStoryline(s.body) : []
          const voiceover = isVoiceover(s.title) ? parseVoiceover(s.body) : []
          const useStoryline = storyline.length >= 2
          const useVoiceover = !useStoryline && voiceover.length >= 1

          return (
            <section key={s.id} id={s.id} className={styles.section} aria-label={s.title}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>{s.title}</div>
              </div>
              {useStoryline ? (
                <div className={styles.timeline} aria-label="故事线">
                  {storyline.map((it) => (
                    <div key={`${it.time}_${it.text.slice(0, 12)}`} className={styles.timelineItem}>
                      <div className={styles.timelineTime}>{it.time}</div>
                      <div className={styles.timelineText}>{it.text}</div>
                    </div>
                  ))}
                </div>
              ) : useVoiceover ? (
                <div className={styles.voiceover} aria-label="口播建议">
                  {voiceover.map((it) => (
                    <div key={`${it.meta}_${it.speaker}_${it.text.slice(0, 10)}`} className={styles.voiceoverItem}>
                      <div className={styles.voiceoverMeta}>{it.meta}</div>
                      <div className={styles.voiceoverSpeaker}>{it.speaker}</div>
                      <div className={styles.voiceoverText}>{it.text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.prose}>
                  <TvcMarkdown markdown={s.body} />
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
