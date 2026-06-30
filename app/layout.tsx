import "./globals.css"
import { Providers } from "@/components/providers"
import { AppShell } from "@/components/app-shell"

export const metadata = { title: "Mena Partner Driver", description: "ระบบเงินเดือนรถร่วม Mixer" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
