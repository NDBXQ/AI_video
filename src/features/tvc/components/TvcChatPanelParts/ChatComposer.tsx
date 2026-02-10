"use client"

import { useEffect, type ReactElement, type RefObject } from "react"
import styles from "../TvcChatPanel.module.css"

export function ChatComposer({
  input,
  setInput,
  canSend,
  streaming,
  uploadingImages,
  uploadDisabled,
  pendingImages,
  onRemovePendingImage,
  quickActions,
  onAction,
  onSend,
  onAbort,
  onUploadImages,
  textareaRef
}: {
  input: string
  setInput: (v: string) => void
  canSend: boolean
  streaming: boolean
  uploadingImages: boolean
  uploadDisabled: boolean
  pendingImages: Array<{ id: string; previewUrl: string }>
  onRemovePendingImage: (id: string) => void
  quickActions: string[]
  onAction: (command: string) => void
  onSend: () => void
  onAbort: () => void
  onUploadImages: (files: File[]) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}): ReactElement {
  const uploadBlocked = streaming || uploadingImages || uploadDisabled
  const sendDisabled = uploadingImages || (!streaming && !canSend)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    const next = Math.min(el.scrollHeight, 88)
    el.style.height = `${Math.max(next, 44)}px`
  }, [input, textareaRef])

  return (
    <div className={styles.composer}>
      {quickActions.length ? (
        <div className={styles.quickActions} aria-label="快捷操作">
          {quickActions.map((a, idx) => (
            <button key={`${a}_${idx}`} type="button" className={styles.quickActionBtn} onClick={() => onAction(a)} disabled={streaming}>
              {a}
            </button>
          ))}
        </div>
      ) : null}
      {pendingImages.length ? (
        <div className={styles.pendingWrap} aria-label="待发送图片">
          {pendingImages.map((p) => (
            <div key={p.id} className={styles.pendingCard}>
              <img className={styles.pendingImg} src={p.previewUrl} alt="待发送图片" />
              <button type="button" className={styles.pendingRemove} aria-label="移除图片" onClick={() => onRemovePendingImage(p.id)}>
                <svg className={styles.pendingRemoveIcon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className={styles.inputRow}>
        <textarea
          className={styles.textarea}
          placeholder="想改哪里？直接说…（Enter 发送 / Shift+Enter 换行）"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          ref={textareaRef}
          onKeyDown={(e) => {
            if (e.key === "Escape" && streaming) {
              e.preventDefault()
              onAbort()
              return
            }
            if (e.key !== "Enter") return
            if (e.shiftKey) return
            if ((e.nativeEvent as unknown as { isComposing?: boolean })?.isComposing) return
            if (uploadingImages) return
            e.preventDefault()
            onSend()
          }}
        />
        <div className={styles.composerActions} aria-label="发送与上传">
          <label className={styles.uploadBtn} aria-label="上传图片" title={uploadBlocked ? "请先停止生成或等待上传完成" : "上传产品图"} aria-disabled={uploadBlocked}>
            <svg className={styles.uploadIcon} viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3.6c.44 0 .86.18 1.17.49l2.36 2.36c.3.31.49.73.49 1.17v.82h1.1c1.77 0 3.2 1.43 3.2 3.2v5.45c0 1.77-1.43 3.2-3.2 3.2H6.88c-1.77 0-3.2-1.43-3.2-3.2v-5.45c0-1.77 1.43-3.2 3.2-3.2h1.1v-.82c0-.44.18-.86.49-1.17l2.36-2.36c.31-.31.73-.49 1.17-.49Zm-3.1 5.6h6.2V7.98L12 4.88 8.9 7.98V9.2Zm3.1 3.08c-1.7 0-3.08 1.38-3.08 3.08S10.3 18.44 12 18.44s3.08-1.38 3.08-3.08S13.7 12.28 12 12.28Zm0 1.6c.82 0 1.48.66 1.48 1.48S12.82 16.84 12 16.84s-1.48-.66-1.48-1.48.66-1.48 1.48-1.48Z"
                fill="currentColor"
              />
            </svg>
            <input
              className={styles.uploadInput}
              type="file"
              accept="image/*"
              multiple
              disabled={uploadBlocked}
              onChange={(e) => {
                const picked = Array.from(e.currentTarget.files ?? [])
                e.currentTarget.value = ""
                if (picked.length === 0) return
                onUploadImages(picked)
              }}
            />
          </label>
          <button
            type="button"
            className={styles.sendBtn}
            disabled={sendDisabled}
            onClick={() => {
              if (uploadingImages) return
              if (streaming) onAbort()
              else onSend()
            }}
          >
            <span className={styles.sendBtnInner}>
              <svg className={styles.sendIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3.4 11.3l16.6-7.2c.7-.3 1.4.4 1.1 1.1l-7.2 16.6c-.3.7-1.4.6-1.6-.1l-1.6-6.1-6.1-1.6c-.7-.2-.8-1.3-.2-1.6Z"
                  fill="currentColor"
                />
                <path d="M10.6 13.4 20.2 4.8" fill="none" stroke="rgba(2,6,23,0.55)" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {streaming ? "停止" : "发送"}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
