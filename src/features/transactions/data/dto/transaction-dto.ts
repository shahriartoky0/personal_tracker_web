export interface TransactionRow {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  type: string
  transfer_direction: string | null
  transfer_group_id: string | null
  payee_id: string | null
  amount: number
  occurred_at: string
  merchant: string | null
  note: string | null
  planned_status: string
  receipt_path: string | null
}
