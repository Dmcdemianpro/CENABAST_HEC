"use client";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex w-full flex-col">
        <Topbar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
