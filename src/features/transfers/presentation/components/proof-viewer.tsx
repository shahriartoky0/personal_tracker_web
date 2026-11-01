"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ExternalLink, Loader2, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getProofUrlAction } from "../actions"

/** Fetches a short-lived signed URL on demand (proofs are private) and shows the image in a dialog. */
export function ProofButton({ path, variant = "ghost", label = "Proof" }: { path: string; variant?: "ghost" | "link"; label?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className="tap gap-1.5 px-2"
        disabled={pending}
        aria-label="View proof image"
        onClick={() =>
          start(async () => {
            const res = await getProofUrlAction({ path })
            if (!res.ok || !res.data) return void toast.error(res.ok ? "Couldn't load the proof." : res.message)
            setUrl(res.data.url)
            setOpen(true)
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Paperclip className="size-4" aria-hidden />}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Proof</DialogTitle>
            <DialogDescription>Private image — the link expires in a couple of minutes.</DialogDescription>
          </DialogHeader>
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Transfer proof" className="max-h-[70dvh] w-full rounded-md border object-contain" />
          )}
          {url && (
            <Button asChild variant="outline" className="tap w-fit">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden /> Open full size
              </a>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
