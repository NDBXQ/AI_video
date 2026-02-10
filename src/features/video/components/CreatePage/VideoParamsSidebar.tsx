import { type ReactElement } from "react"
import styles from "./VideoParamsSidebar.module.css"
import { clampInt } from "@/shared/utils/previewUtils"
import { TtsDialoguePanel } from "@/features/tts/components/TtsDialoguePanel"
import type { RequestStatus } from "@/shared/requestStatus"

type DialogueRow = {
  id: string
  roleName: string
  duration: string
  content: string
}

type Props = {
  prompt: string
  setPrompt: (v: string) => void
  storyboardMode: "首帧" | "首尾帧"
  setStoryboardMode: (v: "首帧" | "首尾帧") => void
  durationSeconds: string
  setDurationSeconds: (v: string) => void
  hasVoice: boolean
  setHasVoice: (v: boolean) => void
  hasExistingVideo?: boolean
  variant?: "sidebar" | "drawer"
  onGenerate: () => void
  isGenerating?: boolean
  requestStatus?: RequestStatus
  requestError?: string | null
  requestTraceId?: string | null
  storyboardId?: string | null
  dialogues?: Array<{ id: string; roleName: string; content: string }>
  onAudioGenerated?: () => void
}

export function VideoParamsSidebar({
  prompt, setPrompt,
  storyboardMode, setStoryboardMode,
  durationSeconds, setDurationSeconds,
  hasVoice, setHasVoice,
  hasExistingVideo,
  variant = "sidebar",
  onGenerate,
  isGenerating,
  requestStatus = "idle",
  requestError,
  requestTraceId,
  storyboardId,
  dialogues,
  onAudioGenerated
}: Props): ReactElement {
  return (
    <aside className={variant === "drawer" ? styles.drawer : styles.left} aria-label="生视频参数区">
      <div className={styles.scrollArea}>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <span>分镜提示词</span>
            <span className={styles.counter}>{prompt.length}/1000</span>
          </div>
          <textarea className={styles.textarea} value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 1000))} maxLength={1000} />
        </div>

        <div className={styles.videoControlGrid}>
          <div className={`${styles.field} ${styles.videoControlMode}`}>
            <div className={styles.labelRow}>
              <span>视频分镜图</span>
            </div>
            <div className={styles.modeTabs} style={{ justifySelf: "start" }}>
              <button
                type="button"
                className={`${styles.modeTab} ${storyboardMode === "首帧" ? styles.modeTabActive : ""}`}
                onClick={() => setStoryboardMode("首帧")}
              >
                首帧
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${storyboardMode === "首尾帧" ? styles.modeTabActive : ""}`}
                onClick={() => setStoryboardMode("首尾帧")}
              >
                首尾帧
              </button>
            </div>
          </div>

          <div className={`${styles.field} ${styles.videoControlDur}`}>
            <div className={styles.labelRow}>
              <span>视频时长</span>
            </div>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={4}
              max={12}
              step={1}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(e.target.value)}
              onBlur={() => setDurationSeconds(String(clampInt(durationSeconds, 4, 12, 4)))}
            />
          </div>

          <div className={`${styles.field} ${styles.videoControlVoice}`}>
            <div className={styles.labelRow}>
              <span>视频台词声音</span>
            </div>
            <div className={styles.modeTabs} style={{ justifySelf: "start" }}>
              <button
                type="button"
                className={`${styles.modeTab} ${!hasVoice ? styles.modeTabActive : ""}`}
                onClick={() => setHasVoice(false)}
              >
                无声
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${hasVoice ? styles.modeTabActive : ""}`}
                onClick={() => setHasVoice(true)}
              >
                有声
              </button>
            </div>
          </div>
        </div>

        {storyboardId ? <TtsDialoguePanel storyboardId={storyboardId} dialogues={dialogues ?? []} onAudioGenerated={onAudioGenerated} /> : null}
      </div>

      <div className={styles.footer} aria-label="生成操作区">
        <button type="button" className={styles.primaryBtn} onClick={onGenerate} disabled={Boolean(isGenerating)}>
          {isGenerating ? "生成中…" : hasExistingVideo ? "重新生成" : "生成视频"}
        </button>

        {requestStatus === "success" ? <div className={`${styles.requestHint} ${styles.requestHintSuccess}`}>已完成{requestTraceId ? `（${requestTraceId}）` : ""}</div> : null}
        {requestStatus === "error" ? (
          <div className={`${styles.requestHint} ${styles.requestHintError}`}>
            失败：{requestError ?? "请求失败"}
            {requestTraceId ? `（${requestTraceId}）` : ""}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
