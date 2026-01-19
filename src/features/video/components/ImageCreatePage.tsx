"use client"

import Image from "next/image"
import { useMemo, useRef, useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { MOCK_STORYBOARD_ITEMS } from "@/features/video/mock/storyboardMock"
import { ChipEditModal } from "@/features/video/components/ChipEditModal"
import styles from "./ImageCreatePage.module.css"

type GeneratedImage = {
  id: string
  title: string
  imageSrc: string
}

type AddModalState = {
  open: boolean
  kind: "role" | "item" | "background"
}

function buildDefaultPrompt(sceneNo: number): string {
  const item = MOCK_STORYBOARD_ITEMS.find((it) => it.scene_no === sceneNo)
  if (!item) return ""
  const firstRole = item.shot_content.roles[0]
  const speak = item.shot_content.roles.find((r) => r.speak?.content)?.speak?.content
  const parts = [
    `镜头：镜 ${item.scene_no}`,
    `场景：${item.shot_content.background.background_name}（${item.shot_content.background.status}）`,
    firstRole ? `角色：${firstRole.role_name}，动作：${firstRole.action}` : "",
    speak ? `台词：“${speak}”` : "",
    item.note ? `风格：${item.note}` : ""
  ].filter(Boolean)
  return parts.join("\n")
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

function uniqueStrings(values: string[]): string[] {
  const set = new Set(values.map((v) => v.trim()).filter(Boolean))
  return Array.from(set)
}

/**
 * 生图子界面（UI 骨架）
 * - 从 /video/image?sceneNo=1 透传 sceneNo
 * - 先提供一致风格的工作台布局；后续可接入 /api/coze/reference-image
 * @returns {ReactElement} 页面内容
 */
export function ImageCreatePage({ sceneNo }: { sceneNo: number }): ReactElement {
  const router = useRouter()

  const sceneNos = useMemo(
    () => Array.from(new Set(MOCK_STORYBOARD_ITEMS.map((it) => it.scene_no))).sort((a, b) => a - b),
    []
  )

  const [activeSceneNo, setActiveSceneNo] = useState<number>(() => (sceneNos.includes(sceneNo) ? sceneNo : sceneNos[0] ?? 1))

  const item = useMemo(() => MOCK_STORYBOARD_ITEMS.find((it) => it.scene_no === activeSceneNo) ?? null, [activeSceneNo])

  const cameraAngleOptions = useMemo(() => {
    const values = MOCK_STORYBOARD_ITEMS.flatMap((it) => [it.shot_content.shoot.camera_movement, it.shot_content.shoot.shot_angle])
    return uniqueStrings(values)
  }, [])

  const [prompt, setPrompt] = useState<string>(() => buildDefaultPrompt(activeSceneNo).slice(0, 500))
  const [stylePreset, setStylePreset] = useState<string>("写实风格")
  const [count, setCount] = useState<string>("4")

  const [cameraAngle, setCameraAngle] = useState<string>(() => item?.shot_content.shoot.camera_movement ?? "")
  const [sceneText, setSceneText] = useState<string>(() => {
    const bg = item?.shot_content.background
    if (!bg) return ""
    return bg.status ? `${bg.background_name}，${bg.status}` : bg.background_name
  })
  const [roles, setRoles] = useState<string[]>(() => {
    const base = item?.shot_content.roles ?? []
    return uniqueStrings(base.filter((r) => r.role_name && r.role_name !== "旁白").map((r) => r.role_name))
  })
  const [items, setItems] = useState<string[]>(() =>
    uniqueStrings([...(item?.shot_content.role_items ?? []), ...(item?.shot_content.other_items ?? [])])
  )
  const [imageModel, setImageModel] = useState<"seedream-4.5" | "seedream-4.0">("seedream-4.5")
  const [styleType, setStyleType] = useState<"动漫" | "写实" | "电影">(() => {
    const text = `${item?.note ?? ""} ${buildDefaultPrompt(activeSceneNo)}`
    return /anime|动漫/i.test(text) ? "动漫" : "写实"
  })

  const [addModal, setAddModal] = useState<AddModalState>({ open: false, kind: "role" })

  const [images, setImages] = useState<GeneratedImage[]>(() =>
    sceneNos.map((no) => ({ id: `scene-${no}`, title: `镜 ${no}`, imageSrc: createLocalPreviewSvg(`镜 ${no}`) }))
  )
  const [activeImageId, setActiveImageId] = useState<string>(() => `scene-${activeSceneNo}`)

  const thumbsRef = useRef<HTMLDivElement | null>(null)

  const activeImage = useMemo(() => images.find((it) => it.id === activeImageId) ?? images[0], [activeImageId, images])

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
    setActiveSceneNo(nextSceneNo)
    setActiveImageId(`scene-${nextSceneNo}`)
    setPrompt(buildDefaultPrompt(nextSceneNo).slice(0, 500))
    setCameraAngle(nextItem?.shot_content.shoot.camera_movement ?? "")
    setSceneText(() => {
      const bg = nextItem?.shot_content.background
      if (!bg) return ""
      return bg.status ? `${bg.background_name}，${bg.status}` : bg.background_name
    })
    setRoles(() => {
      const base = nextItem?.shot_content.roles ?? []
      return uniqueStrings(base.filter((r) => r.role_name && r.role_name !== "旁白").map((r) => r.role_name))
    })
    setItems(() => uniqueStrings([...(nextItem?.shot_content.role_items ?? []), ...(nextItem?.shot_content.other_items ?? [])]))
    setStyleType(() => {
      const text = `${nextItem?.note ?? ""} ${buildDefaultPrompt(nextSceneNo)}`
      return /anime|动漫/i.test(text) ? "动漫" : "写实"
    })
    setStylePreset(() => (/anime|动漫/i.test(`${nextItem?.note ?? ""}`) ? "动漫插画" : "写实风格"))
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/video/image?sceneNo=${nextSceneNo}`)
    }
  }

  const handleGenerate = () => {
    const nextCount = Number.parseInt(count, 10)
    const total = Number.isFinite(nextCount) && nextCount > 0 ? Math.min(nextCount, 12) : 4
    setImages((prev) =>
      prev.map((img) => {
        if (img.id !== `scene-${activeSceneNo}`) return img
        return { ...img, imageSrc: createLocalPreviewSvg(`镜 ${activeSceneNo} / 生成 ${total}`) }
      })
    )
  }

  return (
    <div className={styles.shell} aria-label="生图子界面">
      <header className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={handleBack}>
          返回
        </button>
        <div className={styles.modeTabs} role="tablist" aria-label="生成类型切换">
          <button type="button" className={`${styles.modeTab} ${styles.modeTabActive}`} onClick={handleGoImage}>
            生成图片
          </button>
          <button type="button" className={styles.modeTab} onClick={handleGoVideo}>
            生成视频
          </button>
        </div>
        <div className={styles.rightInfo}>
          <span>镜号：{activeSceneNo}</span>
          <span>风格：{stylePreset}</span>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.left} aria-label="生图参数区">
          <h2 className={styles.panelTitle}>生成图片</h2>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span>分镜提示词</span>
              <span className={styles.counter}>{prompt.length}/500</span>
            </div>
            <textarea
              className={styles.textarea}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
              maxLength={500}
            />
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span>风格预设</span>
              </div>
              <select className={styles.select} value={stylePreset} onChange={(e) => setStylePreset(e.target.value)}>
                <option value="写实风格">写实风格</option>
                <option value="动漫插画">动漫插画</option>
                <option value="电影质感">电影质感</option>
              </select>
            </div>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span>生成数量</span>
              </div>
              <input className={styles.input} value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span>摄像机角度</span>
              </div>
              <select className={styles.select} value={cameraAngle} onChange={(e) => setCameraAngle(e.target.value)}>
                <option value="">选择摄像机角度</option>
                {cameraAngleOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.groupHeader}>
            <span>背景</span>
            <button type="button" className={styles.addLink} onClick={() => setAddModal({ open: true, kind: "background" })}>
              ＋ 选择背景
            </button>
          </div>
          <div className={styles.chipList}>
            {!sceneText ? <span className={`${styles.chip} ${styles.chipMuted}`}>未选择</span> : null}
            {sceneText ? (
              <span className={styles.chip}>
                {sceneText}
                <button type="button" className={styles.chipRemove} aria-label="移除背景" onClick={() => setSceneText("")}>
                  ×
                </button>
              </span>
            ) : null}
          </div>

          <div className={styles.groupHeader}>
            <span>出场角色</span>
            <button type="button" className={styles.addLink} onClick={() => setAddModal({ open: true, kind: "role" })}>
              ＋ 选择角色
            </button>
          </div>
          <div className={styles.chipList}>
            {roles.length === 0 ? <span className={`${styles.chip} ${styles.chipMuted}`}>未选择</span> : null}
            {roles.map((name) => (
              <span key={`role-${name}`} className={styles.chip}>
                {name}
                <button type="button" className={styles.chipRemove} aria-label="移除角色" onClick={() => setRoles((p) => p.filter((v) => v !== name))}>
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className={styles.groupHeader}>
            <span>物品</span>
            <button type="button" className={styles.addLink} onClick={() => setAddModal({ open: true, kind: "item" })}>
              ＋ 选择物品
            </button>
          </div>
          <div className={styles.chipList}>
            {items.length === 0 ? <span className={`${styles.chip} ${styles.chipMuted}`}>未选择</span> : null}
            {items.map((name) => (
              <span key={`item-${name}`} className={styles.chip}>
                {name}
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label="移除物品"
                  onClick={() => setItems((p) => p.filter((v) => v !== name))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className={styles.field} style={{ marginTop: 12 }}>
            <div className={styles.labelRow}>
              <span>图片模型</span>
            </div>
            <div className={styles.modeTabs} style={{ justifySelf: "start" }}>
              {(["seedream-4.5", "seedream-4.0"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`${styles.modeTab} ${imageModel === m ? styles.modeTabActive : ""}`}
                  onClick={() => setImageModel(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span>风格类型</span>
            </div>
            <div className={styles.modeTabs} style={{ justifySelf: "start" }}>
              {(["动漫", "写实", "电影"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.modeTab} ${styleType === t ? styles.modeTabActive : ""}`}
                  onClick={() => setStyleType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className={styles.primaryBtn} onClick={handleGenerate}>
            生成图片
          </button>
          <div className={styles.hint}>当前为 UI 子界面与流程打通版本；后续可接入真实生图接口并回写到镜头预览。</div>
        </aside>

        <main className={styles.main} aria-label="预览区">
          <div className={styles.preview}>
            <div className={styles.previewInner}>
              {activeImage?.imageSrc ? (
                <Image
                  src={activeImage.imageSrc}
                  alt={activeImage.title}
                  fill
                  unoptimized
                  sizes="(max-width: 1023px) 100vw, 980px"
                />
              ) : (
                <div className={styles.previewPlaceholder}>暂无预览</div>
              )}
            </div>
          </div>

          <div className={styles.filmstrip} aria-label="缩略图列表">
            <button
              type="button"
              className={styles.navBtn}
              aria-label="上一张"
              onClick={() => thumbsRef.current?.scrollBy({ left: -132, behavior: "smooth" })}
            >
              ‹
            </button>
            <div className={styles.thumbs} ref={thumbsRef}>
              {images.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`${styles.thumb} ${it.id === activeImageId ? styles.thumbActive : ""}`}
                  onClick={() => {
                    const next = Number.parseInt(it.id.replace("scene-", ""), 10)
                    if (Number.isFinite(next) && next > 0) applySceneDefaults(next)
                  }}
                >
                  {it.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="下一张"
              onClick={() => thumbsRef.current?.scrollBy({ left: 132, behavior: "smooth" })}
            >
              ›
            </button>
          </div>
        </main>
      </div>

      <ChipEditModal
        open={addModal.open}
        title={addModal.kind === "role" ? "选择角色" : addModal.kind === "item" ? "选择物品" : "选择背景"}
        placeholder={addModal.kind === "role" ? "请输入角色名" : addModal.kind === "item" ? "请输入物品" : "请输入背景"}
        onClose={() => setAddModal((p) => ({ ...p, open: false }))}
        onSubmit={(value) => {
          const trimmed = value.trim()
          if (!trimmed) return
          if (addModal.kind === "role") setRoles((p) => uniqueStrings([...p, trimmed]))
          if (addModal.kind === "item") setItems((p) => uniqueStrings([...p, trimmed]))
          if (addModal.kind === "background") setSceneText(trimmed)
          setAddModal((p) => ({ ...p, open: false }))
        }}
      />
    </div>
  )
}
