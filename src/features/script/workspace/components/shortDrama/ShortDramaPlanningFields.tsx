"use client"

import styles from "./ShortDramaPlanningCard.module.css"
import { toNum } from "./shortDramaPlanningModel"

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

export function TextField({
  label,
  value,
  editing,
  onChange,
  rows = 3,
  placeholder
}: {
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      {editing ? (
        <textarea className={styles.textarea} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className={styles.fieldValue}>{value.trim() ? value : <span className={styles.placeholder}>—</span>}</div>
      )}
    </div>
  )
}

export function SmallField({
  label,
  value,
  editing,
  onChange,
  placeholder
}: {
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      {editing ? (
        <input className={styles.input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className={styles.fieldValue}>{value.trim() ? value : <span className={styles.placeholder}>—</span>}</div>
      )}
    </div>
  )
}

export function NumberField({
  label,
  value,
  editing,
  onChange,
  placeholder
}: {
  label: string
  value: number | ""
  editing: boolean
  onChange: (v: number | "") => void
  placeholder?: string
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      {editing ? (
        <input
          className={styles.input}
          inputMode="numeric"
          value={value === "" ? "" : String(value)}
          placeholder={placeholder}
          onChange={(e) => onChange(toNum(e.target.value))}
        />
      ) : (
        <div className={styles.fieldValue}>{value === "" ? <span className={styles.placeholder}>—</span> : String(value)}</div>
      )}
    </div>
  )
}

export function RangeField({
  label,
  value,
  editing,
  min,
  max,
  step = 1,
  unit,
  onChange
}: {
  label: string
  value: number
  editing: boolean
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  const clamped = (() => {
    const n = Number(value)
    if (!Number.isFinite(n)) return min
    if (n < min) return min
    if (n > max) return max
    return n
  })()
  return (
    <div className={styles.rangeField}>
      <div className={styles.rangeHeader}>
        <div className={styles.rangeLabel}>{label}</div>
        <div className={styles.rangeValue}>
          <input
            className={styles.rangeNumber}
            inputMode="numeric"
            value={String(clamped)}
            disabled={!editing}
            onChange={(e) => {
              const raw = toNum(e.target.value)
              const next = raw === "" ? clamped : Number(raw)
              onChange(next)
            }}
          />
          {unit ? <span className={styles.rangeUnit}>{unit}</span> : null}
        </div>
      </div>
      <input
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={step}
        value={String(clamped)}
        disabled={!editing}
        onChange={(e) => onChange(Math.trunc(Number(e.target.value)))}
      />
      <div className={styles.rangeMarks}>
        <div className={styles.rangeMark}>{min}</div>
        <div className={styles.rangeMark}>{max}</div>
      </div>
    </div>
  )
}
