import type { ReactElement } from "react"
import styles from "./ScopeTabs.module.css"

export type Scope = "my" | "public"

interface ScopeTabsProps {
  value: Scope
  onChange: (scope: Scope) => void
}

export function ScopeTabs({ value, onChange }: ScopeTabsProps): ReactElement {
  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${styles.tab} ${value === "my" ? styles.active : ""}`}
        onClick={() => onChange("my")}
      >
        我的内容
      </button>
      <button
        type="button"
        className={`${styles.tab} ${value === "public" ? styles.active : ""}`}
        onClick={() => onChange("public")}
      >
        公共资源
      </button>
    </div>
  )
}
