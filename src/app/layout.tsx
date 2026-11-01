import type { Metadata, Viewport } from "next"
import { Inter, Noto_Sans_Bengali } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ServiceWorkerRegister } from "@/components/layout/sw-register"
import "./globals.css"

// Only the weights actually used. Inter for Latin; Noto Sans Bengali is the fallback for Bangla glyphs.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" })
const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: "Taka Tracker", template: "%s · Taka Tracker" },
  description: "Plan your day's spending, record every taka, and see exactly where your money went.",
  applicationName: "Taka Tracker",
  appleWebApp: { capable: true, title: "Taka Tracker", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#14171f" },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${bengali.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
          <Toaster position="top-center" richColors closeButton />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
