import type { CategoryRepository } from "../../domain/repositories/category-repository"
import type { NewCategory } from "../../domain/entities/category"
import type { CategoryDatasource } from "../datasources/category-datasource"
import { toCategory } from "../mappers/category-mapper"

export class SupabaseCategoryRepository implements CategoryRepository {
  constructor(
    private readonly ds: CategoryDatasource,
    private readonly userId: string,
  ) {}
  async list() {
    return (await this.ds.list()).map(toCategory)
  }
  async getById(id: string) {
    const row = await this.ds.get(id)
    return row ? toCategory(row) : null
  }
  async create(input: NewCategory) {
    return toCategory(
      await this.ds.insert({
        user_id: this.userId,
        name: input.name,
        type: input.type,
        icon: input.icon ?? null,
        color: input.color ?? null,
      }),
    )
  }
  async update(id: string, patch: Partial<NewCategory> & { isArchived?: boolean }) {
    const row = await this.ds.update(id, {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.icon !== undefined && { icon: patch.icon }),
      ...(patch.color !== undefined && { color: patch.color }),
      ...(patch.isArchived !== undefined && { is_archived: patch.isArchived }),
    })
    return row ? toCategory(row) : null
  }
}
