"use client"

import { useMemo, useState } from "react"
import styles from "./ShortDramaCharacterSettingsCard.module.css"
import { patchStoryShortDramaMetadata } from "../../api/shortDrama"
import { Section, TextField, SmallField } from "./ShortDramaPlanningFields"
import { cloneJson, toText, unwrapCharacterSettings } from "./shortDramaPlanningModel"

type ShortDramaCharacterSettingsCardProps = Readonly<{
  storyId: string
  planningResult: any
  worldSetting: any
  characterSetting: any
  onSaved?: (nextCharacterSetting: any) => void
}>

type CharacterItem = Record<string, unknown>

function buildCharacterSettingForSave(input: { normalized: ReturnType<typeof unwrapCharacterSettings>; inner: any }): any {
  if (input.normalized.wrapper === "wrapped" && input.normalized.original && typeof input.normalized.original === "object") {
    return { ...(input.normalized.original as any), character_settings: input.inner }
  }
  return input.inner
}

function getCharacters(inner: any): CharacterItem[] {
  const base = inner && typeof inner === "object" ? inner : {}
  const list = (base as any)?.characters
  return Array.isArray(list) ? (list.filter((x) => x && typeof x === "object") as CharacterItem[]) : []
}

function withCharacters(inner: any, characters: CharacterItem[]): any {
  const base = inner && typeof inner === "object" ? inner : {}
  return { ...base, characters }
}

function defaultCharacter(): CharacterItem {
  return {
    character_name: "",
    character_type: "",
    age: "",
    occupation: "",
    appearance: "",
    physique: "",
    hairstyle: "",
    clothing: "",
    personality: "",
    strengths: "",
    weaknesses: "",
    tone: "",
    script_setting: "",
    special_skills: "",
    cover_description: ""
  }
}

