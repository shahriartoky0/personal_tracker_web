"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { notifySuccess } from "@/components/layout/success-dialog"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportTransactionsAction } from "../actions"

export interface ExportFilters {
  from?: string
  to?: string
  categoryId?: string
  accountId?: string
  plannedStatus?: "planned" | "unplanned"
  type?: "income" | "expense" | "transfer" | "person_transfer"
  payeeId?: string
  search?: string
}

export function ExportButton({ filters, filename, label = "Export CSV" }: { filters: ExportFilters; filename: string; label?: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      className="tap"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await exportTransactionsAction(filters)
          if (!res.ok || !res.data) return void toast.error(res.ok ? "Nothing to export" : res.message)
          // BOM so Excel opens the UTF-8 file (including ৳ and Bangla text) correctly.
          const blob = new Blob(["﻿", res.data.csv], { type: "text/csv;charset=utf-8" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = filename
          a.click()
          URL.revokeObjectURL(url)
          notifySuccess("Exported")
        })
      }
    >
      <Download aria-hidden /> {pending ? "Preparing…" : label}
    </Button>
  )
}
