"use client"

import { useMemo, useState } from "react"
import styles from "./ShortDramaWorldSettingCard.module.css"
import { patchStoryShortDramaMetadata } from "../../api/shortDrama"
import { Section, TextField } from "./ShortDramaPlanningFields"
import { cloneJson, toText, unwrapWorldSetting } from "./shortDramaPlanningModel"

type ShortDramaWorldSettingCardProps = Readonly<{
  storyId: string
  planningResult: any
  worldSetting: any
  characterSetting: any
  onSaved?: (nextWorldSetting: any) => void
}>

function buildWorldSettingForSave(input: { normalized: ReturnType<typeof unwrapWorldSetting>; inner: any }): any {
  if (input.normalized.wrapper === "wrapped" && input.normalized.original && typeof input.normalized.original === "object") {
    return { ...(input.normalized.original as any), world_setting: input.inner }
  }
  return input.inner
}

export function ShortDramaWorldSettingCard({
  storyId,
  planningResult,
  worldSetting,
  characterSetting,
  onSaved
}: ShortDramaWorldSettingCardProps) {
  const normalized = useMemo(() => unwrapWorldSetting(worldSetting), [worldSetting])
  const [draft, setDraft] = useState<any>(() => {
    const inner = normalized.inner && typeof normalized.inner === "object" ? normalized.inner : {}
    return cloneJson(inner)
  })
  const [snapshot, setSnapshot] = useState<any>(() => cloneJson(draft))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  const hasPlanning = Boolean(planningResult)

  const update = (patch: Record<string, unknown>) => {
    setDraft((prev: any) => {
      const prevObj = prev && typeof prev === "object" ? prev : {}
      return { ...prevObj, ...patch }
    })
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
      const nextWorldSetting = buildWorldSettingForSave({ normalized, inner })
      await patchStoryShortDramaMetadata(storyId, {
        planningResult,
        worldSetting: nextWorldSetting,
        characterSetting
      })
      setSnapshot(cloneJson(inner))
      setEditing(false)
      onSaved?.(nextWorldSetting)
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
          <div className={styles.title}>世界观设定</div>
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

      <div className={styles.grid}>
        <Section title="世界观">
          <TextField label="世界现状" value={toText(draft?.world_status)} editing={editing} rows={4} onChange={(v) => update({ world_status: v })} />
          <TextField label="世界规则" value={toText(draft?.world_rules)} editing={editing} rows={4} onChange={(v) => update({ world_rules: v })} />
        </Section>

        <Section title="时间与地点">
          <TextField label="时间设定" value={toText(draft?.time_setting)} editing={editing} rows={4} onChange={(v) => update({ time_setting: v })} />
          <TextField label="地点设定" value={toText(draft?.location_setting)} editing={editing} rows={4} onChange={(v) => update({ location_setting: v })} />
        </Section>

        <Section title="社会细节">
          <TextField label="交通手段" value={toText(draft?.transportation_method)} editing={editing} rows={4} onChange={(v) => update({ transportation_method: v })} />
          <TextField label="通信手段" value={toText(draft?.communication_method)} editing={editing} rows={4} onChange={(v) => update({ communication_method: v })} />
        </Section>

        <Section title="适配说明">
          <TextField label="题材适配" value={toText(draft?.theme_adaptation)} editing={editing} rows={4} onChange={(v) => update({ theme_adaptation: v })} />
        </Section>
      </div>
    </div>
  )
}

