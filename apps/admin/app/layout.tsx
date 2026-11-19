import type { Metadata } from "next";
import localFont from "next/font/local";
import { AdminShell } from "../components/admin-shell";
import { ToastProvider } from "../components/toast";
import "./globals.css";

const roboto = localFont({
  src: "./fonts/Roboto-Variable.ttf",
  variable: "--font-roboto",
  weight: "100 900",
});

const poppins = localFont({
  src: [
    { path: "./fonts/Poppins-Regular.ttf", weight: "400" },
    { path: "./fonts/Poppins-SemiBold.ttf", weight: "600" },
    { path: "./fonts/Poppins-Bold.ttf", weight: "700 800" },
  ],
  variable: "--font-poppins",
});

export const metadata: Metadata = { title: { default: "Overview", template: "%s | Northstar Admin" }, description: "Tutor course platform administration." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${roboto.variable} ${poppins.variable}`} suppressHydrationWarning><body suppressHydrationWarning><ToastProvider><AdminShell>{children}</AdminShell></ToastProvider></body></html>;
}
