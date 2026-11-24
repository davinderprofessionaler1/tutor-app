"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { WorkspaceHeader } from "./workspace-header";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  if (pathname === "/login") return <main className="auth-page">{children}</main>;
  return <div className={`admin-shell academic-admin ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "mobile-nav-open" : ""}`}>
    <a className="skip-link" href="#admin-content">Skip to content</a>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <Sidebar collapsed={collapsed} onToggle={() => { if (window.matchMedia("(max-width: 760px)").matches) setMobileOpen(false); else setCollapsed((value) => !value); }} />
    <main className="admin-main" id="admin-content"><WorkspaceHeader onMenu={() => setMobileOpen((value) => !value)} />{children}</main>
  </div>;
}
