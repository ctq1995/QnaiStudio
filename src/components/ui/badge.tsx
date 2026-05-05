import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:size-3 transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-border-default bg-background-surface text-text-secondary",
        secondary:
          "border-border-default bg-background-hover text-text-primary",
        success:
          "border-emerald-700/30 bg-emerald-700/10 text-emerald-600",
        warning:
          "border-amber-600/30 bg-amber-600/10 text-amber-600",
        destructive:
          "border-danger/30 bg-danger/10 text-danger",
        outline:
          "border-border-default text-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
