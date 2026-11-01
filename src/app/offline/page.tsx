export const metadata = { title: "Offline" }

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-title">You&apos;re offline</h1>
      <p className="text-muted-foreground">
        Taka Tracker needs a connection to load your latest transactions. Reconnect and try again — nothing you saved has been lost.
      </p>
    </main>
  )
}
