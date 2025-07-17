import * as React from "react"
import { cn } from "../../lib/utils"

const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const variants = {
    default: "bg-gradient-primary text-white hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-200 border-0",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg hover:shadow-xl",
    outline: "border border-input-border bg-transparent hover:bg-card-hover hover:text-accent-foreground glass transition-all duration-200",
    secondary: "bg-gradient-secondary text-secondary-foreground hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-200",
    ghost: "hover:bg-card-hover hover:text-accent-foreground transition-all duration-200",
    link: "text-primary underline-offset-4 hover:underline hover:text-primary-hover transition-colors",
    accent: "bg-gradient-accent text-accent-foreground hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-200",
    glass: "glass text-white hover:glass-strong transition-all duration-200",
  }

  const sizes = {
    default: "h-11 px-6 py-2 text-sm font-medium",
    sm: "h-9 rounded-lg px-4 text-sm",
    lg: "h-12 rounded-xl px-8 text-base font-semibold",
    icon: "h-11 w-11",
    "icon-sm": "h-9 w-9",
    "icon-lg": "h-12 w-12",
  }

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
