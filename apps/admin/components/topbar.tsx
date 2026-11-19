import { Icons } from "./icons";

export function Topbar({ title, subtitle, action, notificationCount = 0 }: { title: string; subtitle: string; action?: React.ReactNode; notificationCount?: number }) {
  return <header className="topbar"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="topbar-actions"><label><Icons.search/><span className="sr-only">Search</span><input placeholder="Search anything" /></label><a className="icon-button" aria-label={`${notificationCount} unread security alerts`} href="/#security-alerts"><Icons.bell/>{notificationCount > 0 && <><i/><b>{notificationCount > 99 ? "99+" : notificationCount}</b></>}</a>{action}</div></header>;
}
