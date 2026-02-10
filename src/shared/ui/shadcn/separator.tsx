import * as React from "react"
import { cn } from "@/shared/ui/shadcn/cn"

export type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    {
      className,
      orientation = "horizontal",
      decorative = true,
      role = decorative ? "none" : "separator",
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      role={role}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-[color:var(--theme-border)]",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = "Separator"
