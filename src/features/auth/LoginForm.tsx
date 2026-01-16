"use client"

import { useCallback, useMemo, useState } from "react"
import type { FormEvent, ReactElement } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import styles from "./LoginForm.module.css"

type LoginResult =
  | { ok: true; data: { user: { id: string; account: string }; created: boolean }; traceId: string }
  | { ok: false; error: { code: string; message: string }; traceId: string }

/**
 * 登录表单组件
 * @returns {ReactElement} 登录表单
 */
export function LoginForm(): ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [account, setAccount] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<LoginResult | null>(null)

  const canSubmit = useMemo(() => {
    return account.trim().length > 0 && password.length > 0 && !submitting
  }, [account, password, submitting])

  /**
   * 提交登录请求
   * @param {FormEvent<HTMLFormElement>} e - 表单事件
   * @returns {Promise<void>} 无返回值
   */
  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!canSubmit) return

      setSubmitting(true)
      setResult(null)

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ account, password })
        })

        const json = (await res.json()) as LoginResult
        setResult(json)
        if (json.ok) {
          const next = searchParams?.get("next") ?? "/"
          const safeNext = next.startsWith("/") ? next : "/"
          router.replace(safeNext)
        }
      } catch {
        setResult({
          ok: false,
          error: { code: "NETWORK_ERROR", message: "网络错误，请稍后重试" },
          traceId: "n/a"
        })
      } finally {
        setSubmitting(false)
      }
    },
    [account, password, canSubmit, router, searchParams]
  )

  return (
    <section className={styles.card}>
      <h1 className={styles.title}>登录</h1>
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="account">
            账号
          </label>
          <input
            id="account"
            className={styles.input}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            autoComplete="username"
            placeholder="请输入账号"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            密码
          </label>
          <input
            id="password"
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="请输入密码"
          />
        </div>

        <button className={styles.button} type="submit" disabled={!canSubmit}>
          {submitting ? "提交中..." : "登录 / 注册"}
        </button>
      </form>

      {result ? (
        result.ok ? (
          <p className={`${styles.message} ${styles.success}`}>
            {result.data.created ? "已自动注册并登录" : "登录成功"}，账号：
            {result.data.user.account}
          </p>
        ) : (
          <p className={`${styles.message} ${styles.error}`}>
            {result.error.message}（{result.error.code}，traceId: {result.traceId}）
          </p>
        )
      ) : null}
    </section>
  )
}
