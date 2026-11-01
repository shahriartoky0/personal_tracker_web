export type CategoryType = "income" | "expense"

export interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  type: CategoryType
  isDefault: boolean
  isArchived: boolean
}

export interface NewCategory {
  name: string
  type: CategoryType
  icon?: string | null
  color?: string | null
}

export function isCategoryType(value: string): value is CategoryType {
  return value === "income" || value === "expense"
}
