import type { ReactNode } from "react"
import { Card } from "@/shared/ui/shadcn/card"
import { Separator } from "@/shared/ui/shadcn/separator"
import { SectionHeader } from "@/shared/ui/SectionHeader"

export function WorkflowPhaseCard({
  title,
  status,
  right,
  children
}: {
  title: string
  status?: string | null
  right?: ReactNode
  children: ReactNode
}): ReactNode {
  return (
    <Card className="overflow-hidden rounded-[var(--theme-radius)] border-[color:var(--theme-border)] bg-[var(--theme-surface)] shadow-[var(--theme-shadow)]">
      <SectionHeader title={title} status={status} right={right} />
      <Separator className="bg-[color:rgba(255,255,255,0.06)]" />
      <div className="px-4 py-4">{children}</div>
    </Card>
  )
}
