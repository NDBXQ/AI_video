import type { ReactElement, ReactNode } from "react"
import styles from "./LibraryLayout.module.css"

type LibraryLayoutProps = {
  children: ReactNode
}

export default function LibraryLayout({ children }: LibraryLayoutProps): ReactElement {
  return (
    <div className={styles.page}>
      <main className={styles.content}>
        {children}
      </main>
    </div>
  )
}
