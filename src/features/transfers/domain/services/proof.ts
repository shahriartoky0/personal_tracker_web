/** Hosting platforms cap request bodies (~4.5 MB on Vercel), so proofs are compressed client-side and capped here. */
export const MAX_PROOF_BYTES = 4 * 1024 * 1024
export const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export function validateProof(file: { size: number; contentType: string }): string | null {
  if (!(ALLOWED_PROOF_TYPES as readonly string[]).includes(file.contentType)) return "Upload a JPG, PNG or WebP image."
  if (file.size <= 0) return "That file is empty."
  if (file.size > MAX_PROOF_BYTES) return "The image is too large (max 4 MB)."
  return null
}

export function proofExtension(contentType: string): string {
  return contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg"
}
