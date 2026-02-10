"use client"

import type { ReactElement } from "react"
import { useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import styles from "./StoryContentModal.module.css"
import type { GeneratedAudio, GeneratedImage, Outline, Shot } from "./storyContentTypes"
import { StoryContentExpandableText } from "./StoryContentExpandableText"

export function StoryContentAssetsTab({
  outlines,
  shotsByOutlineId,
  images,
  audiosByStoryboardId
}: {
  outlines: Outline[]
  shotsByOutlineId: Record<string, Shot[]>
  images: GeneratedImage[]
  audiosByStoryboardId: Record<string, GeneratedAudio[]>
}): ReactElement {
  const [globalTab, setGlobalTab] = useState<"auto" | "role" | "item" | "background">("auto")
  const [episodeId, setEpisodeId] = useState<string>("")
  const [globalExpanded, setGlobalExpanded] = useState(false)
  const [expandedRefsByShotId, setExpandedRefsByShotId] = useState<Record<string, boolean>>({})

  const imagesByStoryboardId = useMemo(() => {
    const map = new Map<string, { role: GeneratedImage[]; item: GeneratedImage[]; background: GeneratedImage[]; other: GeneratedImage[] }>()
    for (const img of images) {
      const sbId = (img.storyboardId ?? "").trim()
      if (!sbId) continue
      const bucket = map.get(sbId) ?? { role: [], item: [], background: [], other: [] }
      const cat = (img.category ?? "").trim()
      if (cat === "role") bucket.role.push(img)
      else if (cat === "item") bucket.item.push(img)
      else if (cat === "background") bucket.background.push(img)
      else bucket.other.push(img)
      map.set(sbId, bucket)
    }
    return map
  }, [images])

  const globalImages = useMemo(() => images.filter((i) => !i.storyboardId), [images])

  const globalBuckets = useMemo(() => {
    const bucket = { role: [] as GeneratedImage[], item: [] as GeneratedImage[], background: [] as GeneratedImage[], other: [] as GeneratedImage[] }
    for (const img of globalImages) {
      const cat = (img.category ?? "").trim()
      if (cat === "role") bucket.role.push(img)
      else if (cat === "item") bucket.item.push(img)
      else if (cat === "background") bucket.background.push(img)
      else bucket.other.push(img)
    }
    return bucket
  }, [globalImages])

  const preferredGlobalTab = globalBuckets.role.length > 0 ? "role" : globalBuckets.item.length > 0 ? "item" : "background"
  const effectiveGlobalTab = globalTab === "auto" ? preferredGlobalTab : globalTab

  const episodes = useMemo(() => outlines.slice().sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)), [outlines])
  const activeEpisodeId = useMemo(() => {
    const normalized = episodeId.trim()
    if (normalized && episodes.some((e) => e.id === normalized)) return normalized
    return episodes[0]?.id ?? ""
  }, [episodeId, episodes])

  return (
    <>
      {globalImages.length > 0 ? (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{`全局参考图（${globalImages.length}）`}</div>

          <div className={styles.subTabs} role="tablist" aria-label="全局参考图分类">
            <button
              type="button"
              className={`${styles.subTab} ${effectiveGlobalTab === "role" ? styles.subTabActive : ""}`}
              onClick={() => setGlobalTab("role")}
              role="tab"
              aria-selected={effectiveGlobalTab === "role"}
            >
              {`角色（${globalBuckets.role.length}）`}
            </button>
            <button
              type="button"
              className={`${styles.subTab} ${effectiveGlobalTab === "item" ? styles.subTabActive : ""}`}
              onClick={() => setGlobalTab("item")}
              role="tab"
              aria-selected={effectiveGlobalTab === "item"}
            >
              {`物品（${globalBuckets.item.length}）`}
            </button>
            <button
              type="button"
              className={`${styles.subTab} ${effectiveGlobalTab === "background" ? styles.subTabActive : ""}`}
              onClick={() => setGlobalTab("background")}
              role="tab"
              aria-selected={effectiveGlobalTab === "background"}
            >
              {`背景（${globalBuckets.background.length}）`}
            </button>
          </div>

          {effectiveGlobalTab === "role" ? (
            globalBuckets.role.length > 0 ? (
              <div className={styles.assetGrid}>
                {(globalExpanded ? globalBuckets.role : globalBuckets.role.slice(0, 24)).map((img) => (
                  <a key={img.id} className={styles.thumb} href={img.url} target="_blank" rel="noreferrer">
                    <img className={styles.thumbImg} src={img.thumbnailUrl || img.url} alt={img.name} loading="lazy" />
                  </a>
                ))}
              </div>
            ) : (
              <div className={styles.muted}>暂无角色参考图</div>
            )
          ) : null}

          {effectiveGlobalTab === "item" ? (
            globalBuckets.item.length > 0 ? (
              <div className={styles.assetGrid}>
                {(globalExpanded ? globalBuckets.item : globalBuckets.item.slice(0, 24)).map((img) => (
                  <a key={img.id} className={styles.thumb} href={img.url} target="_blank" rel="noreferrer">
                    <img className={styles.thumbImg} src={img.thumbnailUrl || img.url} alt={img.name} loading="lazy" />
                  </a>
                ))}
              </div>
            ) : (
              <div className={styles.muted}>暂无物品参考图</div>
            )
          ) : null}

          {effectiveGlobalTab === "background" ? (
            globalBuckets.background.length > 0 ? (
              <div className={styles.assetGrid}>
                {(globalExpanded ? globalBuckets.background : globalBuckets.background.slice(0, 24)).map((img) => (
                  <a key={img.id} className={styles.thumb} href={img.url} target="_blank" rel="noreferrer">
                    <img className={styles.thumbImg} src={img.thumbnailUrl || img.url} alt={img.name} loading="lazy" />
                  </a>
                ))}
              </div>
            ) : (
              <div className={styles.muted}>暂无背景参考图</div>
            )
          ) : null}

          {globalBuckets.other.length > 0 ? (
            <>
              <div className={styles.sectionSubTitle}>{`其他（${globalBuckets.other.length}）`}</div>
              <div className={styles.assetGrid}>
                {(globalExpanded ? globalBuckets.other : globalBuckets.other.slice(0, 24)).map((img) => (
                  <a key={img.id} className={styles.thumb} href={img.url} target="_blank" rel="noreferrer">
                    <img className={styles.thumbImg} src={img.thumbnailUrl || img.url} alt={img.name} loading="lazy" />
                  </a>
                ))}
              </div>
            </>
          ) : null}

          {globalImages.length > 24 ? (
            <div className={styles.expandRow}>
              <button type="button" className={styles.expandBtn} onClick={() => setGlobalExpanded((v) => !v)}>
                {globalExpanded ? "收起" : "展开全部"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {episodes.length > 1 ? (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>集数</div>
          <div className={styles.subTabs} role="tablist" aria-label="集数">
            {episodes.slice(0, 20).map((e) => (
              <button
                key={e.id}
                type="button"
                className={`${styles.subTab} ${activeEpisodeId === e.id ? styles.subTabActive : ""}`}
                onClick={() => setEpisodeId(e.id)}
                role="tab"
                aria-selected={activeEpisodeId === e.id}
              >
                {`第${e.sequence}集`}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {activeEpisodeId ? (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {`第${episodes.find((e) => e.id === activeEpisodeId)?.sequence ?? 1}集 · 素材`}
          </div>
          {(shotsByOutlineId[activeEpisodeId] ?? []).length === 0 ? (
            <div className={styles.muted}>该集暂无分镜</div>
          ) : (
            (shotsByOutlineId[activeEpisodeId] ?? []).map((s) => {
              const firstFrame = s.frames?.first?.thumbnailUrl || s.frames?.first?.url || ""
              const lastFrame = s.frames?.last?.thumbnailUrl || s.frames?.last?.url || ""
              const videoUrl = (s.videoInfo?.url ?? "").trim()
              const buckets = imagesByStoryboardId.get(s.id) ?? { role: [], item: [], background: [], other: [] }
              const refs = [...buckets.role, ...buckets.item, ...buckets.background, ...buckets.other]
              const audios = audiosByStoryboardId[s.id] ?? []
              const refsLimit = 12
              const expandedRefs = !!expandedRefsByShotId[s.id]
              const hasMoreRefs =
                buckets.role.length > refsLimit ||
                buckets.item.length > refsLimit ||
                buckets.background.length > refsLimit ||
                buckets.other.length > refsLimit

              const openLinks: Array<{ label: string; href: string }> = []
              if (firstFrame) openLinks.push({ label: "首帧", href: firstFrame })
              if (lastFrame) openLinks.push({ label: "尾帧", href: lastFrame })
              if (videoUrl) openLinks.push({ label: "分镜视频", href: videoUrl })
              if (refs[0]?.url) openLinks.push({ label: "参考图", href: refs[0]!.url })

              return (
                <div key={s.id} className={styles.shotCard}>
                  <div className={styles.shotHeader}>
                    <div className={styles.shotTitle}>{`第${s.sequence}镜`}</div>
                    <div className={styles.shotMeta}>{`${refs.length} 参考图 ｜ ${audios.length} 音频`}</div>
                  </div>

                  {s.storyboardText ? <StoryContentExpandableText text={s.storyboardText} clampLines={6} collapsedMinChars={160} /> : null}

                  {openLinks.length > 0 ? (
                    <div className={styles.linkRow}>
                      {openLinks.map((l) => (
                        <a key={l.label} className={styles.linkBtn} href={l.href} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} style={{ marginRight: 6 }} />
                          {l.label}
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {firstFrame || lastFrame ? (
                    <div className={styles.assetGrid}>
                      {firstFrame ? (
                        <a className={styles.thumb} href={firstFrame} target="_blank" rel="noreferrer">
                          <img className={styles.thumbImg} src={firstFrame} alt="首帧" loading="lazy" />
                        </a>
                      ) : null}
                      {lastFrame ? (
                        <a className={styles.thumb} href={lastFrame} target="_blank" rel="noreferrer">
                          <img className={styles.thumbImg} src={lastFrame} alt="尾帧" loading="lazy" />
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  {refs.length > 0 ? (
                    <div>
                      <div className={styles.sectionTitle}>{`参考图（${refs.length}）`}</div>

                      {buckets.role.length > 0 ? (
                        <>
                          <div className={styles.sectionSubTitle}>{`角色（${buckets.role.length}）`}</div>
                          <div className={styles.assetGrid}>
                            {(expandedRefs ? buckets.role : buckets.role.slice(0, refsLimit)).map((img) => (
                              <a key={img.id} className={styles.thumb} href={img.url} target="_blank" rel="noreferrer">
                                <img className={styles.thumbImg} src={img.thumbnailUrl || img.url} alt={img.name} loading="lazy" />
                              </a>
                            ))}
                          </div>
                        </>
                      ) : null}

                      {buckets.item.length > 0 ? (
                        <>
                          <div className={styles.sectionSubTitle}>{`物品（${buckets.item.length}）`}</div>
                          <div className={styles.assetGrid}>
                            {(expandedRefs ? buckets.item : buckets.item.slice(0, refsLimit)).map((img) => (
                              <a key={img.id} className={styles.thumb} href={img.url} target="_blank" rel="noreferrer">
                                <img className={styles.thumbImg} src={img.thumbnailUrl || img.url} alt={img.name} loading="lazy" />
                              </a>
                            ))}
                          </div>
                        </>
                      ) : null}

                      {buckets.background.length > 0 ? (
                        <>
                          <div className={styles.sectionSubTitle}>{`背景（${buckets.background.length}）`}</div>
                          <div className={styles.assetGrid}>
                            {(expandedRefs ? buckets.background : buckets.background.slice(0, refsLimit)).map((img) => (
                              <a key={img.id} className={styles.thumb} href={img.url} target="_blank" rel="noreferrer">
                                <img className={styles.thumbImg} src={img.thumbnailUrl || img.url} alt={img.name} loading="lazy" />
                              </a>
                            ))}
                          </div>
                        </>
                      ) : null}

                      {buckets.other.length > 0 ? (
                        <>
                          <div className={styles.sectionSubTitle}>{`其他（${buckets.other.length}）`}</div>
                          <div className={styles.assetGrid}>
                            {(expandedRefs ? buckets.other : buckets.other.slice(0, refsLimit)).map((img) => (
                              <a key={img.id} className={styles.thumb} href={img.url} target="_blank" rel="noreferrer">
                                <img className={styles.thumbImg} src={img.thumbnailUrl || img.url} alt={img.name} loading="lazy" />
                              </a>
                            ))}
                          </div>
                        </>
                      ) : null}

                      {hasMoreRefs ? (
                        <div className={styles.expandRow}>
                          <button
                            type="button"
                            className={styles.expandBtn}
                            onClick={() => setExpandedRefsByShotId((prev) => ({ ...prev, [s.id]: !expandedRefs }))}
                          >
                            {expandedRefs ? "收起" : "展开全部"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {videoUrl ? <video className={styles.media} src={videoUrl} controls playsInline /> : null}

                  {audios.length > 0 ? (
                    <div>
                      <div className={styles.sectionTitle}>{`音频（${audios.length}）`}</div>
                      {audios.map((a) => (
                        <div key={a.id} className={styles.audioCard}>
                          <div className={styles.shotHeader}>
                            <div className={styles.shotTitle}>{`${a.roleName}｜${a.speakerName}`}</div>
                          </div>
                          {a.content ? <div className={styles.prose}>{a.content}</div> : null}
                          <audio className={styles.media} src={a.url} controls />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      ) : null}
    </>
  )
}
