export function Topbar({ title, subtitle, action, notificationCount = 0, eyebrow = "Workspace" }: { title: string; subtitle: string; action?: React.ReactNode; notificationCount?: number; eyebrow?: string }) {
  return <header className="topbar"><div><span className="page-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="topbar-actions">{notificationCount > 0 && <a className="alert-count" href="/#security-alerts">{notificationCount} unread alerts</a>}{action}</div></header>;
}
