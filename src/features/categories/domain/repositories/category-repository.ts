import type { Category, NewCategory } from "../entities/category"

export interface CategoryRepository {
  list(): Promise<Category[]>
  getById(id: string): Promise<Category | null>
  create(input: NewCategory): Promise<Category>
  update(id: string, patch: Partial<NewCategory> & { isArchived?: boolean }): Promise<Category | null>
}
