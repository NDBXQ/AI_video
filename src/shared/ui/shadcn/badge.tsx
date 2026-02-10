import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/shared/ui/shadcn/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[color:rgba(109,94,247,0.22)] bg-[color:rgba(109,94,247,0.14)] text-[color:var(--theme-text-strong)]",
        secondary:
          "border-[color:var(--theme-border)] bg-[var(--theme-surface-3)] text-[color:var(--theme-text)]",
        destructive:
          "border-[color:rgba(248,113,113,0.24)] bg-[color:rgba(248,113,113,0.14)] text-[color:var(--theme-text-strong)]",
        outline: "border-[color:var(--theme-border)] bg-transparent text-[color:var(--theme-text)]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
)

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
)
Badge.displayName = "Badge"

export { badgeVariants }
