export interface CategoryRow {
  id: string
  user_id: string
  name: string
  icon: string | null
  color: string | null
  type: string
  is_default: boolean
  is_archived: boolean
}
