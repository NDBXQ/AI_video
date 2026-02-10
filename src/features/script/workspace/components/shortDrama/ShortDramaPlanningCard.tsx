"use client"

import { useEffect, useMemo, useState } from "react"
import styles from "./ShortDramaPlanningCard.module.css"
import { callShortDramaCharacterSettings, callShortDramaWorldSetting, patchStoryShortDramaMetadata } from "../../api/shortDrama"
import { Section, TextField, SmallField, RangeField } from "./ShortDramaPlanningFields"
import { cloneJson, sanitizeGenres, toText, unwrapPlanningResult } from "./shortDramaPlanningModel"

type ShortDramaPlanningCardProps = Readonly<{
  storyId: string
  planningResult: any
  worldSetting: any
  characterSetting: any
  planningConfirmedAt?: number
  onSaved?: (nextPlanningResult: any) => void
  onShortDramaUpdate?: (next: any) => void
}>

export function ShortDramaPlanningCard({
  storyId,
  planningResult,
  worldSetting,
  characterSetting,
  planningConfirmedAt,
  onSaved,
  onShortDramaUpdate
}: ShortDramaPlanningCardProps) {
  const normalized = useMemo(() => unwrapPlanningResult(planningResult), [planningResult])
  const [draft, setDraft] = useState<any>(() => {
    const inner = normalized.inner && typeof normalized.inner === "object" ? normalized.inner : {}
    return cloneJson(inner)
  })
  const [snapshot, setSnapshot] = useState<any>(() => cloneJson(draft))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [genreDraft, setGenreDraft] = useState("")
  const [generateErrorText, setGenerateErrorText] = useState<string | null>(null)

  useEffect(() => {
    if (editing || saving || generating) return
    const next = normalized.inner && typeof normalized.inner === "object" ? cloneJson(normalized.inner) : {}
    setDraft(next)
    setSnapshot(cloneJson(next))
  }, [editing, generating, normalized.inner, saving])

  const themeModule = (draft?.theme_module && typeof draft.theme_module === "object" ? draft.theme_module : {}) as any
  const coverModule = (draft?.cover_module && typeof draft.cover_module === "object" ? draft.cover_module : {}) as any
  const parameterModule = (draft?.parameter_module && typeof draft.parameter_module === "object" ? draft.parameter_module : {}) as any
  const coreReq = (themeModule?.core_requirements && typeof themeModule.core_requirements === "object" ? themeModule.core_requirements : {}) as any

  const genres = sanitizeGenres(themeModule?.genres)
  const scriptName = toText(themeModule?.script_name).trim()
  const frequencyType = toText(themeModule?.frequency_type).trim()
  const outputLanguage = toText(themeModule?.output_language).trim()

  const updateTheme = (patch: Record<string, unknown>) => {
    setDraft((prev: any) => {
      const prevObj = prev && typeof prev === "object" ? prev : {}
      const tm = (prevObj as any).theme_module
      const tmObj = tm && typeof tm === "object" ? tm : {}
      return { ...prevObj, theme_module: { ...tmObj, ...patch } }
    })
  }

  const updateCore = (patch: Record<string, unknown>) => {
    setDraft((prev: any) => {
      const prevObj = prev && typeof prev === "object" ? prev : {}
      const tm = (prevObj as any).theme_module
      const tmObj = tm && typeof tm === "object" ? tm : {}
      const cr = (tmObj as any).core_requirements
      const crObj = cr && typeof cr === "object" ? cr : {}
      return { ...prevObj, theme_module: { ...tmObj, core_requirements: { ...crObj, ...patch } } }
    })
  }

  const updateCover = (patch: Record<string, unknown>) => {
    setDraft((prev: any) => {
      const prevObj = prev && typeof prev === "object" ? prev : {}
      const cm = (prevObj as any).cover_module
      const cmObj = cm && typeof cm === "object" ? cm : {}
      return { ...prevObj, cover_module: { ...cmObj, ...patch } }
    })
  }

  const updateParams = (patch: Record<string, unknown>) => {
    setDraft((prev: any) => {
      const prevObj = prev && typeof prev === "object" ? prev : {}
      const pm = (prevObj as any).parameter_module
      const pmObj = pm && typeof pm === "object" ? pm : {}
      return { ...prevObj, parameter_module: { ...pmObj, ...patch } }
    })
  }

  const removeGenre = (idx: number) => updateTheme({ genres: genres.filter((_, i) => i !== idx) })

  const addGenres = () => {
    const raw = genreDraft.trim()
    if (!raw) return
    const parts = raw
      .split(/[,，、\n]/g)
      .map((s) => s.trim())
      .filter(Boolean)
    updateTheme({ genres: sanitizeGenres([...genres, ...parts]) })
    setGenreDraft("")
  }

  const buildPlanningResultForSave = (innerPlanning: any): any => {
    if (normalized.wrapper === "wrapped" && normalized.original && typeof normalized.original === "object") {
      return { ...(normalized.original as any), planning_result: innerPlanning }
    }
    return innerPlanning
  }

  const sanitizeDraftInner = (): any => {
    const inner = draft && typeof draft === "object" ? cloneJson(draft) : {}
    const tm = (inner as any).theme_module
    if (tm && typeof tm === "object") (tm as any).genres = sanitizeGenres((tm as any).genres)
    return inner
  }

  const extractGenerationInputs = (innerPlanning: any): {
    genres: string[]
    worldview_setting: string
    core_conflict: string
    protagonist_setting: string
  } => {
    const theme = innerPlanning?.theme_module ?? {}
    const rawGenres = Array.isArray(theme?.genres) ? theme.genres : []
    const genres = sanitizeGenres(rawGenres)
    const core = theme?.core_requirements ?? {}
    const worldview_setting = typeof core?.worldview_setting === "string" ? core.worldview_setting : ""
    const core_conflict = typeof core?.core_conflict === "string" ? core.core_conflict : ""
    const protagonist_setting = typeof core?.protagonist_setting === "string" ? core.protagonist_setting : ""
    return { genres, worldview_setting, core_conflict, protagonist_setting }
  }

  const onEditClick = () => {
    setSnapshot(cloneJson(draft))
    setErrorText(null)
    setEditing(true)
  }

  const onCancelClick = () => {
    setDraft(cloneJson(snapshot))
    setErrorText(null)
    setEditing(false)
    setGenreDraft("")
  }

  const onSaveClick = async () => {
    if (saving) return
    setSaving(true)
    setErrorText(null)
    try {
      const sanitizedInner = sanitizeDraftInner()
      const nextPlanningResult = buildPlanningResultForSave(sanitizedInner)
      await patchStoryShortDramaMetadata(storyId, { planningResult: nextPlanningResult, worldSetting, characterSetting })
      setSnapshot(cloneJson(sanitizedInner))
      setEditing(false)
      setGenreDraft("")
      onSaved?.(nextPlanningResult)
    } catch (e) {
      const anyErr = e as { message?: string }
      setErrorText(anyErr?.message ?? "保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  const onConfirmAndGenerate = async () => {
    if (saving || generating) return
    setGenerateErrorText(null)
    setGenerating(true)
    const confirmedAt = Date.now()
    try {
      const sanitizedInner = sanitizeDraftInner()
      const nextPlanningResult = buildPlanningResultForSave(sanitizedInner)

      await patchStoryShortDramaMetadata(storyId, {
        planningResult: nextPlanningResult,
        worldSetting,
        characterSetting,
        planningConfirmedAt: confirmedAt
      })
      onShortDramaUpdate?.({ planningResult: nextPlanningResult, worldSetting, characterSetting, planningConfirmedAt: confirmedAt })
      onSaved?.(nextPlanningResult)

      const inputs = extractGenerationInputs(sanitizedInner)
      const [nextWorldSetting, nextCharacterSetting] = await Promise.all([
        callShortDramaWorldSetting({ genres: inputs.genres, worldview_setting: inputs.worldview_setting, core_conflict: inputs.core_conflict }),
        callShortDramaCharacterSettings({
          genres: inputs.genres,
          worldview_setting: inputs.worldview_setting,
          core_conflict: inputs.core_conflict,
          protagonist_setting: inputs.protagonist_setting
        })
      ])

      await patchStoryShortDramaMetadata(storyId, {
        planningResult: nextPlanningResult,
        worldSetting: nextWorldSetting,
        characterSetting: nextCharacterSetting,
        planningConfirmedAt: confirmedAt
      })

      setSnapshot(cloneJson(sanitizedInner))
      setEditing(false)
      setGenreDraft("")
      onShortDramaUpdate?.({
        planningResult: nextPlanningResult,
        worldSetting: nextWorldSetting,
        characterSetting: nextCharacterSetting,
        planningConfirmedAt: confirmedAt
      })
    } catch (e) {
      const anyErr = e as { message?: string }
      setGenerateErrorText(anyErr?.message ?? "生成失败，请稍后重试")
    } finally {
      setGenerating(false)
    }
  }

  const duration = (parameterModule?.single_episode_duration && typeof parameterModule.single_episode_duration === "object"
    ? parameterModule.single_episode_duration
    : {}) as any

  const getInt = (v: any, fallback: number): number => {
    const n = Number(v)
    if (!Number.isFinite(n)) return fallback
    return Math.trunc(n)
  }

  const clampInt = (v: number, min: number, max: number): number => {
    if (v < min) return min
    if (v > max) return max
    return Math.trunc(v)
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.title}>{scriptName || "未命名短剧"}</div>
          <div className={styles.subTitle}>
            {frequencyType ? `频类型：${frequencyType}` : ""}
            {frequencyType && outputLanguage ? " · " : ""}
            {outputLanguage ? `语言：${outputLanguage}` : ""}
          </div>
        </div>
        <div className={styles.headerActions}>
          {editing ? (
            <>
              <button type="button" className={styles.secondaryBtn} onClick={onCancelClick} disabled={saving}>
                取消
              </button>
              <button type="button" className={styles.primaryBtn} onClick={onSaveClick} disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={onConfirmAndGenerate}
                disabled={generating || saving || !planningResult}
              >
                {generating ? "生成中…" : planningConfirmedAt ? "重新生成设定" : "确认策划并生成设定"}
              </button>
              <button type="button" className={styles.primaryBtn} onClick={onEditClick} disabled={generating || saving}>
                编辑
              </button>
            </>
          )}
        </div>
      </div>

      {errorText ? <div className={styles.error}>{errorText}</div> : null}
      {generateErrorText ? <div className={styles.error}>{generateErrorText}</div> : null}

      <div className={styles.briefLayout}>
        <div className={styles.col} aria-label="基础信息">
          <div className={styles.meta}>
            <div className={styles.metaLabel}>题材</div>
            <div className={styles.metaValue}>
              <div className={styles.chips}>
                {genres.length ? (
                  genres.map((g, idx) => (
                    <span key={`${g}_${idx}`} className={styles.chip}>
                      <span className={styles.chipText}>{g}</span>
                      {editing ? (
                        <button type="button" className={styles.chipRemove} onClick={() => removeGenre(idx)} aria-label={`移除题材 ${g}`}>
                          ×
                        </button>
                      ) : null}
                    </span>
                  ))
                ) : (
                  <span className={styles.placeholder}>—</span>
                )}
              </div>
              {editing ? (
                <div className={styles.genreEditor}>
                  <input
                    className={styles.input}
                    value={genreDraft}
                    placeholder="输入题材，回车或点击添加（支持逗号分隔）"
                    onChange={(e) => setGenreDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addGenres()
                      }
                    }}
                  />
                  <button type="button" className={styles.secondaryBtn} onClick={addGenres} disabled={!genreDraft.trim()}>
                    添加
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <Section title="主题">
            <SmallField label="剧名" value={toText(themeModule?.script_name)} editing={editing} placeholder="请输入剧名" onChange={(v) => updateTheme({ script_name: v })} />
            <SmallField
              label="频类型"
              value={toText(themeModule?.frequency_type)}
              editing={editing}
              placeholder="如：男频/女频"
              onChange={(v) => updateTheme({ frequency_type: v })}
            />
            <SmallField
              label="语言"
              value={toText(themeModule?.output_language)}
              editing={editing}
              placeholder="如：中文"
              onChange={(v) => updateTheme({ output_language: v })}
            />
            <TextField label="主题概述" value={toText(themeModule?.theme)} editing={editing} rows={4} onChange={(v) => updateTheme({ theme: v })} />
          </Section>

          <Section title="核心设定">
            <TextField label="核心冲突" value={toText(coreReq?.core_conflict)} editing={editing} rows={4} onChange={(v) => updateCore({ core_conflict: v })} />
            <TextField label="世界观设定" value={toText(coreReq?.worldview_setting)} editing={editing} rows={4} onChange={(v) => updateCore({ worldview_setting: v })} />
            <TextField label="主角设定" value={toText(coreReq?.protagonist_setting)} editing={editing} rows={4} onChange={(v) => updateCore({ protagonist_setting: v })} />
            <TextField label="叙事风格" value={toText(coreReq?.narrative_style)} editing={editing} rows={3} onChange={(v) => updateCore({ narrative_style: v })} />
            <TextField label="短剧适配要点" value={toText(coreReq?.short_drama_adaptation)} editing={editing} rows={3} onChange={(v) => updateCore({ short_drama_adaptation: v })} />
          </Section>
        </div>

        <div className={styles.col} aria-label="参数">
          <RangeField
            label="总集数"
            unit="集"
            value={getInt(parameterModule?.total_episodes, 60)}
            editing={editing}
            min={1}
            max={120}
            onChange={(v) => updateParams({ total_episodes: clampInt(v, 1, 120) })}
          />
          <RangeField
            label="对白占比"
            unit="%"
            value={getInt(parameterModule?.dialogue_word_ratio, 40)}
            editing={editing}
            min={0}
            max={100}
            onChange={(v) => updateParams({ dialogue_word_ratio: clampInt(v, 0, 100) })}
          />
          <RangeField
            label="主要角色上限"
            unit="人"
            value={getInt(parameterModule?.main_characters_limit, 10)}
            editing={editing}
            min={1}
            max={20}
            onChange={(v) => updateParams({ main_characters_limit: clampInt(v, 1, 20) })}
          />
          <RangeField
            label="单集场景上限"
            unit="场"
            value={getInt(parameterModule?.scenes_per_episode_limit, 3)}
            editing={editing}
            min={1}
            max={10}
            onChange={(v) => updateParams({ scenes_per_episode_limit: clampInt(v, 1, 10) })}
          />
          <RangeField
            label="单集字数上限"
            unit="字"
            value={getInt(parameterModule?.word_limit_per_episode, 1200)}
            editing={editing}
            min={200}
            max={3000}
            step={50}
            onChange={(v) => updateParams({ word_limit_per_episode: clampInt(v, 200, 3000) })}
          />
          <RangeField
            label="单集时长最小"
            unit={toText(duration?.unit) || "分钟"}
            value={getInt(duration?.min, 3)}
            editing={editing}
            min={1}
            max={10}
            onChange={(v) => {
              const nextMin = clampInt(v, 1, 10)
              const nextMax = Math.max(nextMin, getInt(duration?.max, 4))
              updateParams({ single_episode_duration: { ...duration, min: nextMin, max: nextMax, unit: toText(duration?.unit) || "分钟" } })
            }}
          />
          <RangeField
            label="单集时长最大"
            unit={toText(duration?.unit) || "分钟"}
            value={getInt(duration?.max, 4)}
            editing={editing}
            min={1}
            max={10}
            onChange={(v) => {
              const nextMax = clampInt(v, 1, 10)
              const nextMin = Math.min(nextMax, getInt(duration?.min, 3))
              updateParams({ single_episode_duration: { ...duration, min: nextMin, max: nextMax, unit: toText(duration?.unit) || "分钟" } })
            }}
          />
        </div>

        <div className={styles.col} aria-label="封面预览">
          <div className={styles.coverPreview}>
            <div className={styles.coverTitle}>封面预览</div>
            <div className={styles.coverCard}>
              <div className={styles.coverName}>{scriptName || "未命名短剧"}</div>
              <div className={styles.coverMeta}>{toText(coverModule?.visual_style).trim() ? `风格：${toText(coverModule?.visual_style).trim()}` : "风格：—"}</div>
              <div className={styles.coverMeta}>{toText(coverModule?.protagonist_image).trim() ? `主角：${toText(coverModule?.protagonist_image).trim()}` : "主角：—"}</div>
              <div className={styles.coverMeta}>
                {toText(coverModule?.background_environment).trim() ? `背景：${toText(coverModule?.background_environment).trim()}` : "背景：—"}
              </div>
            </div>
          </div>

          <Section title="封面方向">
            <TextField label="标题设计" value={toText(coverModule?.title_design)} editing={editing} rows={3} onChange={(v) => updateCover({ title_design: v })} />
            <TextField label="视觉风格" value={toText(coverModule?.visual_style)} editing={editing} rows={3} onChange={(v) => updateCover({ visual_style: v })} />
            <TextField label="主角形象" value={toText(coverModule?.protagonist_image)} editing={editing} rows={3} onChange={(v) => updateCover({ protagonist_image: v })} />
            <TextField label="背景环境" value={toText(coverModule?.background_environment)} editing={editing} rows={3} onChange={(v) => updateCover({ background_environment: v })} />
          </Section>
        </div>
      </div>
    </div>
  )
}
