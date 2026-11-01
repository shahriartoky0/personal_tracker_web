export interface AllocationRow {
  id: string
  daily_budget_id: string
  category_id: string
  planned_amount: number
  original_amount: number
}

export interface DailyBudgetRow {
  id: string
  user_id: string
  budget_date: string
  total_limit: number
  original_limit: number
  notes: string | null
  is_closed: boolean
  budget_allocations?: AllocationRow[]
}

export interface TemplateRow {
  total_limit: number
  allocations: { categoryId: string; amount: number }[]
}

export interface PlannedExpenseRow {
  id: string
  planned_date: string
  category_id: string
  title: string
  expected_amount: number
  status: string
}
