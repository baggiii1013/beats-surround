import * as React from "react"
import { cn } from "../../lib/utils"

const Slider = React.forwardRef(({ className, value, onValueChange, onValueCommit, min = 0, max = 100, step = 1, ...props }, ref) => {
  const [localValue, setLocalValue] = React.useState(value || [0])
  const [isDragging, setIsDragging] = React.useState(false)

  React.useEffect(() => {
    if (!isDragging && value) {
      setLocalValue(value)
    }
  }, [value, isDragging])

  const handleMouseDown = (e) => {
    setIsDragging(true)
    handleSliderUpdate(e)
  }

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleSliderUpdate(e)
    }
  }

  const handleMouseUp = (e) => {
    if (isDragging) {
      setIsDragging(false)
      onValueCommit && onValueCommit(localValue)
    }
  }

  const handleSliderUpdate = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newValue = min + percentage * (max - min)
    const steppedValue = Math.round(newValue / step) * step
    const newValueArray = [steppedValue]
    
    setLocalValue(newValueArray)
    onValueChange && onValueChange(newValueArray)
  }

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  const percentage = ((localValue[0] - min) / (max - min)) * 100

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      onMouseDown={handleMouseDown}
      {...props}
    >
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <div
          className="absolute h-full bg-primary transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div
        className="absolute block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        style={{ left: `calc(${percentage}% - 10px)` }}
      />
    </div>
  )
})
Slider.displayName = "Slider"

export { Slider }
