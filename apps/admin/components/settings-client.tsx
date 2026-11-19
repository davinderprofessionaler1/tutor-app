"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { uploadFile } from "../lib/upload-client";
import { Topbar } from "./topbar";

type Tab = "profile" | "general" | "email" | "security";
type Profile = { firstName: string; lastName: string; email: string; phone: string; jobTitle: string; role: string };
type Settings = {
  siteName: string; appName: string; companyName: string; websiteUrl: string; supportEmail: string; supportPhone: string;
  businessAddress: string; linkedin: string; youtube: string; instagram: string; twitter: string; logoUrl: string;
};
type Smtp = { host: string; port: number; secure: boolean; username: string; password: string; passwordConfigured: boolean; fromName: string; fromEmail: string };
type Notice = { tone: "success" | "error"; text: string } | null;

const emptyProfile: Profile = { firstName: "", lastName: "", email: "", phone: "", jobTitle: "", role: "" };
const emptySettings: Settings = { siteName: "", appName: "", companyName: "", websiteUrl: "", supportEmail: "", supportPhone: "", businessAddress: "", linkedin: "", youtube: "", instagram: "", twitter: "", logoUrl: "" };
const emptySmtp: Smtp = { host: "", port: 587, secure: false, username: "", password: "", passwordConfigured: false, fromName: "", fromEmail: "" };

async function responseJson(response: Response) {
  const result = await response.json();
  if (response.status === 401) window.location.assign("/login");
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result;
}

