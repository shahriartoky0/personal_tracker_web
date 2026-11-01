"use client"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface SelectOption {
  value: string
  label: string
}

/** Radix requires non-empty item values, so "" (e.g. "All categories") is mapped to a sentinel. */
const EMPTY = "__empty__"

/**
 * Themed dropdown used everywhere instead of native <select>: consistent look, large touch rows,
 * keyboard + screen-reader support. `value=""` selects the option whose value is "".
 */
export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  label,
  disabled,
  className,
  invalid,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  /** Accessible name when there is no visible <label htmlFor>. */
  label?: string
  disabled?: boolean
  className?: string
  invalid?: boolean
}) {
  const hasEmpty = options.some((o) => o.value === "")
  const current = value === "" ? (hasEmpty ? EMPTY : undefined) : value
  return (
    <Select value={current} onValueChange={(v) => onChange(v === EMPTY ? "" : v)} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={cn("tap w-full justify-between bg-background text-sm data-[size=default]:h-11", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={4} className="max-h-72 min-w-[var(--radix-select-trigger-width)]">
        {options.map((o) => (
          <SelectItem key={o.value || EMPTY} value={o.value || EMPTY} className="min-h-10 cursor-pointer py-2 text-sm">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
