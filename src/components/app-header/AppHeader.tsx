"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactElement } from "react"
import { createPortal } from "react-dom"
import { CircleHelp, Home, Library, ListChecks, LogIn, LogOut, NotebookPen, RotateCw, Shield, UserRound, Video, X } from "lucide-react"
import { appNavItems } from "@/shared/navigation"
import { useActiveJobs } from "@/features/video/hooks/useActiveJobs"
import { EmptyState } from "@/components/empty-state/EmptyState"
import styles from "./AppHeader.module.css"

type MeResult =
  | { ok: true; data: { user: { id: string; account: string } }; traceId: string }
  | { ok: false; error: { code: string; message: string }; traceId: string }

type AppHeaderVariant = "app" | "auth"

type AppHeaderProps = {
  variant?: AppHeaderVariant
  autoHide?: boolean
}

/**
 * 应用顶部导航栏
 * @returns {ReactElement} Header 组件
 */
export function AppHeader({ variant = "app", autoHide }: AppHeaderProps): ReactElement {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const searchParams = useSearchParams()
  const [me, setMe] = useState<MeResult | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [activeStoryId, setActiveStoryId] = useState("")

  const isActive = (href: string): boolean => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  useEffect(() => {
    if (variant === "auth") return

    let cancelled = false

    ;(async (): Promise<void> => {
      try {
        const res = await fetch("/api/auth/me", { method: "GET" })
        const json = (await res.json()) as MeResult
        if (!cancelled) setMe(json)
      } catch {
        if (!cancelled)
          setMe({
            ok: false,
            error: { code: "NETWORK_ERROR", message: "网络错误" },
            traceId: "n/a"
          })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [variant])

  const derivedStoryId = useMemo(() => {
    const fromQuery = (searchParams?.get("storyId") ?? "").trim()
    if (fromQuery) return fromQuery
    const m = pathname.match(/^\/script\/workspace\/([^/]+)/)
    return (m?.[1] ?? "").trim()
  }, [pathname, searchParams])

  useEffect(() => {
    if (variant !== "app") return
    const next = derivedStoryId.trim()
    if (next) {
      setActiveStoryId(next)
      try {
        window.localStorage.setItem("last_story_id", next)
      } catch {}
      return
    }
    try {
      const cached = (window.localStorage.getItem("last_story_id") ?? "").trim()
      if (cached) setActiveStoryId(cached)
    } catch {}
  }, [derivedStoryId, variant])

  const { jobs, summary: jobSummary, loading: jobsLoading, error: jobsError, refresh: refreshJobs } = useActiveJobs({
    storyId: activeStoryId,
    enabled: variant === "app" && Boolean(activeStoryId)
  })

  const jobBadgeCount = useMemo(() => jobSummary.queued + jobSummary.running, [jobSummary.queued, jobSummary.running])

  const displayAccount = useMemo(() => {
    if (!me || !me.ok) return null
    return me.data.user.account
  }, [me])

  const adminAccount = (process.env.NEXT_PUBLIC_ADMIN_ACCOUNT ?? "admin").trim()
  const isAdmin = useMemo(() => displayAccount === adminAccount, [adminAccount, displayAccount])

  /**
   * 退出登录并跳转到登录页
   * @returns {Promise<void>} 无返回值
   */
  const onLogout = useCallback(async (): Promise<void> => {
    if (loggingOut) return
    setLoggingOut(true)

    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      setLoggingOut(false)
      router.replace("/login")
      router.refresh()
    }
  }, [loggingOut, router])

  const shouldAutoHide = variant === "app" && autoHide !== false
  const canPortal = typeof document !== "undefined"

  const taskOverlayNode =
    variant === "app" && taskOpen && canPortal
      ? createPortal(
          <div
            className={styles.taskOverlay}
            role="dialog"
            aria-modal="true"
            aria-label="任务中心"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setTaskOpen(false)
            }}
          >
            <div className={styles.taskPanel}>
              <div className={styles.taskHeader}>
                <div className={styles.taskTitle}>任务中心</div>
                <div className={styles.taskHeaderActions}>
                  <button
                    type="button"
                    className={styles.taskIconButton}
                    onClick={() => void refreshJobs()}
                    disabled={!activeStoryId || jobsLoading}
                    aria-label="刷新任务"
                    title="刷新任务"
                  >
                    <RotateCw size={16} strokeWidth={2.2} />
                  </button>
                  <button type="button" className={styles.taskIconButton} onClick={() => setTaskOpen(false)} aria-label="关闭" title="关闭">
                    <X size={16} strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              {!activeStoryId ? (
                <EmptyState
                  size="inline"
                  title="暂时还没有可展示的任务"
                  description="先打开一个故事（项目），生成素材后这里会展示进度与失败原因。"
                  primaryAction={{ label: "去内容库", href: "/library" }}
                  secondaryAction={{ label: "去创作剧本", href: "/script/workspace?mode=brief" }}
                  learnHref="/help?topic=task-center"
                />
              ) : (
                <>
                  <div className={styles.taskMeta}>
                    <Link className={styles.taskMetaLink} href={`/video?tab=list&storyId=${encodeURIComponent(activeStoryId)}`}>
                      打开分镜表
                    </Link>
                    <span className={styles.taskMetaText}>
                      进行中：{jobSummary.running} / 排队：{jobSummary.queued}
                    </span>
                  </div>

                  {jobsError ? <div className={styles.taskError}>{jobsError}</div> : null}

                  <div className={styles.taskList}>
                    {jobs.length === 0 ? (
                      <EmptyState
                        size="inline"
                        title="当前没有进行中的任务"
                        description="你可以在分镜表里发起生成，这里会自动跟踪进度。"
                        primaryAction={{ label: "打开分镜表", href: `/video?tab=list&storyId=${encodeURIComponent(activeStoryId)}` }}
                        learnHref="/help?topic=task-center"
                      />
                    ) : (
                      jobs.map((j) => {
                        const stage = typeof (j.snapshot as any)?.stage === "string" ? String((j.snapshot as any).stage) : ""
                        return (
                          <div key={j.jobId} className={styles.taskItem}>
                            <div className={styles.taskItemTop}>
                              <div className={styles.taskItemType}>{j.type}</div>
                              <div className={`${styles.taskItemStatus} ${j.status === "error" ? styles.taskItemStatusError : ""}`}>{j.status}</div>
                            </div>
                            <div className={styles.taskItemBottom}>
                              <div className={styles.taskItemStage}>{stage || "-"}</div>
                              <div className={styles.taskItemId}>{j.jobId}</div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )
      : null

  const headerNode = (
    <header className={styles.header}>
      <div className={`${styles.inner} ${variant === "auth" ? styles.innerNoNav : ""}`}>
        <Link href="/" className={styles.brand} aria-label="AI 视频创作平台" title="AI 视频创作平台">
          <span className={styles.brandIcon} aria-hidden="true">
            <Video size={20} strokeWidth={2.2} />
          </span>
        </Link>

        {variant === "app" ? (
          <nav className={styles.nav} aria-label="主导航">
            {appNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ""}`}
                aria-label={item.label}
                title={item.label}
              >
                {item.href === "/" ? (
                  <Home size={20} strokeWidth={2.2} />
                ) : item.href.startsWith("/script") ? (
                  <NotebookPen size={20} strokeWidth={2.2} />
                ) : item.href.startsWith("/video") ? (
                  <Video size={20} strokeWidth={2.2} />
                ) : (
                  <Library size={20} strokeWidth={2.2} />
                )}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className={styles.actions}>
          {variant === "app" ? (
            <button
              type="button"
              className={styles.taskButton}
              onClick={() => setTaskOpen(true)}
              aria-label="任务中心"
              title={activeStoryId ? "任务中心" : "任务中心（打开一个故事后可查看）"}
            >
              <ListChecks size={20} strokeWidth={2.2} />
              {jobBadgeCount > 0 ? <span className={styles.taskBadge}>{jobBadgeCount}</span> : null}
            </button>
          ) : null}
          <Link href="/help" className={styles.actionLink} aria-label="帮助中心" title="帮助中心">
            <CircleHelp size={20} strokeWidth={2.2} />
          </Link>
          {variant === "app" ? (
            <>
              {displayAccount ? (
                <>
                  {isAdmin ? (
                    <Link href="/admin" className={styles.actionLink} aria-label="管理员后台" title="管理员后台">
                      <Shield size={20} strokeWidth={2.2} />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.logout}`}
                    onClick={onLogout}
                    disabled={loggingOut}
                    aria-label="退出登录"
                    title={loggingOut ? "退出中…" : "退出登录"}
                  >
                    <LogOut size={20} strokeWidth={2.2} />
                  </button>
                  <span className={styles.account} aria-label="当前账号" title={displayAccount}>
                    <UserRound size={20} strokeWidth={2.2} />
                  </span>
                </>
              ) : (
                <Link href="/login" className={styles.actionLink} aria-label="去登录" title="去登录">
                  <LogIn size={20} strokeWidth={2.2} />
                </Link>
              )}
            </>
          ) : null}
        </div>
      </div>
    </header>
  )

  if (!shouldAutoHide) return (
    <>
      {headerNode}
      {taskOverlayNode}
    </>
  )
  return (
    <>
      <div className={styles.dock}>{headerNode}</div>
      {taskOverlayNode}
    </>
  )
}
