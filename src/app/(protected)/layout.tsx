import { TopNav } from "@/components/layout/topnav";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/40 text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            <span className="font-semibold tracking-tight">CENABAST • Control</span>
          </div>
          <div className="text-xs text-muted-foreground">Dashboard de gestión</div>
        </div>
        <div className="mx-auto max-w-[1400px] px-4 pb-3">
          <TopNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6">
        {children}
      </main>
    </div>
  );
}
