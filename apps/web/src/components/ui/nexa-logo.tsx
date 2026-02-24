import { cn } from "@/lib/utils"

const sizeClasses = {
  sm: "size-8 text-sm",
  md: "size-10 text-lg",
  lg: "size-12 text-xl",
} as const

function NexaLogo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <div
      data-slot="nexa-logo"
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-primary font-display font-extrabold text-white select-none",
        sizeClasses[size],
        className
      )}
      aria-hidden="true"
    >
      N
    </div>
  )
}

export { NexaLogo }