export function ShortDramaCharacterSettingsCard({
  storyId,
  planningResult,
  worldSetting,
  characterSetting,
  onSaved
}: ShortDramaCharacterSettingsCardProps) {
  const normalized = useMemo(() => unwrapCharacterSettings(characterSetting), [characterSetting])
  const [draft, setDraft] = useState<any>(() => {
    const inner = normalized.inner && typeof normalized.inner === "object" ? normalized.inner : {}
    return cloneJson(inner)
  })
  const [snapshot, setSnapshot] = useState<any>(() => cloneJson(draft))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const hasPlanning = Boolean(planningResult)
  const characters = getCharacters(draft)
  const active = characters[activeIndex] ?? null

  const updateActive = (patch: Record<string, unknown>) => {
    setDraft((prev: any) => {
      const prevObj = prev && typeof prev === "object" ? prev : {}
      const list = getCharacters(prevObj)
      const idx = Math.max(0, Math.min(activeIndex, list.length - 1))
      const current = list[idx] ?? defaultCharacter()
      const nextList = list.slice()
      nextList[idx] = { ...current, ...patch }
      return withCharacters(prevObj, nextList)
    })
  }

  const onAddCharacter = () => {
    setDraft((prev: any) => {
      const prevObj = prev && typeof prev === "object" ? prev : {}
      const list = getCharacters(prevObj)
      const nextList = [...list, defaultCharacter()]
      return withCharacters(prevObj, nextList)
    })
    setActiveIndex(characters.length)
  }

  const onRemoveActive = () => {
    setDraft((prev: any) => {
      const prevObj = prev && typeof prev === "object" ? prev : {}
      const list = getCharacters(prevObj)
      if (list.length === 0) return prevObj
      const idx = Math.max(0, Math.min(activeIndex, list.length - 1))
      const nextList = list.filter((_, i) => i !== idx)
      return withCharacters(prevObj, nextList)
    })
    setActiveIndex((i) => Math.max(0, i - 1))
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
  }

  const onSaveClick = async () => {
    if (saving) return
    setSaving(true)
    setErrorText(null)
    try {
      const inner = draft && typeof draft === "object" ? cloneJson(draft) : {}
      const nextCharacterSetting = buildCharacterSettingForSave({ normalized, inner })
      await patchStoryShortDramaMetadata(storyId, {
        planningResult,
        worldSetting,
        characterSetting: nextCharacterSetting
      })
      setSnapshot(cloneJson(inner))
      setEditing(false)
      onSaved?.(nextCharacterSetting)
    } catch (e) {
      const anyErr = e as { message?: string }
      setErrorText(anyErr?.message ?? "保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.title}>角色设定</div>
          <div className={styles.subTitle}>{hasPlanning ? "可基于策划内容调整" : "缺少策划结果，仍可手动编辑"}</div>
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
            <button type="button" className={styles.primaryBtn} onClick={onEditClick}>
              编辑
            </button>
          )}
        </div>
      </div>

      {errorText ? <div className={styles.error}>{errorText}</div> : null}

      <div className={styles.characterBar} aria-label="角色列表">
        <div className={styles.characterTabs}>
          {characters.length ? (
            characters.map((c, idx) => {
              const name = toText((c as any)?.character_name).trim() || `角色${idx + 1}`
              return (
                <button
                  key={`${name}_${idx}`}
                  type="button"
                  className={idx === activeIndex ? `${styles.characterTab} ${styles.characterTabActive}` : styles.characterTab}
                  onClick={() => setActiveIndex(idx)}
                >
                  {name}
                </button>
              )
            })
          ) : (
            <div className={styles.placeholder}>暂无角色</div>
          )}
        </div>
        {editing ? (
          <div className={styles.characterActions}>
            <button type="button" className={styles.secondaryBtn} onClick={onAddCharacter}>
              新增角色
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={onRemoveActive} disabled={!characters.length}>
              删除当前
            </button>
          </div>
        ) : null}
      </div>

      {active ? (
        <div className={styles.grid}>
          <Section title="基础信息">
            <div className={styles.kvGrid}>
              <SmallField
                label="姓名"
                value={toText((active as any)?.character_name)}
                editing={editing}
                placeholder="角色名"
                onChange={(v) => updateActive({ character_name: v })}
              />
              <SmallField
                label="类型"
                value={toText((active as any)?.character_type)}
                editing={editing}
                placeholder="如：女主/男主/反派"
                onChange={(v) => updateActive({ character_type: v })}
              />
              <SmallField label="年龄" value={toText((active as any)?.age)} editing={editing} onChange={(v) => updateActive({ age: v })} />
              <SmallField
                label="职业"
                value={toText((active as any)?.occupation)}
                editing={editing}
                onChange={(v) => updateActive({ occupation: v })}
              />
            </div>
          </Section>

          <Section title="人物小传">
            <TextField
              label="剧本人设"
              value={toText((active as any)?.script_setting)}
              editing={editing}
              rows={5}
              onChange={(v) => updateActive({ script_setting: v })}
            />
            <TextField
              label="性格"
              value={toText((active as any)?.personality)}
              editing={editing}
              rows={4}
              onChange={(v) => updateActive({ personality: v })}
            />
          </Section>

          <Section title="外形与包装">
            <TextField
              label="相貌"
              value={toText((active as any)?.appearance)}
              editing={editing}
              rows={4}
              onChange={(v) => updateActive({ appearance: v })}
            />
            <TextField
              label="体格"
              value={toText((active as any)?.physique)}
              editing={editing}
              rows={3}
              onChange={(v) => updateActive({ physique: v })}
            />
            <TextField
              label="发型"
              value={toText((active as any)?.hairstyle)}
              editing={editing}
              rows={3}
              onChange={(v) => updateActive({ hairstyle: v })}
            />
            <TextField
              label="服装"
              value={toText((active as any)?.clothing)}
              editing={editing}
              rows={3}
              onChange={(v) => updateActive({ clothing: v })}
            />
            <TextField
              label="封面描述"
              value={toText((active as any)?.cover_description)}
              editing={editing}
              rows={3}
              onChange={(v) => updateActive({ cover_description: v })}
            />
          </Section>

          <Section title="能力与缺点">
            <TextField
              label="特长/技能"
              value={toText((active as any)?.special_skills)}
              editing={editing}
              rows={4}
              onChange={(v) => updateActive({ special_skills: v })}
            />
            <TextField
              label="弱点"
              value={toText((active as any)?.weaknesses)}
              editing={editing}
              rows={4}
              onChange={(v) => updateActive({ weaknesses: v })}
            />
            <TextField
              label="口吻"
              value={toText((active as any)?.tone)}
              editing={editing}
              rows={4}
              onChange={(v) => updateActive({ tone: v })}
            />
          </Section>
        </div>
      ) : (
        <div className={styles.empty}>暂无可编辑角色</div>
      )}
    </div>
  )
}

