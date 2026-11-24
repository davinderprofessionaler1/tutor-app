"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "./icons";
import { adminNavigation } from "./sidebar";

export function WorkspaceHeader({ onMenu }: { onMenu: () => void }) {
  const [profile, setProfile] = useState({ firstName: "Admin", lastName: "", role: "Administrator" });
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null), search = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pages = adminNavigation.flatMap((group) => group.items).filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    fetch("/api/admin/profile").then(async (response) => { if (response.ok) setProfile((await response.json()).profile); }).catch(() => undefined);
    const update = () => fetch("/api/admin/security-events").then(async (response) => {
      if (response.ok) setUnread((await response.json()).data.filter((event: { read: boolean }) => !event.read).length);
    }).catch(() => undefined);
    void update();
    const timer = window.setInterval(update, 15000);
    const onProfile = (event: Event) => setProfile((event as CustomEvent<typeof profile>).detail);
    const keyboard = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); setOpen(true); } if (event.key === "Escape") setOpen(false); };
    const outside = (event: MouseEvent) => { if (!search.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("admin-profile-updated", onProfile);
    window.addEventListener("admin-security-updated", update);
    document.addEventListener("keydown", keyboard); document.addEventListener("mousedown", outside);
    return () => { window.clearInterval(timer); window.removeEventListener("admin-profile-updated", onProfile); window.removeEventListener("admin-security-updated", update); document.removeEventListener("keydown", keyboard); document.removeEventListener("mousedown", outside); };
  }, []);
  function navigate(href: string) { setOpen(false); setQuery(""); input.current?.blur(); router.push(href); }
  return <div className="workspace-header">
    <button className="mobile-menu-button icon-button" type="button" aria-label="Toggle navigation" onClick={onMenu}>☰</button>
    <div className="workspace-search" ref={search}>
      <Icons.search /><input ref={input} aria-label="Find an admin page" role="combobox" aria-expanded={open} aria-controls="workspace-results" placeholder="Find a page, course workspace or live classes…" value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === "Enter" && pages[0]) navigate(pages[0].href); }} /><kbd>⌘ K</kbd>
      {open && <div className="workspace-search-results" id="workspace-results" role="listbox" aria-label="Admin pages"><small>GO TO WORKSPACE</small>{pages.map(({ href, label, icon: Icon }) => <button key={href} type="button" role="option" aria-selected={false} onClick={() => navigate(href)}><Icon /><span>{label}</span><Icons.chevron /></button>)}{!pages.length && <p>No matching pages. Try “Students” or “Courses”.</p>}</div>}
    </div>
    <div className="workspace-header-actions"><Link className="primary-action" href="/live-classes?new=1" onClick={(event) => { if (window.location.pathname === "/live-classes") { event.preventDefault(); window.dispatchEvent(new Event("admin-create-live-class")); } }}><Icons.plus /> <span>Schedule Class</span></Link><a className="icon-button header-bell" href="/#security-alerts" aria-label={`${unread} unread security alerts`}><Icons.bell />{unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}</a><Link className="header-profile" href="/settings?tab=profile"><span>{`${profile.firstName[0] ?? "A"}${profile.lastName[0] ?? ""}`}</span><div><strong>{profile.firstName} {profile.lastName}</strong><small>{profile.role}</small></div></Link></div>
  </div>;
}
