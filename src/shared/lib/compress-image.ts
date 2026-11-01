/**
 * Shrinks a photo/screenshot in the browser before upload: longest side ≤ maxSide, JPEG at `quality`.
 * Typical phone photos drop from several MB to a few hundred KB, which keeps uploads fast on mobile
 * data and well under hosting request-size limits. Falls back to the original file if decoding fails.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.fillStyle = "#ffffff" // flatten transparency for JPEG
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    // Never make a small file bigger.
    if (!blob || (blob.size >= file.size && scale === 1)) return file
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })
  } catch {
    return file
  }
}
