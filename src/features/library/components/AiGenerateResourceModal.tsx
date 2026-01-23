"use client"

import { useMemo, useState, type ReactElement } from "react"
import { X } from "lucide-react"
import styles from "./AiGenerateResourceModal.module.css"

import type { AiResourceType } from "../utils/libraryUtils"

interface AiGenerateResourceModalProps {
  open: boolean
  onClose: () => void
  onGenerate: (input: {
    type: AiResourceType
    prompt: string
    name?: string
    description?: string
    tags?: string
    applicableScenes?: string
  }) => Promise<void>
}

export function AiGenerateResourceModal({ open, onClose, onGenerate }: AiGenerateResourceModalProps): ReactElement | null {
  const [type, setType] = useState<AiResourceType>("background")
  const [prompt, setPrompt] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [scenes, setScenes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !submitting, [prompt, submitting])

  const submit = async () => {
    try {
      setSubmitting(true)
      setError(null)
      await onGenerate({
        type,
        prompt: prompt.trim(),
        name: name.trim() ? name.trim() : undefined,
        description: description.trim() ? description.trim() : undefined,
        tags: tags.trim() ? tags.trim() : undefined,
        applicableScenes: scenes.trim() ? scenes.trim() : undefined
      })
      onClose()
      setPrompt("")
      setName("")
      setDescription("")
      setTags("")
      setScenes("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败")
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
          <div className={styles.title}>AI 生成公共资源</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>类型</label>
              <select className={styles.select} value={type} onChange={(e) => setType(e.target.value as AiResourceType)}>
                <option value="background">背景</option>
                <option value="character">角色</option>
                <option value="scene">场景</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>名称</label>
              <input className={styles.input} placeholder="可选" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>提示词</label>
            <textarea
              className={styles.textarea}
              placeholder="输入用于生成图片的提示词..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>描述</label>
            <input className={styles.input} placeholder="可选" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>标签</label>
              <input
                className={styles.input}
                placeholder="逗号分隔，如：商务,正式"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>适用场景</label>
              <input
                className={styles.input}
                placeholder="逗号分隔，如：广告,宣传片"
                value={scenes}
                onChange={(e) => setScenes(e.target.value)}
              />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="button" className={styles.submitBtn} onClick={submit} disabled={!canSubmit}>
            {submitting ? "生成中..." : "生成"}
          </button>
        </div>
      </div>
    </>
  )
}

