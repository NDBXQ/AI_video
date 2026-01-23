import { type ReactElement } from "react"
import styles from "./VideoParamsSidebar.module.css"
import { clampInt } from "../../utils/previewUtils"

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
  onGenerate: () => void
  isGenerating?: boolean
}

export function VideoParamsSidebar({
  prompt, setPrompt,
  storyboardMode, setStoryboardMode,
  durationSeconds, setDurationSeconds,
  hasVoice, setHasVoice,
  hasExistingVideo,
  onGenerate,
  isGenerating
}: Props): ReactElement {
  return (
    <aside className={styles.left} aria-label="生视频参数区">
      <h2 className={styles.panelTitle}>生成视频</h2>

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

      <button type="button" className={styles.primaryBtn} onClick={onGenerate} disabled={Boolean(isGenerating)}>
        {isGenerating ? "生成中…" : hasExistingVideo ? "重新生成" : "生成视频"}
      </button>
    </aside>
  )
}
