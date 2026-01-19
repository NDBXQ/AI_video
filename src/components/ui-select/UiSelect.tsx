"use client"

import { Check, ChevronDown } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { KeyboardEvent, ReactElement } from "react"
import styles from "./UiSelect.module.css"

export type UiSelectOption = {
  value: string
  label: string
}

type UiSelectProps = {
  value: string
  options: UiSelectOption[]
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
}

export function UiSelect({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false
}: UiSelectProps): ReactElement {
  const id = useId()
  const listboxId = `${id}-listbox`
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const selectedIndex = useMemo(() => {
    return options.findIndex((o) => o.value === value)
  }, [options, value])

  const selectedLabel = useMemo(() => {
    const matched = options.find((o) => o.value === value)
    return matched?.label ?? ""
  }, [options, value])

  const close = useCallback((): void => {
    setOpen(false)
    setActiveIndex(-1)
  }, [])

  const openWithActive = useCallback((): void => {
    if (disabled) return
    setOpen(true)
    setActiveIndex((prev) => {
      if (prev >= 0) return prev
      return selectedIndex >= 0 ? selectedIndex : 0
    })
  }, [disabled, selectedIndex])

  const commit = useCallback(
    (nextIndex: number): void => {
      const next = options[nextIndex]
      if (!next) return
      onChange(next.value)
      close()
      queueMicrotask(() => triggerRef.current?.focus())
    },
    [close, onChange, options]
  )

  useEffect(() => {
    if (!open) return

    const onMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node | null
      if (!target) return
      if (rootRef.current && !rootRef.current.contains(target)) close()
    }

    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [close, open])

  useEffect(() => {
    if (!open) return
    if (activeIndex < 0) return
    const optionEl = document.getElementById(`${id}-opt-${activeIndex}`)
    optionEl?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, id, open])

  const moveActive = useCallback(
    (delta: number): void => {
      if (options.length === 0) return
      setActiveIndex((curr) => {
        const start = curr >= 0 ? curr : selectedIndex >= 0 ? selectedIndex : 0
        const next = (start + delta + options.length) % options.length
        return next
      })
    },
    [options.length, selectedIndex]
  )

  const onTriggerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>): void => {
      if (disabled) return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        if (!open) openWithActive()
        else moveActive(1)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (!open) openWithActive()
        else moveActive(-1)
        return
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        if (!open) openWithActive()
        else if (activeIndex >= 0) commit(activeIndex)
        return
      }
      if (e.key === "Escape") {
        if (!open) return
        e.preventDefault()
        close()
      }
    },
    [activeIndex, close, commit, disabled, moveActive, open, openWithActive]
  )

  const onListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        moveActive(1)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        moveActive(-1)
        return
      }
      if (e.key === "Home") {
        e.preventDefault()
        setActiveIndex(0)
        return
      }
      if (e.key === "End") {
        e.preventDefault()
        setActiveIndex(Math.max(0, options.length - 1))
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        if (activeIndex >= 0) commit(activeIndex)
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        close()
        queueMicrotask(() => triggerRef.current?.focus())
        return
      }
      if (e.key === "Tab") {
        close()
      }
    },
    [activeIndex, close, commit, moveActive, options.length]
  )

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${disabled ? styles.triggerDisabled : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          if (open) close()
          else openWithActive()
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={styles.value}>{selectedLabel}</span>
        <ChevronDown className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          className={styles.list}
          aria-activedescendant={activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
          onKeyDown={onListKeyDown}
        >
          {options.map((opt, idx) => {
            const selected = opt.value === value
            const active = idx === activeIndex
            return (
              <button
                key={opt.value}
                id={`${id}-opt-${idx}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${styles.option} ${active ? styles.optionActive : ""}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => commit(idx)}
              >
                <span className={styles.optionText}>{opt.label}</span>
                {selected ? <Check className={styles.check} /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

