"use client"

import { cn } from "@/lib/utils"

interface Option<T extends string> {
  value: T
  label: string
}

/** Accessible two/three-way toggle (radio group semantics) with 44px touch targets. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: Option<T>[]
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-1 rounded-lg bg-muted p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "tap rounded-md px-3 text-sm font-medium transition-colors",
            value === o.value ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
