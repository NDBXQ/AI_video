"use client"

import Image from "next/image"
import { useMemo, useRef, useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { MOCK_STORYBOARD_ITEMS } from "@/features/video/mock/storyboardMock"
import styles from "./ImageCreatePage.module.css"

type DialogueRow = {
  id: string
  roleName: string
  duration: string
  content: string
}

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function uniqueStrings(values: string[]): string[] {
  const set = new Set(values.map((v) => v.trim()).filter(Boolean))
  return Array.from(set)
}

function createLocalPreviewSvg(title: string): string {
  const safeTitle = (title || "未命名").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0f1620"/>
          <stop offset="1" stop-color="#0b0f14"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7b61ff"/>
          <stop offset="1" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)"/>
      <circle cx="980" cy="260" r="220" fill="url(#accent)" opacity="0.35"/>
      <circle cx="320" cy="520" r="260" fill="url(#accent)" opacity="0.20"/>
      <text x="80" y="120" fill="#e6edf3" font-size="44" font-family="system-ui, -apple-system, Segoe UI, Roboto">预览</text>
      <text x="80" y="190" fill="#9fb0c0" font-size="26" font-family="system-ui, -apple-system, Segoe UI, Roboto">${safeTitle}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function VideoCreatePage({ sceneNo }: { sceneNo: number }): ReactElement {
  const router = useRouter()
  const sceneNos = useMemo(
    () => Array.from(new Set(MOCK_STORYBOARD_ITEMS.map((it) => it.scene_no))).sort((a, b) => a - b),
    []
  )

  const [activeSceneNo, setActiveSceneNo] = useState<number>(() => (sceneNos.includes(sceneNo) ? sceneNo : sceneNos[0] ?? 1))

  const item = useMemo(() => MOCK_STORYBOARD_ITEMS.find((it) => it.scene_no === activeSceneNo) ?? null, [activeSceneNo])

  const cameraMove = item?.shot_content.shoot.camera_movement ?? ""
  const motionOptions = useMemo(() => {
    const base = [
      "逐渐推进",
      "镜头跟随",
      "逐渐拉远",
      "镜头右移",
      "镜头左移",
      "镜头上升",
      "镜头下降",
      "围绕主题旋转"
    ]
    return uniqueStrings([cameraMove, ...base].filter(Boolean))
  }, [cameraMove])
  const [prompt, setPrompt] = useState<string>(() => {
    const bg = item?.shot_content.background
    const bgText = bg ? `${bg.background_name}${bg.status ? `（${bg.status}）` : ""}` : ""
    const roles = item?.shot_content.roles ?? []
    const speak = roles.find((r) => r.speak?.content)?.speak?.content ?? ""
    const firstRole = roles.find((r) => r.role_name && r.role_name !== "旁白")
    const parts = [
      `镜头：镜 ${activeSceneNo}`,
      bgText ? `背景：${bgText}` : "",
      firstRole ? `角色：${firstRole.role_name}，动作：${firstRole.action}` : "",
      speak ? `台词：“${speak}”` : ""
    ].filter(Boolean)
    return parts.join("\n").slice(0, 500)
  })

  const [motion, setMotion] = useState<string>(() => cameraMove || "镜头跟随")
  const [storyboardMode, setStoryboardMode] = useState<"single" | "headTail">("single")

  const [dialogues, setDialogues] = useState<DialogueRow[]>(() => {
    const roles = item?.shot_content.roles ?? []
    const base = roles
      .filter((r) => r.role_name && r.role_name !== "旁白")
      .map((r, idx) => ({
        id: `${r.role_name}-${idx}`,
        roleName: r.role_name,
        duration: "1",
        content: r.speak?.content ?? ""
      }))
    const uniq = uniqueStrings(base.map((b) => b.roleName))
    return uniq.map((name) => base.find((b) => b.roleName === name) ?? { id: name, roleName: name, duration: "1", content: "" })
  })

  const [videoModel, setVideoModel] = useState<"seedance-1.5-pro" | "seedance-1.0-pro-fast">("seedance-1.5-pro")
  const [resolution, setResolution] = useState<"480p" | "720p" | "1080p">("1080p")
  const [durationSeconds, setDurationSeconds] = useState<string>("4")
  const [hasVoice, setHasVoice] = useState<boolean>(false)

  const [frames, setFrames] = useState<{ id: string; title: string; imageSrc: string }[]>(() =>
    sceneNos.map((no) => ({ id: `scene-${no}`, title: `镜 ${no}`, imageSrc: createLocalPreviewSvg(`镜 ${no}`) }))
  )
  const [activeFrameId, setActiveFrameId] = useState<string>(() => `scene-${activeSceneNo}`)

  const thumbsRef = useRef<HTMLDivElement | null>(null)

  const activeFrame = useMemo(() => frames.find((f) => f.id === activeFrameId) ?? frames[0], [activeFrameId, frames])

  const handleBack = () => {
    router.push("/video?tab=board")
  }

  const handleGoImage = () => {
    router.push(`/video/image?sceneNo=${activeSceneNo}`)
  }

  const handleGoVideo = () => {
    router.push(`/video/video?sceneNo=${activeSceneNo}`)
  }

  const applySceneDefaults = (nextSceneNo: number) => {
    const nextItem = MOCK_STORYBOARD_ITEMS.find((it) => it.scene_no === nextSceneNo) ?? null
    const nextMove = nextItem?.shot_content.shoot.camera_movement ?? ""
    setActiveSceneNo(nextSceneNo)
    setActiveFrameId(`scene-${nextSceneNo}`)
    setMotion(nextMove || "镜头跟随")
    setPrompt(() => {
      const bg = nextItem?.shot_content.background
      const bgText = bg ? `${bg.background_name}${bg.status ? `（${bg.status}）` : ""}` : ""
      const roles = nextItem?.shot_content.roles ?? []
      const speak = roles.find((r) => r.speak?.content)?.speak?.content ?? ""
      const firstRole = roles.find((r) => r.role_name && r.role_name !== "旁白")
      const parts = [
        `镜头：镜 ${nextSceneNo}`,
        bgText ? `背景：${bgText}` : "",
        firstRole ? `角色：${firstRole.role_name}，动作：${firstRole.action}` : "",
        speak ? `台词：“${speak}”` : ""
      ].filter(Boolean)
      return parts.join("\n").slice(0, 500)
    })
    setDialogues(() => {
      const roles = nextItem?.shot_content.roles ?? []
      const base = roles
        .filter((r) => r.role_name && r.role_name !== "旁白")
        .map((r, idx) => ({
          id: `${r.role_name}-${idx}`,
          roleName: r.role_name,
          duration: "1",
          content: r.speak?.content ?? ""
        }))
      const uniq = uniqueStrings(base.map((b) => b.roleName))
      return uniq.map((name) => base.find((b) => b.roleName === name) ?? { id: name, roleName: name, duration: "1", content: "" })
    })
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/video/video?sceneNo=${nextSceneNo}`)
    }
  }

  const handleGenerate = () => {
    setFrames((prev) =>
      prev.map((f) => {
        if (f.id !== `scene-${activeSceneNo}`) return f
        return { ...f, imageSrc: createLocalPreviewSvg(`镜 ${activeSceneNo} / 已生成`) }
      })
    )
  }

  return (
    <div className={styles.shell} aria-label="生视频子界面">
      <header className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={handleBack}>
          返回
        </button>
        <div className={styles.modeTabs} role="tablist" aria-label="生成类型切换">
          <button type="button" className={`${styles.modeTab}`} onClick={handleGoImage}>
            生成图片
          </button>
          <button type="button" className={`${styles.modeTab} ${styles.modeTabActive}`} onClick={handleGoVideo}>
            生成视频
          </button>
        </div>
        <div className={styles.rightInfo}>
          <span>镜号：{activeSceneNo}</span>
          <span>分辨率：{resolution}</span>
          <span>时长：{clampInt(durationSeconds, 4, 12, 4)}s</span>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.left} aria-label="生视频参数区">
          <h2 className={styles.panelTitle}>生成视频</h2>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span>分镜提示词</span>
              <span className={styles.counter}>{prompt.length}/500</span>
            </div>
            <textarea className={styles.textarea} value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 500))} maxLength={500} />
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span>镜头运动</span>
            </div>
            <select className={styles.select} value={motion} onChange={(e) => setMotion(e.target.value)}>
              {motionOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span>视频分镜图</span>
            </div>
            <div className={styles.modeTabs} style={{ justifySelf: "start" }}>
              <button
                type="button"
                className={`${styles.modeTab} ${storyboardMode === "single" ? styles.modeTabActive : ""}`}
                onClick={() => setStoryboardMode("single")}
              >
                首帧生成
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${storyboardMode === "headTail" ? styles.modeTabActive : ""}`}
                onClick={() => setStoryboardMode("headTail")}
              >
                首尾帧生成
              </button>
            </div>
          </div>

          <div className={styles.groupHeader}>
            <span>角色台词</span>
          </div>
          {dialogues.map((row) => (
            <div key={row.id} className={styles.field}>
              <div className={styles.labelRow}>
                <span>{row.roleName}</span>
              </div>
              <div className={styles.row2}>
                <input
                  className={styles.input}
                  value={row.duration}
                  onChange={(e) =>
                    setDialogues((prev) => prev.map((p) => (p.id === row.id ? { ...p, duration: e.target.value } : p)))
                  }
                />
                <textarea
                  className={styles.textarea}
                  style={{ minHeight: 72 }}
                  value={row.content}
                  placeholder="填写角色台词"
                  onChange={(e) =>
                    setDialogues((prev) => prev.map((p) => (p.id === row.id ? { ...p, content: e.target.value } : p)))
                  }
                />
              </div>
            </div>
          ))}

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span>视频模型</span>
            </div>
            <div className={styles.modeTabs} style={{ justifySelf: "start" }}>
              {(["seedance-1.5-pro", "seedance-1.0-pro-fast"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`${styles.modeTab} ${videoModel === m ? styles.modeTabActive : ""}`}
                  onClick={() => setVideoModel(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span>分辨率</span>
            </div>
            <div className={styles.modeTabs} style={{ justifySelf: "start" }}>
              {(["480p", "720p", "1080p"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`${styles.modeTab} ${resolution === r ? styles.modeTabActive : ""}`}
                  onClick={() => setResolution(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
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

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span>视频台词声音</span>
            </div>
            <div className={styles.modeTabs} style={{ justifySelf: "start" }}>
              <button
                type="button"
                className={`${styles.modeTab} ${hasVoice ? "" : styles.modeTabActive}`}
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

          <button type="button" className={styles.primaryBtn} onClick={handleGenerate}>
            生成视频
          </button>
        </aside>

        <main className={styles.main} aria-label="视频预览区">
          <div className={styles.preview}>
            <div className={styles.previewInner}>
              {activeFrame?.imageSrc ? (
                <Image src={activeFrame.imageSrc} alt={activeFrame.title} fill unoptimized sizes="(max-width: 1023px) 100vw, 980px" />
              ) : (
                <div className={styles.previewPlaceholder}>暂无预览</div>
              )}
            </div>
          </div>

          <div className={styles.filmstrip} aria-label="预览帧列表">
            <button
              type="button"
              className={styles.navBtn}
              aria-label="上一帧"
              onClick={() => thumbsRef.current?.scrollBy({ left: -132, behavior: "smooth" })}
            >
              ‹
            </button>
            <div className={styles.thumbs} ref={thumbsRef}>
              {frames.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`${styles.thumb} ${f.id === activeFrameId ? styles.thumbActive : ""}`}
                  onClick={() => {
                    const next = Number.parseInt(f.id.replace("scene-", ""), 10)
                    if (Number.isFinite(next) && next > 0) applySceneDefaults(next)
                  }}
                >
                  {f.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="下一帧"
              onClick={() => thumbsRef.current?.scrollBy({ left: 132, behavior: "smooth" })}
            >
              ›
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
