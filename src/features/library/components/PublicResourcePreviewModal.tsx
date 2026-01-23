"use client"

import type { ReactElement } from "react"
import Image from "next/image"
import { X, ExternalLink } from "lucide-react"
import styles from "./PublicResourcePreviewModal.module.css"
import type { LibraryItem } from "./LibraryCard"

interface PublicResourcePreviewModalProps {
  open: boolean
  item: LibraryItem | null
  onClose: () => void
}

export function PublicResourcePreviewModal({ open, item, onClose }: PublicResourcePreviewModalProps): ReactElement | null {
  if (!open || !item) return null

  const url = item.originalUrl || item.thumbnail
  const subtitle = item.subtitle ?? ""

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>{item.title}</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.imagePanel}>
            {url ? <Image src={url} alt={item.title} fill sizes="(max-width: 900px) 100vw, 900px" className={styles.image} /> : null}
          </div>
          <div className={styles.side}>
            <div>
              <div className={styles.rowLabel}>名称</div>
              <div className={styles.rowValue}>{item.title}</div>
            </div>
            {subtitle ? (
              <div>
                <div className={styles.rowLabel}>描述</div>
                <div className={styles.rowValue}>{subtitle}</div>
              </div>
            ) : null}
            <div>
              <div className={styles.rowLabel}>ID</div>
              <div className={styles.rowValue}>{item.id}</div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          {url ? (
            <a className={`${styles.btn} ${styles.primaryBtn}`} href={url} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              在新标签打开
            </a>
          ) : null}
          <button type="button" className={styles.btn} onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </>
  )
}
