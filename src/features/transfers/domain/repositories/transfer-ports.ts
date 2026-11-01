import type { Payee } from "../entities/payee"

export interface PayeeRepository {
  /** Newest first. */
  list(): Promise<Payee[]>
  getById(id: string): Promise<Payee | null>
  /** Case-insensitive exact name match. */
  findByName(name: string): Promise<Payee | null>
  create(name: string): Promise<Payee>
  update(id: string, patch: { name?: string; isArchived?: boolean }): Promise<Payee | null>
}

export interface ProofFile {
  bytes: ArrayBuffer
  contentType: string
  size: number
}

/** Private storage for proof images (screenshots / receipts). Paths are `<userId>/<random>.<ext>`. */
export interface ProofStorage {
  upload(file: ProofFile): Promise<string>
  /** Short-lived URL for viewing a private proof. Returns null when the object doesn't exist. */
  signedUrl(path: string, seconds?: number): Promise<string | null>
  remove(path: string): Promise<void>
}
