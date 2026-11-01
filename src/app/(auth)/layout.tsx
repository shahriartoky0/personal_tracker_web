import Link from "next/link"
import { Wallet } from "lucide-react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-6 px-4 py-10">
      <Link href="/" className="mx-auto flex items-center gap-2">
        <span aria-hidden className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><Wallet className="size-5" /></span>
        <span className="text-section">Taka Tracker</span>
      </Link>
      <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-7">{children}</div>
      <p className="text-center text-caption text-muted-foreground">
        Want to look around first? <Link href="/demo" className="underline underline-offset-4">Try the demo</Link> — it uses sample data, not yours.
      </p>
    </main>
  )
}
