import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "../../components/login-form";
import { readAdminStore } from "../../lib/admin-store";

export const metadata: Metadata = { title: "Admin sign in" };

export default async function LoginPage() {
  const { settings } = await readAdminStore();
  const appName = settings.appName || "Northstar";
  return <section className="login-card">
    <div className="login-brand">{settings.logoUrl ? <img className="login-logo-image" src={settings.logoUrl} alt={`${appName} logo`} /> : <span className="admin-mark"><i/><i/><i/></span>}<div><strong>{appName}</strong><small>Admin console</small></div></div>
    <div className="login-copy"><span>Welcome back</span><h1>Sign in to your workspace</h1><p>Manage your courses, students, and learning business securely.</p></div>
    <Suspense fallback={<div className="login-loading">Loading sign in…</div>}><LoginForm /></Suspense>
    <div className="login-hint"><strong>Secure administrator access</strong><span>Your session automatically expires after 8 hours.</span></div>
  </section>;
}
