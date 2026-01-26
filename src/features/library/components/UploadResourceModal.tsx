"use client"

import { useState, useMemo, type ReactElement } from "react"
import { X } from "lucide-react"
import styles from "./UploadResourceModal.module.css"

export type ResourceType = 'character' | 'background' | 'props' | 'audio' | 'music' | 'effect' | 'transition' | 'video'

interface UploadResourceModalProps {
  open: boolean
  onClose: () => void
  onUpload: (data: FormData) => Promise<void>
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
      
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      if (name.trim()) fd.append('name', name.trim())
      if (description.trim()) fd.append('description', description.trim())
      if (tags.trim()) fd.append('tags', tags.trim())
      if (scenes.trim()) fd.append('applicableScenes', scenes.trim())

      await onUpload(fd)
      
      // Reset form
      setFile(null)
      setName('')
      setDescription('')
      setTags('')
      setScenes('')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>上传公共资源</div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
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
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <button 
            type="button" 
            className={styles.cancelBtn} 
            onClick={onClose}
            disabled={submitting}
          >
            取消
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
