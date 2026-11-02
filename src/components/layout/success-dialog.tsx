"use client"

import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

const AUTO_CLOSE_MS = 1600
type Listener = (message: string) => void
const listeners = new Set<Listener>()

/** Show a centered success dialog that closes by itself. Safe to call from any client code. */
export function notifySuccess(message: string) {
  listeners.forEach((l) => l(message))
}

export function SuccessDialog() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const l: Listener = (m) => setMessage(m)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), AUTO_CLOSE_MS)
    return () => clearTimeout(t)
  }, [message])

  return (
    <Dialog open={message !== null} onOpenChange={(o) => !o && setMessage(null)}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] max-w-sm items-center justify-items-center text-center"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <CheckCircle2 className="size-12 text-emerald-500" aria-hidden />
        <DialogTitle className="text-center leading-snug">{message ?? ""}</DialogTitle>
        <DialogDescription className="sr-only">Action completed</DialogDescription>
      </DialogContent>
    </Dialog>
  )
}
