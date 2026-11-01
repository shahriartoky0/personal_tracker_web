"use client"

import { useEffect, useRef, useState, type MutableRefObject } from "react"
import { ImagePlus, Loader2, Paperclip, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { compressImage } from "@/shared/lib/compress-image"
import { MAX_PROOF_BYTES } from "../../domain/services/proof"
import { removeProofAction, uploadProofAction } from "../actions"
import { ProofButton } from "./proof-viewer"

/**
 * Optional proof image (payment screenshot, receipt photo). The image is compressed in the browser,
 * uploaded to private storage immediately, and only the storage path is saved with the transfer.
 * Images uploaded in this session but never saved are deleted again (replace / remove / close).
 */
export function ProofUpload({
  value,
  onChange,
  savedRef,
}: {
  value: string | null
  onChange: (path: string | null) => void
  /** Parent sets `.current = true` once the transfer is saved, so uploads are kept. */
  savedRef: MutableRefObject<boolean>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const session = useRef(new Set<string>())

  useEffect(() => {
    const uploaded = session.current
    return () => {
      // Read at cleanup time on purpose: we need the latest value, not the one from render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (!savedRef.current) for (const p of uploaded) void removeProofAction({ path: p })
    }
  }, [savedRef])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const discardIfFresh = (path: string | null) => {
    if (path && session.current.has(path)) {
      session.current.delete(path)
      void removeProofAction({ path })
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!file.type.startsWith("image/")) return setError("Please choose an image (JPG, PNG or WebP).")
    setBusy(true)
    try {
      const small = await compressImage(file)
      if (small.size > MAX_PROOF_BYTES) return setError("That image is too large even after compressing. Try a smaller one.")
      const fd = new FormData()
      fd.append("file", small)
      const res = await uploadProofAction(fd)
      if (!res.ok || !res.data) return setError(res.ok ? "Upload failed." : (res.fieldErrors?.proof ?? res.message))
      discardIfFresh(value)
      session.current.add(res.data.path)
      setPreview(URL.createObjectURL(small))
      onChange(res.data.path)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Proof image"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {!value ? (
        <Button type="button" variant="outline" className="tap h-auto justify-start gap-3 border-dashed py-3" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
          <span className="flex flex-col items-start text-left">
            <span className="text-sm font-medium">{busy ? "Uploading…" : "Add proof (optional)"}</span>
            <span className="text-caption text-muted-foreground">Payment screenshot or receipt photo</span>
          </span>
        </Button>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Proof preview" className="size-14 rounded-md object-cover" />
          ) : (
            <span className="grid size-14 place-items-center rounded-md bg-muted"><Paperclip className="size-5" aria-hidden /></span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Proof attached</p>
            {!preview && <ProofButton path={value} variant="link" />}
          </div>
          <Button type="button" variant="ghost" size="icon" className="tap" disabled={busy} aria-label="Replace proof" onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="tap"
            disabled={busy}
            aria-label="Remove proof"
            onClick={() => {
              discardIfFresh(value)
              setPreview(null)
              onChange(null)
            }}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-caption text-destructive">{error}</p>}
    </div>
  )
}
