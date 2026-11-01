import { toDecimalString } from "@/shared/domain/money"
import { localDateOf } from "@/shared/domain/dates"
import type { Transaction } from "../entities/transaction"

export interface CsvLookups {
  accountName(id: string): string
  categoryName(id: string | null): string
  payeeName(id: string | null): string
  timezone: string
}

const HEADER = ["Date", "Time", "Type", "Amount", "Category", "Account", "Planned", "Person", "Merchant", "Note", "Transfer group"]

/** Free-text columns (category, account, merchant, note) — the amount column legitimately starts with "-". */
const TEXT_COLUMNS = new Set([4, 5, 7, 8, 9])

/** Guards against CSV/formula injection when opened in spreadsheet apps, then RFC-4180 quotes. */
function cell(value: string, isText = false): string {
  let v = value
  if (isText && /^[=+\-@\t\r]/.test(v)) v = `'${v}`
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function timeOf(instant: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(instant),
  )
}

export function transactionsToCsv(txs: readonly Transaction[], lookups: CsvLookups): string {
  const rows = txs.map((t) => {
    const signed =
      t.type === "expense" || ((t.type === "transfer" || t.type === "person_transfer") && t.transferDirection === "out") ? -t.amount : t.amount
    const typeLabel =
      t.type === "transfer" ? `transfer_${t.transferDirection ?? ""}` : t.type === "person_transfer" ? `person_${t.transferDirection ?? ""}` : t.type
    return [
      localDateOf(t.occurredAt, lookups.timezone),
      timeOf(t.occurredAt, lookups.timezone),
      typeLabel,
      toDecimalString(signed),
      t.type === "transfer" || t.type === "person_transfer" ? "" : lookups.categoryName(t.categoryId),
      lookups.accountName(t.accountId),
      t.type === "expense" ? t.plannedStatus : "",
      lookups.payeeName(t.payeeId),
      t.merchant ?? "",
      t.note ?? "",
      t.transferGroupId ?? "",
    ].map((v, i) => cell(v, TEXT_COLUMNS.has(i)))
  })
  return [HEADER.map((h) => cell(h)), ...rows].map((r) => r.join(",")).join("\r\n") + "\r\n"
}
