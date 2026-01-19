"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactElement } from "react"
import { libraryNavItems } from "@/shared/navigation"
import styles from "./LibraryLayout.module.css"

export function LibrarySidebar(): ReactElement {
  const pathname = usePathname() ?? "/"

  return (
    <>
      {libraryNavItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.tab} ${active ? styles.activeTab : ""}`}
          >
            {item.label}
          </Link>
        )
      })}
    </>
  )
}
