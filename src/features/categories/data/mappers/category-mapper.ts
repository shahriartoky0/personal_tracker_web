import type { Category } from "../../domain/entities/category"
import type { CategoryRow } from "../dto/category-dto"

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    type: row.type === "income" ? "income" : "expense",
    isDefault: row.is_default,
    isArchived: row.is_archived,
  }
}
