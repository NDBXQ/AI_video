import Link from "next/link"
import type { ReactElement, ReactNode } from "react"
import styles from "./EmptyState.module.css"

type EmptyStateAction =
  | Readonly<{
      label: string
      href: string
    }>
  | Readonly<{
      label: string
      onClick: () => void
    }>

type EmptyStateProps = Readonly<{
  title: string
  description?: string
  primaryAction?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  learnHref?: string
  learnLabel?: string
  icon?: ReactNode
  size?: "card" | "inline"
  className?: string
}>

function Action({ action, variant }: Readonly<{ action: EmptyStateAction; variant: "primary" | "secondary" }>): ReactElement {
  const className = variant === "primary" ? styles.primaryAction : styles.secondaryAction
  if ("href" in action) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    )
  }
  return (
    <button type="button" className={className} onClick={action.onClick}>
      {action.label}
    </button>
  )
}

export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  learnHref,
  learnLabel = "查看帮助",
  icon,
  size = "card",
  className
}: EmptyStateProps): ReactElement {
  const wrapClassName = `${size === "inline" ? styles.inline : styles.card}${className ? ` ${className}` : ""}`
  return (
    <div className={wrapClassName}>
      {icon ? <div className={styles.icon}>{icon}</div> : <div className={styles.iconPlaceholder} aria-hidden="true" />}
      <div className={styles.title}>{title}</div>
      {description ? <div className={styles.desc}>{description}</div> : null}

      {primaryAction || secondaryAction || learnHref ? (
        <div className={styles.actions}>
          {primaryAction ? <Action action={primaryAction} variant="primary" /> : null}
          {secondaryAction ? <Action action={secondaryAction} variant="secondary" /> : null}
          {learnHref ? (
            <Link href={learnHref} className={styles.learnLink}>
              {learnLabel} →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