export function SettingsClient() {
  const [active, setActive] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [smtp, setSmtp] = useState<Smtp>(emptySmtp);
  const [logoUploading, setLogoUploading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "profile" || requested === "general" || requested === "email" || requested === "security") setActive(requested);
    Promise.all([fetch("/api/admin/profile").then(responseJson), fetch("/api/admin/settings").then(responseJson), fetch("/api/admin/smtp").then(responseJson)])
      .then(([profileData, settingsData, smtpData]) => {
        setProfile(profileData.profile);
        setSettings(settingsData.settings);
        setSmtp(smtpData.smtp);
        setUpdatedAt(settingsData.updatedAt);
      })
      .catch((error: Error) => setNotice({ tone: "error", text: error.message }))
      .finally(() => setLoading(false));
  }, []);

  function selectTab(tab: Tab) {
    setActive(tab);
    setNotice(null);
    window.history.replaceState(null, "", `/settings?tab=${tab}`);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setNotice(null);
    try {
      const data = await responseJson(await fetch("/api/admin/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) }));
      setProfile(data.profile);
      window.dispatchEvent(new CustomEvent("admin-profile-updated", { detail: data.profile }));
      setNotice({ tone: "success", text: data.message });
    } catch (error) { setNotice({ tone: "error", text: (error as Error).message }); }
    finally { setPending(false); }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setNotice(null);
    try {
      const data = await responseJson(await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }));
      setSettings(data.settings); setUpdatedAt(data.updatedAt);
      window.dispatchEvent(new CustomEvent("admin-settings-updated", { detail: data.settings }));
      setNotice({ tone: "success", text: data.message });
    } catch (error) { setNotice({ tone: "error", text: (error as Error).message }); }
    finally { setPending(false); }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLogoUploading(true); setNotice(null);
    try {
      const result = await uploadFile(file, "logo", () => undefined);
      setSettings((current) => ({ ...current, logoUrl: result.url }));
      setNotice({ tone: "success", text: "Logo uploaded. Save settings to publish it to the mobile app." });
    } catch (error) { setNotice({ tone: "error", text: (error as Error).message }); }
    finally { setLogoUploading(false); }
  }

  async function saveSmtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setNotice(null);
    try {
      const data = await responseJson(await fetch("/api/admin/smtp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(smtp) }));
      setSmtp(data.smtp); setUpdatedAt(data.updatedAt);
      setNotice({ tone: "success", text: data.message });
    } catch (error) { setNotice({ tone: "error", text: (error as Error).message }); }
    finally { setPending(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setNotice(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword !== data.get("confirmPassword")) {
      setNotice({ tone: "error", text: "New passwords do not match." }); setPending(false); return;
    }
    try {
      const result = await responseJson(await fetch("/api/admin/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword }) }));
      form.reset(); setNotice({ tone: "success", text: result.message });
    } catch (error) { setNotice({ tone: "error", text: (error as Error).message }); }
    finally { setPending(false); }
  }

  const actionLabel = active === "profile" ? "Save profile" : active === "general" ? "Save settings" : active === "email" ? "Save SMTP" : "Update password";
  if (loading) return <><Topbar title="Settings" subtitle="Loading your account and platform preferences." /><div className="page-content"><section className="panel settings-loading">Loading settings…</section></div></>;

  return <>
    <Topbar title="Settings" subtitle="Manage your account, security, and platform details." action={<button className="primary-action" form={`settings-${active}`} disabled={pending} type="submit">{pending ? "Saving…" : actionLabel}</button>} />
    <div className="page-content settings-layout">
      <aside className="settings-nav">
        <button className={active === "profile" ? "active" : ""} onClick={() => selectTab("profile")}><span>Profile</span><small>Name, email, and contact details</small></button>
        <button className={active === "general" ? "active" : ""} onClick={() => selectTab("general")}><span>General settings</span><small>Site identity and social profiles</small></button>
        <button className={active === "email" ? "active" : ""} onClick={() => selectTab("email")}><span>Email delivery</span><small>SMTP server and sender details</small></button>
        <button className={active === "security" ? "active" : ""} onClick={() => selectTab("security")}><span>Password & security</span><small>Update your administrator password</small></button>
      </aside>
      <section className="panel settings-panel">
        {active === "profile" && <><header><h2>Administrator profile</h2><p>This information appears in your admin account and activity records.</p></header><form id="settings-profile" onSubmit={saveProfile}><div className="profile-editor-head"><span>{`${profile.firstName[0] ?? "A"}${profile.lastName[0] ?? ""}`.toUpperCase()}</span><div><strong>{profile.firstName} {profile.lastName}</strong><small>{profile.role}</small></div></div><div className="form-grid"><label>First name<input value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} required /></label><label>Last name<input value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} required /></label><label>Email address<input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} required /></label><label>Phone number<input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label><label>Job title<input value={profile.jobTitle} onChange={(event) => setProfile({ ...profile, jobTitle: event.target.value })} /></label><label>Access role<input value={profile.role} disabled /></label></div><SettingsFooter notice={notice} pending={pending} label="Save profile" /></form></>}
        {active === "general" && <><header><h2>General information</h2><p>These details appear across your website, mobile app, and student emails.</p></header><form id="settings-general" onSubmit={saveSettings}>
          <div className="logo-editor">
            <div className="logo-preview">{settings.logoUrl ? <img src={settings.logoUrl} alt="Current app logo" /> : <span>No logo</span>}</div>
            <div><strong>App logo</strong><p>Upload a PNG, JPG, WebP, or GIF up to 5 MB. The mobile app loads this logo from the API.</p><label className="secondary-action logo-upload">{logoUploading ? "Uploading…" : "Upload logo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadLogo} disabled={logoUploading} /></label>{settings.logoUrl && <button type="button" className="text-action" onClick={() => setSettings({ ...settings, logoUrl: "" })}>Remove logo</button>}</div>
          </div>
          <div className="form-grid"><label>Site name<input value={settings.siteName} onChange={(event) => setSettings({ ...settings, siteName: event.target.value })} required /></label><label>App name<input value={settings.appName} onChange={(event) => setSettings({ ...settings, appName: event.target.value })} required /></label><label>Company or tutor name<input value={settings.companyName} onChange={(event) => setSettings({ ...settings, companyName: event.target.value })} required /></label><label>Website URL<input type="url" value={settings.websiteUrl} onChange={(event) => setSettings({ ...settings, websiteUrl: event.target.value })} /></label><label>Support email<input type="email" value={settings.supportEmail} onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })} required /></label><label>Support phone<input value={settings.supportPhone} onChange={(event) => setSettings({ ...settings, supportPhone: event.target.value })} /></label></div><label>Business address<textarea value={settings.businessAddress} onChange={(event) => setSettings({ ...settings, businessAddress: event.target.value })} /></label><div className="form-divider"/><h3>Social profiles</h3><div className="form-grid"><label>LinkedIn<input type="url" value={settings.linkedin} onChange={(event) => setSettings({ ...settings, linkedin: event.target.value })} /></label><label>YouTube<input type="url" value={settings.youtube} onChange={(event) => setSettings({ ...settings, youtube: event.target.value })} /></label><label>Instagram<input type="url" value={settings.instagram} onChange={(event) => setSettings({ ...settings, instagram: event.target.value })} /></label><label>X / Twitter<input type="url" value={settings.twitter} onChange={(event) => setSettings({ ...settings, twitter: event.target.value })} placeholder="Profile URL" /></label></div><SettingsFooter notice={notice} pending={pending} label="Save settings" updatedAt={updatedAt} /></form></>}
        {active === "email" && <><header><h2>Email delivery</h2><p>Save the SMTP server used for student and transactional emails.</p></header><form id="settings-email" onSubmit={saveSmtp}>
          <div className="security-note"><strong>SMTP credentials</strong><span>The password is never returned to the browser after it is saved. Leave the password blank to keep the existing value.</span></div>
          <div className="form-grid"><label>SMTP host<input value={smtp.host} onChange={(event) => setSmtp({ ...smtp, host: event.target.value })} placeholder="smtp.example.com" required /></label><label>SMTP port<input type="number" min="1" max="65535" value={smtp.port} onChange={(event) => setSmtp({ ...smtp, port: Number(event.target.value) })} required /></label><label>Username<input value={smtp.username} onChange={(event) => setSmtp({ ...smtp, username: event.target.value })} autoComplete="username" /></label><label>Password<input type="password" value={smtp.password} onChange={(event) => setSmtp({ ...smtp, password: event.target.value })} autoComplete="new-password" placeholder={smtp.passwordConfigured ? "Saved — enter to replace" : "SMTP password"} /></label><label>Sender name<input value={smtp.fromName} onChange={(event) => setSmtp({ ...smtp, fromName: event.target.value })} placeholder="Northstar Learning" /></label><label>Sender email<input type="email" value={smtp.fromEmail} onChange={(event) => setSmtp({ ...smtp, fromEmail: event.target.value })} required /></label></div>
          <label className="smtp-secure"><input type="checkbox" checked={smtp.secure} onChange={(event) => setSmtp({ ...smtp, secure: event.target.checked })} /><span><strong>Use TLS from connection start</strong><small>Enable for SMTPS, normally on port 465.</small></span></label>
          <SettingsFooter notice={notice} pending={pending} label="Save SMTP" updatedAt={updatedAt} />
        </form></>}
        {active === "security" && <><header><h2>Password & security</h2><p>Choose a strong password that you do not use anywhere else.</p></header><form id="settings-security" onSubmit={changePassword}><div className="security-note"><strong>Password requirements</strong><span>At least 8 characters with uppercase, lowercase, a number, and a symbol.</span></div><div className="password-fields"><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={8} /></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} /></label></div><SettingsFooter notice={notice} pending={pending} label="Update password" /></form></>}
      </section>
    </div>
  </>;
}

function SettingsFooter({ notice, pending, label, updatedAt }: { notice: Notice; pending: boolean; label: string; updatedAt?: string }) {
  return <footer>{notice ? <span className={`form-message ${notice.tone}`} role="status">{notice.text}</span> : <span>{updatedAt ? `Last saved ${new Date(updatedAt).toLocaleString()}` : "Changes are saved securely."}</span>}<button type="submit" className="primary-action" disabled={pending}>{pending ? "Saving…" : label}</button></footer>;
}
