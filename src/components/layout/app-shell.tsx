"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeftRight, BarChart3, CalendarCheck, LayoutDashboard, List, Plus, Settings, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AppProvider, type AppData } from "@/components/layout/app-context"
import { QuickAddProvider, useQuickAdd } from "@/features/transactions/presentation/components/quick-add"

const NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/plan", label: "Plan", icon: CalendarCheck },
  { href: "/transactions", label: "History", icon: List },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`)
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md px-2 py-1 focus-visible:outline-2">
      <span aria-hidden className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
        <Wallet className="size-4" />
      </span>
      <span className="text-section">Taka Tracker</span>
    </Link>
  )
}

function Shell({ children, demo }: { children: React.ReactNode; demo?: boolean }) {
  const path = usePathname()
  const { openExpense, openIncome, openPersonTransfer } = useQuickAdd()
  const nav = demo ? NAV.slice(0, 1) : NAV

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Brand />
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(path, href) ? "page" : undefined}
              className={cn(
                "tap flex items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive(path, href) && "bg-accent text-accent-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        {!demo && (
          <div className="mt-auto flex flex-col gap-2">
            <Button size="lg" onClick={openExpense} className="tap w-full">
              <Plus aria-hidden /> Add Expense
            </Button>
            <Button size="lg" variant="outline" onClick={openIncome} className="tap w-full">
              Add Income
            </Button>
            <Button size="lg" variant="ghost" onClick={openPersonTransfer} className="tap w-full">
              <ArrowLeftRight aria-hidden /> Send / receive money
            </Button>
          </div>
        )}
      </aside>

      <div className="min-w-0">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
          <Brand />
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile: primary action + bottom navigation */}
      {!demo && (
        <Button
          onClick={openExpense}
          size="lg"
          aria-label="Add expense"
          className="fixed right-4 z-40 h-14 rounded-full px-5 shadow-lg lg:hidden"
          style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
        >
          <Plus aria-hidden className="size-5" /> Add Expense
        </Button>
      )}
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 grid border-t bg-background/95 pt-1 backdrop-blur lg:hidden"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(path, href) ? "page" : undefined}
            className={cn(
              "tap flex flex-col items-center justify-center gap-0.5 rounded-md px-0.5 text-[0.6875rem] font-medium text-muted-foreground",
              isActive(path, href) && "text-primary",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function AppShell({ data, children }: { data: AppData; children: React.ReactNode }) {
  return (
    <AppProvider data={data}>
      <QuickAddProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-2">
          Skip to content
        </a>
        <Shell demo={data.demo}>{children}</Shell>
      </QuickAddProvider>
    </AppProvider>
  )
}
