"use client"

import { Button } from "@/components/ui/button"

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center">
      <h1 className="text-title">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">We couldn&apos;t load this page. Your data is safe — please try again.</p>
      <Button onClick={reset} className="tap">Try again</Button>
    </div>
  )
}
