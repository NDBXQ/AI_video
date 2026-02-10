"use client"

import type { ReactElement } from "react"
import styles from "../TvcChatPanel.module.css"
import type { TvcChatAttachment } from "@/shared/tvcChatContent"

export function MessageAttachments({ attachments }: { attachments?: TvcChatAttachment[] }): ReactElement {
  const images = (attachments ?? []).filter((a) => a.kind === "image" && String(a.url ?? "").trim())
  if (images.length === 0) return <></>

  return (
    <div className={styles.attachmentsWrap}>
      {images.map((img, idx) => {
        const url = String(img.url ?? "").trim()
        const index = Number(img.index)
        const showIndex = Number.isFinite(index) && index > 0 ? Math.trunc(index) : null
        return (
          <a key={`${url}_${idx}`} className={styles.attachmentCard} href={url} target="_blank" rel="noreferrer">
            <img className={styles.attachmentImg} src={url} alt={showIndex ? `index=${showIndex}` : "image"} loading="lazy" />
            {showIndex ? <div className={styles.attachmentBadge}>index={showIndex}</div> : null}
          </a>
        )
      })}
    </div>
  )
}

