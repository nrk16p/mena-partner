import { AppShell } from "@/components/app-shell"

/** Shell ของระบบภายใน — sidebar + navbar + จอไม่เลื่อน (หน้าใน main scroll เอง) */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppShell>{children}</AppShell>
    </div>
  )
}
