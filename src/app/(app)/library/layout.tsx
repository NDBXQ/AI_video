import type { ReactElement, ReactNode } from "react"
import styles from "./LibraryLayout.module.css"
import { LibrarySidebar } from "./LibrarySidebar"

type LibraryLayoutProps = {
  children: ReactNode
}

export default function LibraryLayout({ children }: LibraryLayoutProps): ReactElement {
  return (
    <div className={styles.page}>
      <div className={styles.headerCard}>
        <div className={styles.tabs} aria-label="内容库分类">
          <LibrarySidebar />
        </div>
      </div>
      <div className={styles.shell}>
        <main className={styles.content}>
          <div className={styles.contentInner}>{children}</div>
        </main>
      </div>
    </div>
  )
}
