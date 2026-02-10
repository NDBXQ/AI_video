"use client"

import { useState, useMemo, useRef, type ReactElement } from "react"
import { X } from "lucide-react"
import styles from "./UploadResourceModal.module.css"
import { getMediaDurationMsFromFile } from "@/shared/utils/mediaDuration"

export type ResourceType = 'character' | 'background' | 'props' | 'audio' | 'music' | 'effect' | 'transition' | 'video'

export type UploadProgress = {
  loaded: number
  total: number
  percent: number | null
}

interface UploadResourceModalProps {
  open: boolean
  onClose: () => void
  onUpload: (data: FormData, opts?: { onProgress?: (p: UploadProgress) => void; onAbort?: (abort: () => void) => void }) => Promise<void>
}

export function UploadResourceModal({ open, onClose, onUpload }: UploadResourceModalProps): ReactElement | null {
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<ResourceType>('character')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [scenes, setScenes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressPercent, setProgressPercent] = useState<number | null>(null)
  const abortRef = useRef<(() => void) | null>(null)

  const canSubmit = useMemo(() => file != null && !submitting, [file, submitting])
  const accept = useMemo(() => {
    if (type === "audio" || type === "music" || type === "effect") return "audio/*"
    if (type === "video" || type === "transition") return "video/*"
    return "image/*"
  }, [type])

  const handleSubmit = async () => {
    if (!file) return
    
    try {
      setSubmitting(true)
      setError(null)
      setProgressPercent(0)
      abortRef.current = null
      
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      if (name.trim()) fd.append('name', name.trim())
      if (description.trim()) fd.append('description', description.trim())
      if (tags.trim()) fd.append('tags', tags.trim())
      if (scenes.trim()) fd.append('applicableScenes', scenes.trim())

      const mediaKind = type === "audio" || type === "music" || type === "effect" ? "audio" : type === "video" || type === "transition" ? "video" : null
      if (mediaKind) {
        const durationMs = await getMediaDurationMsFromFile(file, mediaKind)
        if (typeof durationMs === "number") fd.append("durationMs", String(durationMs))
      }

      await onUpload(fd, {
        onProgress: (p) => setProgressPercent(p.percent),
        onAbort: (abort) => {
          abortRef.current = abort
        }
      })
      
      // Reset form
      setFile(null)
      setName('')
      setDescription('')
      setTags('')
      setScenes('')
      setProgressPercent(null)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败')
      setProgressPercent(null)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className={styles.overlay} onClick={() => (submitting ? undefined : onClose())} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>上传公共资源</div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => {
              if (submitting) abortRef.current?.()
              else onClose()
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>资源类型</label>
              <select 
                className={styles.select}
                value={type}
                onChange={(e) => setType(e.target.value as ResourceType)}
              >
                <option value="character">角色库</option>
                <option value="background">场景库</option>
                <option value="props">物品库</option>
                <option value="audio">音频库</option>
                <option value="music">音乐库</option>
                <option value="effect">音效库</option>
                <option value="video">视频库</option>
                <option value="transition">转场库</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>文件</label>
              <input 
                type="file" 
                className={styles.fileInput}
                accept={accept}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>名称</label>
              <input 
                type="text" 
                className={styles.input}
                placeholder="可选"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>标签</label>
              <input 
                type="text" 
                className={styles.input}
                placeholder="逗号分隔，如：商务,正式"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>描述</label>
            <input 
              type="text" 
              className={styles.input}
              placeholder="可选"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>适用场景</label>
            <input 
              type="text" 
              className={styles.input}
              placeholder="逗号分隔，如：广告,宣传片"
              value={scenes}
              onChange={(e) => setScenes(e.target.value)}
              disabled={submitting}
            />
          </div>

          {submitting ? (
            <div className={styles.progressBox}>
              <div className={styles.progressHeader}>
                <span>上传中</span>
                <span>{typeof progressPercent === "number" ? `${progressPercent}%` : ""}</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(100, progressPercent ?? 0))}%` }} />
              </div>
            </div>
          ) : null}

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <button 
            type="button" 
            className={styles.cancelBtn} 
            onClick={() => {
              if (submitting) abortRef.current?.()
              else onClose()
            }}
          >
            {submitting ? '取消上传' : '取消'}
          </button>
          <button 
            type="button" 
            className={styles.submitBtn}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? '上传中...' : '上传'}
          </button>
        </div>
      </div>
    </>
  )
}
