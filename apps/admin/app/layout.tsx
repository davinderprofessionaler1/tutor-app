import type { Metadata } from "next";
import localFont from "next/font/local";
import { AdminShell } from "../components/admin-shell";
import { ToastProvider } from "../components/toast";
import { ActionDialogProvider } from "../components/action-dialog";
import "./globals.css";
import "./academic.css";

const academic = localFont({
  src: "./fonts/RobotoFlex.ttf", variable: "--font-academic", weight: "100 1000", display: "swap",
});

export const metadata: Metadata = { title: { default: "Overview", template: "%s | Northstar Admin" }, description: "Tutor course platform administration." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={academic.variable} suppressHydrationWarning><body suppressHydrationWarning><ToastProvider><ActionDialogProvider><AdminShell>{children}</AdminShell></ActionDialogProvider></ToastProvider></body></html>;
}
