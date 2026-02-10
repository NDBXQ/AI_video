import type { ReactElement, ReactNode } from "react"
import { Badge } from "@/shared/ui/shadcn/badge"

type StatusTone = "neutral" | "success" | "warning" | "danger"

function inferTone(label: string): StatusTone {
  const t = String(label ?? "").trim()
  if (!t) return "neutral"
  if (/(失败|error|failed)/i.test(t)) return "danger"
  if (/(生成中|处理中|processing|running|pending)/i.test(t)) return "warning"
  if (/(已完成|完成|已生成|success|done|completed)/i.test(t)) return "success"
  return "neutral"
}

export function StatusBadge({
  label,
  tone
}: {
  label: string
  tone?: StatusTone
}): ReactElement | null {
  const text = String(label ?? "").trim()
  if (!text) return null
  const t = tone ?? inferTone(text)

  if (t === "danger") {
    return (
      <Badge
        variant="destructive"
        className="shrink-0 text-[11px] font-extrabold tracking-tight text-[color:var(--theme-text-strong)]"
      >
        {text}
      </Badge>
    )
  }

  if (t === "warning") {
    return (
      <Badge
        variant="secondary"
        className="shrink-0 border-[color:rgba(251,191,36,0.22)] bg-[color:rgba(251,191,36,0.14)] text-[11px] font-extrabold tracking-tight text-[color:var(--theme-text-strong)]"
      >
        {text}
      </Badge>
    )
  }

  if (t === "success") {
    return (
      <Badge
        variant="secondary"
        className="shrink-0 border-[color:rgba(34,197,94,0.22)] bg-[color:rgba(34,197,94,0.14)] text-[11px] font-extrabold tracking-tight text-[color:var(--theme-text-strong)]"
      >
        {text}
      </Badge>
    )
  }

  return (
    <Badge
      variant="secondary"
      className="shrink-0 border-[color:var(--theme-border)] bg-[var(--theme-surface-3)] text-[11px] font-extrabold tracking-tight text-[color:var(--theme-text-muted)]"
    >
      {text}
    </Badge>
  )
}

export function SectionHeader({
  title,
  status,
  right
}: {
  title: string
  status?: string | null
  right?: ReactNode
}): ReactElement {
  return (
    <div className="flex flex-col gap-2 px-4 pb-3 pt-4 [background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0)_70%)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-[color:var(--theme-text-strong)]">
            {title}
          </h3>
          {status ? <StatusBadge label={status} /> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  )
}

