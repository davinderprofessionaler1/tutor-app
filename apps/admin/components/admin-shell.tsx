"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <main className="auth-page">{children}</main>;
  return <div className="admin-shell"><Sidebar /><main className="admin-main">{children}</main></div>;
}
