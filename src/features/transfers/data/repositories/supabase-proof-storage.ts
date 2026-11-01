import type { SupabaseServerClient } from "@/shared/infrastructure/supabase/server"
import { RepositoryError } from "@/shared/domain/result"
import { proofExtension } from "../../domain/services/proof"
import type { ProofFile, ProofStorage } from "../../domain/repositories/transfer-ports"

const BUCKET = "receipts"

/** Private bucket; objects live under the owner's folder so Storage RLS policies apply. */
export class SupabaseProofStorage implements ProofStorage {
  constructor(
    private readonly db: SupabaseServerClient,
    private readonly userId: string,
  ) {}

  async upload(file: ProofFile) {
    const path = `${this.userId}/${crypto.randomUUID()}.${proofExtension(file.contentType)}`
    const { error } = await this.db.storage.from(BUCKET).upload(path, file.bytes, { contentType: file.contentType, upsert: false })
    if (error) {
      console.error("[storage]", error.message)
      throw new RepositoryError("unexpected", "Couldn't upload the image. Please try again.")
    }
    return path
  }

  async signedUrl(path: string, seconds = 120) {
    if (!this.owns(path)) return null
    const { data, error } = await this.db.storage.from(BUCKET).createSignedUrl(path, seconds)
    return error || !data ? null : data.signedUrl
  }

  async remove(path: string) {
    if (!this.owns(path)) return
    await this.db.storage.from(BUCKET).remove([path])
  }

  /** Defence in depth on top of Storage RLS: only ever touch this user's own folder. */
  private owns(path: string) {
    return path.startsWith(`${this.userId}/`) && !path.includes("..")
  }
}
