import Link from "next/link"
import type { ReactElement } from "react"
import { cookies } from "next/headers"
import { getDb } from "@/server/db/getDb"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { desc, eq, inArray, and } from "drizzle-orm"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import styles from "./ContinueWorkSection.module.css"
import { EmptyState } from "@/components/empty-state/EmptyState"

type RecentStory = {
  id: string
  title: string
  updatedAt: Date | null
  aspectRatio: string
  resolution: string
  progressStage: string
  storyType: string | null
  outlineId: string | null
  previewUrl: string | null
}

function stageLabel(stage: string): string {
  if (stage === "done") return "已完成"
  if (stage === "video_assets") return "视频"
  if (stage === "image_assets") return "素材"
  if (stage === "video_script" || stage === "storyboard_text") return "分镜"
  return "草稿"
}

function buildResumeHref(story: RecentStory): string {
  const stage = story.progressStage
  if (
    stage === "storyboard_text" ||
    stage === "video_script" ||
    stage === "image_assets" ||
    stage === "video_assets" ||
    stage === "done"
  ) {
    const qs = new URLSearchParams({ tab: "list", storyId: story.id })
    if (story.outlineId) qs.set("outlineId", story.outlineId)
    return `/video?${qs.toString()}`
  }
  const mode = story.storyType === "source" ? "source" : "brief"
  return `/script/workspace/${encodeURIComponent(story.id)}?mode=${encodeURIComponent(mode)}`
}

function formatTime(d: Date | null): string {
  if (!d) return ""
  return new Date(d)
    .toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
    .replace(/\//g, "-")
}

/**
 * 继续创作区块（当前为默认空态）
 * @returns {ReactElement} 区块内容
 */
export async function ContinueWorkSection(): Promise<ReactElement> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const traceId = getTraceId(new Headers())

  const recentStories: RecentStory[] = await (async () => {
    if (!token) return []
    const session = await verifySessionToken(token, traceId)
    if (!session) return []

    const db = await getDb({ stories, storyOutlines, storyboards })
    const rows = await db
      .select({
        id: stories.id,
        title: stories.title,
        updatedAt: stories.updatedAt,
        aspectRatio: stories.aspectRatio,
        resolution: stories.resolution,
        progressStage: stories.progressStage,
        storyType: stories.storyType
      })
      .from(stories)
      .where(eq(stories.userId, session.userId))
      .orderBy(desc(stories.updatedAt))
      .limit(3)

    const ids = rows.map((r) => r.id)
    if (ids.length === 0) return []

    const outlineRows = await db
      .select({ storyId: storyOutlines.storyId, id: storyOutlines.id, sequence: storyOutlines.sequence })
      .from(storyOutlines)
      .where(inArray(storyOutlines.storyId, ids))
      .orderBy(desc(storyOutlines.sequence))

    const outlineByStoryId = new Map<string, { id: string; sequence: number }>()
    for (const r of outlineRows) {
      const existed = outlineByStoryId.get(r.storyId)
      if (!existed || r.sequence > existed.sequence) outlineByStoryId.set(r.storyId, { id: r.id, sequence: r.sequence })
    }

    const firstEpisodeRows = await db
      .select({ storyId: storyOutlines.storyId, outlineId: storyOutlines.id })
      .from(storyOutlines)
      .where(and(inArray(storyOutlines.storyId, ids), eq(storyOutlines.sequence, 1)))

    const firstOutlineIdByStoryId = new Map<string, string>()
    for (const r of firstEpisodeRows) {
      firstOutlineIdByStoryId.set(r.storyId, r.outlineId)
    }

    const firstOutlineIds = Array.from(new Set(firstEpisodeRows.map((r) => r.outlineId)))
    const storyboardRows =
      firstOutlineIds.length > 0
        ? await db
            .select({ outlineId: storyboards.outlineId, frames: storyboards.frames })
            .from(storyboards)
            .where(and(inArray(storyboards.outlineId, firstOutlineIds), eq(storyboards.sequence, 1)))
        : []

    const previewByOutlineId = new Map<string, string>()
    for (const r of storyboardRows) {
      const frames = r.frames as unknown as { first?: { thumbnailUrl?: string | null; url?: string | null } } | null
      const url = (frames?.first?.thumbnailUrl ?? frames?.first?.url ?? "").trim()
      if (url) previewByOutlineId.set(r.outlineId, url)
    }

    return rows.map((r) => {
      const normalizedTitle = (r.title ?? "未命名").trim() || "未命名"
      const normalizedStage = (r.progressStage ?? "draft").trim() || "draft"
      const latestOutlineId = outlineByStoryId.get(r.id)?.id ?? null
      const firstOutlineId = firstOutlineIdByStoryId.get(r.id) ?? null
      const previewUrl = firstOutlineId ? previewByOutlineId.get(firstOutlineId) ?? null : null
      return {
        ...r,
        title: normalizedTitle,
        progressStage: normalizedStage,
        outlineId: latestOutlineId,
        previewUrl
      }
    })
  })()

  return (
    <section className={styles.card} aria-label="继续创作">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon} aria-hidden="true" />
          <span className={styles.headerTitle}>继续创作</span>
          <span className={styles.headerHint}>最近项目会出现在这里</span>
        </div>
        <Link href="/library" className={styles.headerLink}>
          查看全部
        </Link>
      </div>

      {recentStories.length > 0 ? (
        <div>
          <div className={styles.cards} aria-label="最近项目列表">
            {recentStories.map((s) => (
              <Link key={s.id} href={buildResumeHref(s)} className={styles.cardItem}>
                <div className={styles.thumb} aria-label="预览图">
                  {s.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.thumbImg} src={s.previewUrl} alt={s.title} loading="lazy" decoding="async" />
                  ) : (
                    <div className={styles.thumbPlaceholder} aria-hidden="true" />
                  )}
                  <div className={styles.thumbBadge}>{stageLabel(s.progressStage)}</div>
                </div>

                <div className={styles.meta}>
                  <div className={styles.metaTitle}>{s.title}</div>
                  <div className={styles.metaRow}>
                    <div className={styles.metaSpecs}>
                      {s.aspectRatio} ｜ {s.resolution}
                    </div>
                    <div className={styles.metaTime}>{formatTime(s.updatedAt)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className={styles.listFooter}>
            <div className={styles.footerHint}>点击继续上次进度</div>
            <Link href="/library" className={styles.footerLink}>
              去内容库管理 →
            </Link>
          </div>
        </div>
      ) : (
        <EmptyState
          title="暂无最近项目"
          description="从剧本创作开始，或者先去内容库准备素材"
          primaryAction={{ label: "去创作剧本", href: "/script/workspace?entry=nav" }}
          secondaryAction={{ label: "打开内容库", href: "/library" }}
          learnHref="/help?topic=script-start"
        />
      )}
    </section>
  )
}
