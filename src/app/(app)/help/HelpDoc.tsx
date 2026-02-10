"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactElement } from "react"
import { BookOpen, Film, FolderOpen, LifeBuoy, LogIn, NotebookPen, Video } from "lucide-react"
import styles from "./HelpDoc.module.css"
import { buildHelpSections, type DocSection } from "./HelpDocContent"

function useActiveSection(sectionIds: string[]): string {
  const [active, setActive] = useState(sectionIds[0] ?? "")

  useEffect(() => {
    const ids = sectionIds.filter(Boolean)
    if (ids.length === 0) return

    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (typeof IntersectionObserver !== "function") return

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0))
        const next = visible[0]?.target?.id
        if (next) setActive(next)
      },
      {
        root: null,
        rootMargin: "-20% 0px -70% 0px",
        threshold: [0, 1]
      }
    )

    headings.forEach((h) => obs.observe(h))
    return () => obs.disconnect()
  }, [sectionIds])

  return active
}

export function HelpDoc(): ReactElement {
  const sections: DocSection[] = useMemo(() => buildHelpSections(), [])

  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections])
  const activeId = useActiveSection(sectionIds)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const topic = (params.get("topic") ?? "").trim()
    if (!topic) return

    const topicToAnchor: Record<string, string> = {
      login: "login",
      library: "library",
      "script-start": "script-start",
      "script-outline": "script-outline",
      "script-storyboard": "script-storyboard",
      "video-generate": "video-generate",
      "video-export": "video-export",
      "task-center": "task-center",
      tvc: "tvc"
    }

    const preferredId = topicToAnchor[topic] ?? topic
    const target =
      document.getElementById(preferredId) ??
      (topic === "script-start" || topic === "script-outline" || topic === "script-storyboard"
        ? document.getElementById("script-workspace")
        : topic === "video-generate" || topic === "video-export"
          ? document.getElementById("video-creation")
          : null)

    if (!target) return

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start" })
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}#${target.id}`)
    })
  }, [])

  return (
    <div className={styles.doc}>
      <aside className={styles.toc} aria-label="帮助中心目录">
        <div className={styles.tocHeader}>
          <div className={styles.tocTitle}>使用文档</div>
          <div className={styles.tocHint}>从左侧目录快速定位到对应功能说明</div>
        </div>
        <div className={styles.tocList}>
          {sections.map((s) => {
            const active = s.id === activeId
            return (
              <a key={s.id} className={`${styles.tocItem} ${active ? styles.tocItemActive : ""}`} href={`#${s.id}`}>
                <span className={`${styles.tocDot} ${active ? styles.tocDotActive : ""}`} aria-hidden="true" />
                <span>{s.title}</span>
              </a>
            )
          })}
        </div>
      </aside>

      <div className={styles.content}>
        <div className={styles.contentHeader}>
          <div className={styles.pageTitle}>
            <h1 className={styles.pageTitleText}>帮助中心</h1>
            <p className={styles.pageSubtitle}>AI 视频创作平台 · 使用指南（覆盖内容库、剧本创作、视频创作与常见排障）</p>
          </div>
          <div className={styles.quickLinks} aria-label="快速入口">
            <Link className={`${styles.quickLink} ${styles.quickLinkPrimary}`} href="/library">
              <FolderOpen size={16} strokeWidth={2.2} />
              内容库
            </Link>
            <Link className={styles.quickLink} href="/script/workspace?entry=nav">
              <NotebookPen size={16} strokeWidth={2.2} />
              剧本创作
            </Link>
            <Link className={styles.quickLink} href="/video?tab=list">
              <Video size={16} strokeWidth={2.2} />
              分镜列表
            </Link>
            <Link className={styles.quickLink} href="/video/video">
              <Film size={16} strokeWidth={2.2} />
              生视频
            </Link>
            <Link className={styles.quickLink} href="/login">
              <LogIn size={16} strokeWidth={2.2} />
              登录
            </Link>
          </div>
        </div>

        <div className={styles.body}>
          {sections.map((s) => (
            <section key={s.id} className={styles.section} aria-label={s.title}>
              <h2 id={s.id} className={styles.h2}>
                {s.title}
              </h2>
              {s.content}
            </section>
          ))}

          <section className={styles.section} aria-label="更多帮助">
            <h2 id="more" className={styles.h2}>
              更多帮助
            </h2>
            <p className={styles.p}>
              如果你不确定下一步做什么，可以从 <Link className={styles.link} href="/library">内容库</Link> 进入，找到最近的故事继续推进。
            </p>
            <div className={styles.quickLinks}>
              <a className={styles.quickLink} href="#quickstart">
                <BookOpen size={16} strokeWidth={2.2} />
                回到快速开始
              </a>
              <a className={styles.quickLink} href="#troubleshooting">
                <LifeBuoy size={16} strokeWidth={2.2} />
                查看排障
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
