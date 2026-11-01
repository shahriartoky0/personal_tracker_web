import { notFound, ok, validation, type Result } from "@/shared/domain/result"
import { isCategoryType, type Category, type CategoryType, type NewCategory } from "../entities/category"
import type { CategoryRepository } from "../repositories/category-repository"

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

function validate(input: Partial<NewCategory>): Record<string, string> {
  const errors: Record<string, string> = {}
  if (input.name !== undefined) {
    const n = input.name.trim()
    if (n.length < 1 || n.length > 60) errors.name = "Name must be 1–60 characters."
  }
  if (input.type !== undefined && !isCategoryType(input.type)) errors.type = "Choose income or expense."
  if (input.color && !COLOR_RE.test(input.color)) errors.color = "Use a hex colour like #0f766e."
  return errors
}

export class ListCategories {
  constructor(private readonly categories: CategoryRepository) {}
  async execute(opts: { type?: CategoryType; includeArchived?: boolean } = {}): Promise<Category[]> {
    const all = await this.categories.list()
    return all.filter(
      (c) => (opts.includeArchived || !c.isArchived) && (!opts.type || c.type === opts.type),
    )
  }
}

export class CreateCategory {
  constructor(private readonly categories: CategoryRepository) {}
  async execute(input: NewCategory): Promise<Result<Category>> {
    const errors = validate(input)
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)
    const existing = await this.categories.list()
    const name = input.name.trim()
    if (existing.some((c) => !c.isArchived && c.type === input.type && c.name.toLowerCase() === name.toLowerCase()))
      return validation("A category with this name already exists.", { name: "Already exists." })
    return ok(await this.categories.create({ ...input, name }))
  }
}

/** Archiving keeps historical transactions intact; categories are never hard-deleted. */
export class UpdateCategory {
  constructor(private readonly categories: CategoryRepository) {}
  async execute(id: string, patch: Partial<NewCategory> & { isArchived?: boolean }): Promise<Result<Category>> {
    const errors = validate(patch)
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)
    if (!(await this.categories.getById(id))) return notFound("Category")
    const updated = await this.categories.update(id, { ...patch, name: patch.name?.trim() })
    return updated ? ok(updated) : notFound("Category")
  }
}
