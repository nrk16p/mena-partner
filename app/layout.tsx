import "./globals.css"
import { Inter, JetBrains_Mono, Noto_Sans_Thai } from "next/font/google"
import { Providers } from "@/components/providers"
import { AppShell } from "@/components/app-shell"

// Octo Code design system (docs/DESIGN.md): Inter for UI, JetBrains Mono for
// code/IDs; Noto Sans Thai renders Thai text (Inter has no Thai glyphs)
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
})
const notoThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-thai",
  display: "swap",
})
const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jbmono",
  display: "swap",
})

export const metadata = { title: "Mena Partner Driver", description: "ระบบเงินเดือนรถร่วม Mixer" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning className={`${inter.variable} ${notoThai.variable} ${jbMono.variable}`}>
      {/* Dark-mode-first (Octo Code): dark unless the user explicitly chose light */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("theme")!=="light")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}` }} />
      </head>
      <body className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
