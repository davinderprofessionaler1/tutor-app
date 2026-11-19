"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Unable to sign in."); setPending(false); return; }
    const next = searchParams.get("next");
    router.replace(next?.startsWith("/") ? next : "/");
    router.refresh();
  }

  return <form className="login-form" onSubmit={submit}>
    <label>Email address<input name="email" type="email" autoComplete="username" placeholder="admin@example.com" required autoFocus /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></label>
    {error && <p className="form-message error" role="alert">{error}</p>}
    <button className="primary-action login-button" disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in to dashboard"}</button>
  </form>;
}
