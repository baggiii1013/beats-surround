import * as React from "react"
import { cn } from "../../lib/utils"

const Badge = React.forwardRef(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "border-transparent bg-gradient-primary text-white shadow-lg",
    secondary: "border-transparent bg-gradient-secondary text-white shadow-lg",
    destructive: "border-transparent bg-destructive text-destructive-foreground shadow-lg",
    outline: "text-foreground border-border glass hover:glass-strong transition-all duration-200",
    accent: "border-transparent bg-gradient-accent text-accent-foreground shadow-lg",
    success: "border-transparent bg-success text-success-foreground shadow-lg",
    warning: "border-transparent bg-warning text-warning-foreground shadow-lg",
    glow: "border-primary/30 glass text-primary shadow-xl animate-pulse-glow",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 backdrop-blur-sm",
        variants[variant],
        className
      )}
      {...props}
    />
  )
})
Badge.displayName = "Badge"

export { Badge }
