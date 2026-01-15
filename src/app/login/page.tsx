import { LoginForm } from "@/features/auth/LoginForm"
import styles from "./page.module.css"
import type { ReactElement } from "react"

/**
 * 登录页
 * @returns {ReactElement} 页面内容
 */
export default function LoginPage(): ReactElement {
  return (
    <main className={styles.main}>
      <LoginForm />
    </main>
  )
}
