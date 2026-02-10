import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio"

import { cn } from "@/shared/ui/shadcn/cn"

export const AspectRatio = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AspectRatioPrimitive.Root>) => (
  <AspectRatioPrimitive.Root className={cn(className)} {...props} />
)

