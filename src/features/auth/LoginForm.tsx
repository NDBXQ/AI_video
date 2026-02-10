"use client"

import { useCallback, useState } from "react"
import type { FormEvent, ReactElement } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import styles from "./LoginForm.module.css"
import { apiFetchJson } from "@/shared/apiClient"
import { useRequestState } from "@/shared/useRequestState"

type LoginResult =
  | { ok: true; data: { user: { id: string; account: string }; created: boolean }; traceId: string }
  | { ok: false; error: { code: string; message: string }; traceId: string }

type LoginFormVariant = "card" | "plain"

type LoginFormProps = {
  variant?: LoginFormVariant
  buttonLabel?: string
}

/**
 * 登录表单组件
 * @returns {ReactElement} 登录表单
 */
export function LoginForm({ variant = "card", buttonLabel }: LoginFormProps): ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [result, setResult] = useState<LoginResult | null>(null)
  const { state: submitState, run: runSubmit } = useRequestState<{ user: { id: string; account: string }; created: boolean }>()

  /**
   * 提交登录请求
   * @param {FormEvent<HTMLFormElement>} e - 表单事件
   * @returns {Promise<void>} 无返回值
   */
  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (submitState.status === "pending") return

      const form = e.currentTarget
      const fd = new FormData(form)
      const account = String(fd.get("account") ?? "").trim()
      const password = String(fd.get("password") ?? "")

      if (!account || !password) return

      setResult(null)

      const out = await runSubmit((signal) =>
        apiFetchJson<{ user: { id: string; account: string }; created: boolean }>("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ account, password }),
          signal
        })
      )
      if (!out) return
      setResult(out as LoginResult)
      if (out.ok) {
        const next = searchParams?.get("next") ?? "/"
        const safeNext = next.startsWith("/") ? next : "/"
        router.replace(safeNext)
      }
    },
    [router, runSubmit, searchParams, submitState.status]
  )

  const containerClassName = variant === "card" ? styles.card : styles.plain

  return (
    <section className={containerClassName}>
      {variant === "card" ? <h1 className={styles.title}>登录</h1> : null}
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="account">
            用户名
          </label>
          <input
            id="account"
            name="account"
            className={styles.input}
            autoComplete="username"
            placeholder="请输入用户名（test）"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            密码
          </label>
          <input
            id="password"
            name="password"
            className={styles.input}
            type="password"
            autoComplete="current-password"
            placeholder="请输入密码（test）"
            required
          />
        </div>

        <button className={styles.button} type="submit" disabled={submitState.status === "pending"}>
          {submitState.status === "pending" ? "提交中..." : (buttonLabel ?? "登录 / 注册")}
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
