"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icons } from "./icons";

const navigation = [
  { href: "/", label: "Overview", icon: Icons.dashboard },
  { href: "/students", label: "Students", icon: Icons.students },
  { href: "/courses", label: "Courses", icon: Icons.courses },
  { href: "/videos", label: "Video library", icon: Icons.video },
  { href: "/live-classes", label: "Live Classes", icon: Icons.video },
  { href: "/orders", label: "Orders", icon: Icons.orders },
  { href: "/coupons", label: "Coupons", icon: Icons.coupon },
  { href: "/reviews", label: "Reviews", icon: Icons.reviews },
  { href: "/support", label: "Support queries", icon: Icons.email },
];
const manage = [
  { href: "/content", label: "Website content", icon: Icons.content },
  { href: "/email", label: "Global templates", icon: Icons.email },
  { href: "/settings", label: "Settings", icon: Icons.settings },
];

type Profile = { firstName: string; lastName: string; role: string; jobTitle: string };
type Branding = { appName: string; logoUrl: string };

export function Sidebar() {
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
    });
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

  const links = (items: typeof navigation) => items.map(({ href, label, icon: Icon }) => <Link className={pathname === href ? "active" : ""} href={href} key={href}><Icon /><span>{label}</span>{pathname === href && <i />}</Link>);
  const initials = `${profile.firstName[0] ?? "A"}${profile.lastName[0] ?? ""}`.toUpperCase();
  return <aside className="sidebar"><Link className="admin-brand" href="/">{branding.logoUrl ? <img className="admin-logo-image" src={branding.logoUrl} alt={`${branding.appName} logo`} /> : <span className="admin-mark"><i/><i/><i/></span>}<div><strong>{branding.appName}</strong><small>Admin console</small></div></Link><nav><p>Workspace</p>{links(navigation)}<p>Manage</p>{links(manage)}</nav><div className="sidebar-help"><span>?</span><strong>Need help?</strong><p>Read the launch guide or contact support.</p><button type="button">Open help centre</button></div><div className="profile" ref={menuRef}><span>{initials}</span><div><strong>{profile.firstName} {profile.lastName}</strong><small>{profile.role}</small></div><button type="button" aria-label="Open profile menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>•••</button>{menuOpen && <div className="profile-menu"><Link href="/settings?tab=profile" onClick={() => setMenuOpen(false)}>Edit profile</Link><button type="button" onClick={signOut}>Sign out</button></div>}</div></aside>;
}
