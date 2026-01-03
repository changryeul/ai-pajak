import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Base variants
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        warning:
          "border-transparent bg-orange-500 text-white hover:bg-orange-500/80",
        outline: "text-foreground",

        // Stage variants (Workflow stages)
        uploaded:
          "border-transparent bg-stage-uploaded text-stage-uploaded-foreground",
        aiAnalyzed:
          "border-transparent bg-stage-ai-analyzed text-stage-ai-analyzed-foreground",
        humanReview:
          "border-transparent bg-stage-human-review text-stage-human-review-foreground",
        approved:
          "border-transparent bg-stage-approved text-stage-approved-foreground",
        filed:
          "border-transparent bg-stage-filed text-stage-filed-foreground",

        // Tax type variants
        pph21:
          "border-transparent bg-tax-pph21 text-tax-pph21-foreground",
        pph23:
          "border-transparent bg-tax-pph23 text-tax-pph23-foreground",
        ppn:
          "border-transparent bg-tax-ppn text-tax-ppn-foreground",
        annual:
          "border-transparent bg-tax-annual text-tax-annual-foreground",

        // OCR Confidence variants
        confidenceHigh:
          "border-transparent bg-confidence-high text-confidence-high-foreground",
        confidenceMedium:
          "border-transparent bg-confidence-medium text-confidence-medium-foreground",
        confidenceLow:
          "border-transparent bg-confidence-low text-confidence-low-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
