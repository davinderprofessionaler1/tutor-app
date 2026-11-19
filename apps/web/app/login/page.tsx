import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "../../components/icons";

export const metadata: Metadata = { title: "Student sign in" };

export default function LoginPage() {
  return (
    <main className="auth-page">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Northstar Learning</span></Link>
      <section className="auth-card"><div className="eyebrow"><span /> Welcome back</div><h1>Continue learning.</h1><p>Your courses, notes, and progress are waiting for you.</p><form><label>Email address<input type="email" placeholder="you@example.com" /></label><label>Password<span><input type="password" placeholder="Enter your password" /></span></label><div className="form-options"><label><input type="checkbox" /> Remember me</label><Link href="#">Forgot password?</Link></div><button className="button button-dark button-wide" type="submit">Sign in <ArrowRight /></button></form><small>New to Northstar? <Link href="/courses">Explore courses</Link></small></section>
      <p className="auth-quote">“Learning becomes useful when it changes what you do next.”</p>
    </main>
  );
}
