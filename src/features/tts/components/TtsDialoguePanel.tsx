"use client"

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react"
import styles from "./TtsDialoguePanel.module.css"
import { ListboxSelect } from "@/shared/ui/ListboxSelect"

type Speaker = { id: string; name: string; sampleUrl: string | null; sampleText: string }
type Dialogue = { id: string; roleName: string; content: string }

export function TtsDialoguePanel({
  storyboardId,
  dialogues,
  onAudioGenerated
}: {
  storyboardId: string
  dialogues: Dialogue[]
  onAudioGenerated?: () => void
}): ReactElement {
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [speakerByDialogueId, setSpeakerByDialogueId] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{ name: string; src: string } | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/tts/speakers", { cache: "no-store" })
        const json = (await res.json().catch(() => null)) as { ok: boolean; data?: { speakers?: Speaker[] } } | null
        const list = Array.isArray(json?.data?.speakers) ? (json?.data?.speakers ?? []) : []
        if (!cancelled) setSpeakers(list)
      } catch {
        if (!cancelled) setSpeakers([])
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const defaultSpeakerId = speakers[0]?.id ?? ""
  useEffect(() => {
    if (!defaultSpeakerId) return
    setSpeakerByDialogueId((prev) => {
      const next = { ...prev }
      for (const d of dialogues) {
        if (!next[d.id]) next[d.id] = defaultSpeakerId
      }
      return next
    })
  }, [defaultSpeakerId, dialogues])

  const speakerOptions = useMemo(() => speakers, [speakers])

  const generateFor = useCallback(
    async (d: Dialogue) => {
      const speakerId = (speakerByDialogueId[d.id] ?? defaultSpeakerId).trim()
      if (!speakerId) return
      setLoadingId(d.id)
      try {
        const res = await fetch("/api/video-creation/audios/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyboardId, roleName: d.roleName, text: d.content, speakerId })
        })
        const json = (await res.json().catch(() => null)) as { ok: boolean; data?: { audioUrl?: string }; error?: { message?: string } } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        const url = (json.data?.audioUrl ?? "").trim()
        if (url) setPreview({ name: `${d.roleName} - ${speakerId}`, src: url })
        onAudioGenerated?.()
      } catch (err) {
        const msg = (err as any)?.message ? String((err as any).message) : "生成音频失败"
        alert(msg)
      } finally {
        setLoadingId(null)
      }
    },
    [defaultSpeakerId, onAudioGenerated, speakerByDialogueId, storyboardId]
  )

  return (
    <div className={styles.wrap} aria-label="台词配音">
      <div className={styles.header}>
        <div className={styles.title}>台词配音</div>
        <div className={styles.hint}>选择音色试听样音，生成台词音频</div>
      </div>

      {dialogues.length > 0 ? (
        <div className={styles.list}>
          {dialogues.map((d) => {
            const selected = speakerByDialogueId[d.id] ?? defaultSpeakerId
            const speaker = speakerOptions.find((s) => s.id === selected) ?? null
            const canSample = Boolean(speaker?.sampleUrl)
            const isLoading = loadingId === d.id
            return (
              <div key={d.id} className={styles.row}>
                <div className={styles.rowTop}>
                  <div className={styles.role} title={d.roleName}>
                    {d.roleName}
                  </div>
                  <ListboxSelect
                    className={styles.select}
                    value={selected}
                    ariaLabel="选择音色"
                    options={speakerOptions.map((s) => ({ value: s.id, label: s.name }))}
                    onChange={(next) => setSpeakerByDialogueId((prev) => ({ ...prev, [d.id]: next }))}
                    disabled={speakerOptions.length === 0}
                  />
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => {
                      if (!speaker?.sampleUrl) return
                      setPreview({ name: `${speaker.name}（样音）`, src: speaker.sampleUrl })
                    }}
                    disabled={!canSample}
                  >
                    试听
                  </button>
                  <button type="button" className={styles.btnPrimary} onClick={() => void generateFor(d)} disabled={isLoading}>
                    {isLoading ? "生成中…" : "生成"}
                  </button>
                </div>
                <div className={styles.content} title={d.content}>
                  {d.content}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.empty}>该分镜暂无可配音的台词</div>
      )}

      {preview ? (
        <div className={styles.preview} aria-label="试听">
          <div className={styles.previewHeader}>
            <div className={styles.previewTitle} title={preview.name}>
              {preview.name}
            </div>
            <button type="button" className={styles.previewClose} onClick={() => setPreview(null)} aria-label="关闭试听">
              ×
            </button>
          </div>
          <audio key={preview.src} className={styles.previewAudio} src={preview.src} controls autoPlay />
        </div>
      ) : null}
    </div>
  )
}
