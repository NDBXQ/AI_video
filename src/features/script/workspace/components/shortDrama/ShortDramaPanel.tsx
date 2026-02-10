"use client"

import { useMemo, useState } from "react"
import styles from "./ShortDramaPanel.module.css"
import { ShortDramaPlanningCard } from "./ShortDramaPlanningCard"
import { ShortDramaWorldSettingCard } from "./ShortDramaWorldSettingCard"
import { ShortDramaCharacterSettingsCard } from "./ShortDramaCharacterSettingsCard"

type ShortDramaPanelProps = Readonly<{
  storyId: string
  shortDrama: any
  onShortDramaUpdate?: (next: any) => void
}>

type StepKey = "planning" | "world" | "character"

export function ShortDramaPanel({ storyId, shortDrama, onShortDramaUpdate }: ShortDramaPanelProps) {
  const shortDramaObj = shortDrama && typeof shortDrama === "object" ? (shortDrama as any) : {}
  const planningResult = shortDramaObj?.planningResult ?? null
  const worldSetting = shortDramaObj?.worldSetting ?? null
  const characterSetting = shortDramaObj?.characterSetting ?? null
  const planningConfirmedAt = typeof shortDramaObj?.planningConfirmedAt === "number" ? shortDramaObj.planningConfirmedAt : null
  const [active, setActive] = useState<StepKey>("planning")

  const steps = useMemo(() => {
    const hasPlanning = Boolean(planningResult)
    const hasWorld = Boolean(worldSetting)
    const hasCharacter = Boolean(characterSetting)
    return [
      {
        key: "planning" as const,
        title: "剧本策划",
        desc: "前置条件",
        ok: hasPlanning,
        badge: hasPlanning ? (planningConfirmedAt ? "已确认" : "未确认") : "未生成"
      },
      { key: "world" as const, title: "世界观设定", desc: "基于策划并行", ok: hasWorld },
      { key: "character" as const, title: "角色设定", desc: "基于策划并行", ok: hasCharacter }
    ]
  }, [characterSetting, planningConfirmedAt, planningResult, worldSetting])

  return (
    <div className={styles.root} aria-label="短剧信息">
      <aside className={styles.nav} aria-label="短剧步骤">
        {steps.map((s) => (
          <button
            key={s.key}
            type="button"
            className={active === s.key ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
            onClick={() => setActive(s.key)}
          >
            <div className={styles.navRow}>
              <div className={styles.navTitle}>{s.title}</div>
              {"badge" in s ? (
                <div className={s.badge === "已确认" ? styles.badgeOk : styles.badgeMuted}>{String((s as any).badge)}</div>
              ) : (
                <div className={s.ok ? styles.badgeOk : styles.badgeMuted}>{s.ok ? "已生成" : "未生成"}</div>
              )}
            </div>
            <div className={styles.navDesc}>{s.desc}</div>
          </button>
        ))}
      </aside>

      <section className={styles.detail} aria-label="短剧详情">
        {active === "planning" ? (
          <ShortDramaPlanningCard
            storyId={storyId}
            planningResult={planningResult}
            worldSetting={worldSetting}
            characterSetting={characterSetting}
            planningConfirmedAt={planningConfirmedAt ?? undefined}
            onSaved={(nextPlanningResult) => onShortDramaUpdate?.({ ...shortDramaObj, planningResult: nextPlanningResult })}
            onShortDramaUpdate={onShortDramaUpdate}
          />
        ) : active === "world" ? (
          <ShortDramaWorldSettingCard
            storyId={storyId}
            planningResult={planningResult}
            worldSetting={worldSetting}
            characterSetting={characterSetting}
            onSaved={(nextWorldSetting) => onShortDramaUpdate?.({ ...shortDramaObj, worldSetting: nextWorldSetting })}
          />
        ) : (
          <ShortDramaCharacterSettingsCard
            storyId={storyId}
            planningResult={planningResult}
            worldSetting={worldSetting}
            characterSetting={characterSetting}
            onSaved={(nextCharacterSetting) => onShortDramaUpdate?.({ ...shortDramaObj, characterSetting: nextCharacterSetting })}
          />
        )}
      </section>
    </div>
  )
}
