"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icons } from "./icons";

export const adminNavigation = [
  { label: "Workspace", items: [
    { href: "/", label: "Overview", icon: Icons.dashboard },
    { href: "/students", label: "Students", icon: Icons.students },
    { href: "/courses", label: "Courses", icon: Icons.courses },
    { href: "/videos", label: "Video Library", icon: Icons.video },
    { href: "/live-classes", label: "Live Classes", icon: Icons.video },
  ]},
  { label: "Business", items: [
    { href: "/orders", label: "Orders", icon: Icons.orders },
    { href: "/coupons", label: "Coupons", icon: Icons.coupon },
  ]},
  { label: "Engagement", items: [
    { href: "/reviews", label: "Reviews", icon: Icons.reviews },
    { href: "/support", label: "Support Queries", icon: Icons.email },
  ]},
  { label: "Administration", items: [
    { href: "/content", label: "Website Content", icon: Icons.content },
    { href: "/email", label: "Global Templates", icon: Icons.email },
    { href: "/settings", label: "Settings", icon: Icons.settings },
  ]},
];

type Profile = { firstName: string; lastName: string; role: string; jobTitle: string };
type Branding = { appName: string; logoUrl: string };

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>({ firstName: "Admin", lastName: "", role: "Administrator", jobTitle: "" });
  const [branding, setBranding] = useState<Branding>({ appName: "Northstar", logoUrl: "" });

  useEffect(() => {
    Promise.all([fetch("/api/admin/profile"), fetch("/api/admin/settings")]).then(async ([profileResponse, settingsResponse]) => {
      if (profileResponse.status === 401 || settingsResponse.status === 401) { router.replace("/login"); return; }
      if (profileResponse.ok) setProfile((await profileResponse.json()).profile);
      if (settingsResponse.ok) {
        const settings = (await settingsResponse.json()).settings;
        setBranding({ appName: settings.appName || "Northstar", logoUrl: settings.logoUrl || "" });
      }
    }).catch(() => undefined);
    const updateProfile = (event: Event) => setProfile((event as CustomEvent<Profile>).detail);
    const updateBranding = (event: Event) => {
      const settings = (event as CustomEvent<Branding>).detail;
      setBranding({ appName: settings.appName || "Northstar", logoUrl: settings.logoUrl || "" });
    };
    window.addEventListener("admin-profile-updated", updateProfile);
    window.addEventListener("admin-settings-updated", updateBranding);
    return () => {
      window.removeEventListener("admin-profile-updated", updateProfile);
      window.removeEventListener("admin-settings-updated", updateBranding);
    };
  }, [router]);

  useEffect(() => {
    function close(event: MouseEvent) { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const links = (items: typeof adminNavigation[number]["items"]) => items.map(({ href, label, icon: Icon }) => {
    const active = href === "/" ? pathname === href : pathname.startsWith(href);
    return <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} title={label} href={href} key={href}><Icon /><span>{label}</span></Link>;
  });
  const initials = `${profile.firstName[0] ?? "A"}${profile.lastName[0] ?? ""}`.toUpperCase();
  return <aside className="sidebar" aria-label="Admin navigation">
    <Link className="admin-brand" href="/" aria-label={`${branding.appName} home`}>
      {branding.logoUrl ? <img className="admin-logo-image" src={branding.logoUrl} alt="" /> : <span className="academic-brand-mark"><Icons.courses /></span>}
      <div><strong>{branding.appName}</strong><small>Learning administration</small></div>
    </Link>
    <nav>{adminNavigation.map((group) => <section key={group.label}><p>{group.label}</p>{links(group.items)}</section>)}</nav>
    <div className="sidebar-footer"><span><Icons.dashboard /> Admin workspace</span><button type="button" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onToggle}><Icons.chevron style={{ transform: collapsed ? undefined : "rotate(180deg)" }} /></button></div>
    <div className="profile" ref={menuRef}><span>{initials}</span><div><strong>{profile.firstName} {profile.lastName}</strong><small>{profile.role}</small></div><button type="button" aria-label="Open profile menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>•••</button>{menuOpen && <div className="profile-menu"><Link href="/settings?tab=profile" onClick={() => setMenuOpen(false)}>Edit profile</Link><button type="button" onClick={signOut}>Sign out</button></div>}</div>
  </aside>;
}
