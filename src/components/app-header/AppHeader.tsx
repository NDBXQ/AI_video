"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactElement } from "react"
import styles from "./AppHeader.module.css"

type NavItem = {
  href: string
  label: string
}

type MeResult =
  | { ok: true; data: { user: { id: string; account: string } }; traceId: string }
  | { ok: false; error: { code: string; message: string }; traceId: string }

const navItems: NavItem[] = [
  { href: "/", label: "首页" },
  { href: "/script", label: "脚本创作" },
  { href: "/video", label: "视频创作" },
  { href: "/library", label: "内容库" }
]

/**
 * 应用顶部导航栏
 * @returns {ReactElement} Header 组件
 */
export function AppHeader(): ReactElement {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const [me, setMe] = useState<MeResult | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  const isActive = (href: string): boolean => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  useEffect(() => {
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
  }, [])

  const displayAccount = useMemo(() => {
    if (!me || !me.ok) return null
    return me.data.user.account
  }, [me])

  const avatarText = useMemo(() => {
    if (!displayAccount) return "U"
    return displayAccount.trim().slice(0, 1).toUpperCase()
  }, [displayAccount])

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

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="AI 视频创作平台">
          <span className={styles.brandIcon} aria-hidden="true" />
          <span className={styles.brandText}>
            <span className={styles.brandTitle}>AI视频创作平台</span>
            <span className={styles.brandSubtitle}>AI VIDEO CREATOR</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="主导航">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/help" className={styles.actionLink}>
            帮助中心
          </Link>
          {displayAccount ? (
            <>
              <span className={styles.account} aria-label="当前账号">
                {displayAccount}
              </span>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.logout}`}
                onClick={onLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "退出中..." : "退出登录"}
              </button>
            </>
          ) : (
            <Link href="/login" className={styles.actionLink}>
              去登录
            </Link>
          )}
          <span className={styles.avatar} aria-label="用户头像">
            {avatarText}
          </span>
        </div>
      </div>
    </header>
  )
}
