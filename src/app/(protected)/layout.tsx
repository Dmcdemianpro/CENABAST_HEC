import { TopNav } from "@/components/layout/topnav";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/40 text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[2000px] items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            <span className="font-semibold tracking-tight">CENABAST • Control</span>
          </div>
          <div className="text-xs text-muted-foreground">Dashboard de gestión</div>
        </div>
        <div className="mx-auto w-full max-w-[2000px] px-6 pb-3">
          <TopNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[2000px] px-6 py-6">
        {children}
      </main>
    </div>
  );
}
